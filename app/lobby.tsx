import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ackFlow,
  ensureRoomCode,
  getGameState,
  markPlayersReady,
  roomJoinUrl,
  startGame,
  type GameSnapshot,
  type RoomCode,
} from '../src/api/game';
import {
  lobbyColors,
  LinkIcon,
  LockIcon,
  PeopleIcon,
  PlayerRow,
} from '../src/components/LobbyParts';
import { NeonButton } from '../src/components/NeonButton';
import { ArrowLeftIcon } from '../src/components/NeonIcons';
import { SectionHeader } from '../src/components/SectionHeader';
import { StageBackground } from '../src/components/StageBackground';
import { apiErrorText } from '../src/i18n/apiError';
import { useT } from '../src/i18n/I18nProvider';
import { useLicense } from '../src/session/LicenseSession';
import { usePlayer } from '../src/session/PlayerSession';
import { TYPE_ID } from '../src/net/gameConnection';
import { useGameState } from '../src/net/useGameState';
import { neon, text } from '../src/theme/colors';

/**
 * Nhịp hỏi lại danh sách ghế.
 *
 * Đang dùng POLL chứ chưa dùng SignalR: bản đầu cần chạy được đã, và 3 giây là
 * đủ nhạy cho việc người chơi lần lượt nhận chỗ. Khi nối SignalR thì bỏ hẳn
 * vòng này - xem NEXT_STEPS.md.
 */
/** Bằng đúng bản web (`beginCountdown` trong main.js). Đọc ghi chú ở `beginStart`. */
const COUNTDOWN_SECONDS = 10;

/**
 * Khoảng kẹp cho chiều cao một hàng ghế - xem `rowHeight` trong component.
 *
 * `MAX` là cỡ cũ, dùng khi ván ít người và còn dư chỗ. `MIN` là mức mà avatar
 * 28dp vẫn còn nằm lọt trong hàng; thấp hơn nữa thì nó chạm hai mép.
 *
 * ⚠️ Chạm `MIN` mà vẫn không đủ chỗ thì danh sách CUỘN, không cắt - xem
 * `ScrollView` bọc `styles.rows`.
 */
const ROW_HEIGHT_MAX = 52;
const ROW_HEIGHT_MIN = 30;
const ROW_GAP = 6;

/*
 * ─── Kích thước khung QR: TÍNH RA từ chỗ trống, không đặt cứng ─────────────
 *
 * Cỡ cứng chỉ đúng trên đúng một máy. Máy thấp hơn vài dp là mép dưới khung
 * QR (kể cả quầng sáng của nó) bị vùng cuộn cắt mất - đã dính. Nên đo bề cao
 * THẬT của vùng cuộn rồi trừ dần ra.
 *
 * Các hằng dưới đây là phần chiều cao KHÔNG đổi, phải khớp với `styles`:
 */
/** Khối mã phòng: `codeRim.marginTop` 6 + viền 3 + `codeInner` 44. */
const CODE_BLOCK_HEIGHT = 53;
/** `panel.marginTop`. */
const PANEL_GAP = 8;
/**
 * Lề dưới trong vùng cuộn.
 *
 * ⚠️ Đây mới là thứ làm mất viền dưới, không phải chiều cao. Khung QR có
 * `boxShadow` loang ra ngoài mép, mà `ScrollView` thì cắt mọi thứ vượt khung -
 * kết quả là viền dưới trông như biến mất dù hộp vẫn vừa.
 */
const PANEL_GLOW_PAD = 8;
/** Ruột khung QR khi CÒN nhãn: padding 18 + viền 3 + nhãn 15 + gap 7 + khung ảnh 14. */
const QR_CHROME_FULL = 57;
/** Ruột khung QR khi ĐÃ BỎ nhãn: padding 18 + viền 3 + khung ảnh 14. */
const QR_CHROME_BARE = 35;
const PANEL_MIN = 84;
const PANEL_MAX = 168;
const QR_MIN = 40;
const QR_MAX = 104;

/*
 * Hai nấc co của khung QR, mỗi nấc một ngưỡng. Thứ tự hi sinh đi từ ít thông
 * tin nhất: icon người -> nhãn "COMMON QR CODE" và dòng mời rút còn một dòng.
 * Chính mã QR là thứ cuối cùng bị đụng tới.
 */
/** Dưới mức này thì bỏ icon người. */
const PANEL_ICON_MIN = 132;
/** Dưới mức này thì bỏ nhãn và rút dòng mời còn một dòng. */
const PANEL_LABEL_MIN = 112;

export default function LobbyScreen() {
  const params = useLocalSearchParams<{ gameId?: string }>();
  const router = useRouter();
  const license = useLicense();
  const player = usePlayer();
  const seat = player.status === 'ready' ? player.seat : null;
  const t = useT();

  const session = license.status === 'active' ? license.session : null;

  /*
   * gameId đến từ hai đường: tham số route (vừa tạo ván xong) và phiên đã lưu
   * (bấm RESUME GAME từ màn hình chính). Ưu tiên tham số vì nó luôn là ván mới
   * nhất; phiên lưu là đường dự phòng khi mở lại app.
   */
  const gameId = params.gameId ?? session?.currentGameId ?? null;

  const [room, setRoom] = useState<RoomCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const openRoom = useCallback(async () => {
    if (!gameId || !session) return;

    setLoading(true);
    setError(null);

    const result = await ensureRoomCode(gameId, session.token);
    setLoading(false);

    if (!result.isSuccess) {
      setError(apiErrorText(result, t));
      return;
    }
    setRoom({
      RoomCode: result.RoomCode,
      SessionId: result.SessionId,
      SiteUrl: result.SiteUrl,
      JoinUrl: result.JoinUrl,
    });
  }, [gameId, session, t]);

  useEffect(() => {
    void openRoom();
  }, [openRoom]);

  /*
   * Danh sách ghế do SignalR đẩy nhịp thay cho poll 3 giây - xem `useGameState`.
   *
   * ⚠️ Token ở đây là token NGƯỜI CHƠI của ghế chủ phòng, không phải token
   * license. Chủ phòng nhận ghế 0 trước khi vào màn này (`/host-seat` rồi
   * `submitNickname`), nên `seat` đã có. Chưa có thì hook chỉ chạy lưới an toàn
   * 20 giây - vẫn dùng được, chỉ chậm hơn.
   */
  /**
   * Đang gửi ack, đừng gửi chồng. Chép đúng cách `waiting.tsx` làm.
   *
   * Không chặn vĩnh viễn: `/ready` bấm lại sẽ đặt lại cờ ở server và bắn lại gói
   * 50 - chặn cứng là lần đó không ai ack và ván kẹt y như cũ.
   */
  const acking = useRef(false);

  const { snapshot } = useGameState({
    gameId,
    token: seat?.token ?? null,
    /*
     * ⚠️ ACK NGAY TẠI MÀN LOBBY, đừng để dành cho `waiting.tsx`.
     *
     * `/ready` đặt mọi người sang `PlayerStart` rồi bắn gói 50, nhưng chủ phòng
     * còn Ở ĐÂY suốt lúc đếm ngược - `fireStart` chỉ `router.replace('/waiting')`
     * SAU khi đã gọi `/start`. Nếu chỉ `waiting.tsx` mới ack thì tới lúc
     * `QuestionForTurnHandler` chạy, cờ `IsClientReceivedFlow` của chủ phòng vẫn
     * là false, và điều kiện
     *
     *     player.CurrentFlow == PlayerStart && player.IsClientReceivedFlow
     *
     * trượt ở vế thứ hai -> chủ phòng bị BỎ QUA trong im lặng, không có nhánh nào
     * quét lại. Họ chỉ nhận được câu hỏi ở lượt phát lại, tức muộn khoảng 60 giây,
     * nên gần như không bao giờ thắng nổi vòng đua đầu.
     *
     * ⚠️ Đây KHÔNG phải đua tin: nâng đếm ngược lên 40 giây cũng vô ích, vì chủ
     * phòng không thể ack khi còn ở màn này. Đã đo đúng vậy 2026-09-08.
     *
     * Khách không dính vì họ đã ngồi ở `/waiting` từ lúc nhận ghế.
     *
     * ⚠️ CHỈ ack `PlayerStart`. Đừng ack `QuestionForTurn` - xem ghi chú ở
     * `ackFlow`.
     */
    onPacket: (packet) => {
      if (packet.typeID !== TYPE_ID.PlayerStart) return;
      if (acking.current || !seat) return;
      acking.current = true;
      void ackFlow('PlayerStart', seat.token).finally(() => {
        acking.current = false;
      });
    },
  });

  const seats = snapshot?.Players ?? [];
  const joined = seats.filter((p) => p.IsSetupNickName).length;
  const total = snapshot?.Game.NumberOfPlayers ?? seats.length;

  /*
   * Chỉ bắt đầu khi ĐỦ người, không phải "từ 2 người trở lên" như bản thiết kế.
   *
   * Server tạo sẵn đúng `NumberOfPlayers` ghế ngay lúc tạo ván. Bắt đầu khi còn
   * ghế trống nghĩa là ván vẫn có những người chơi mang nickname mặc định và
   * VẪN ĐẾN LƯỢT họ - bàn cờ sẽ đứng chờ một người không tồn tại.
   */
  const everyoneIn = total > 0 && joined >= total;

  /*
   * ─── Chiều cao mỗi hàng ghế: TÍNH RA, không đặt cứng ──────────────────────
   *
   * Ván tối đa sáu người, mà cột phải ở chiều ngang chỉ cao ~275dp sau tiêu đề
   * mục. Để cứng 52dp như trước là sáu hàng thành 342dp và phải cuộn - danh
   * sách ghế thì phải liếc một cái thấy hết, cuộn để đếm người là hỏng.
   *
   * Nên đo bề cao THẬT của khung bằng `onLayout` rồi chia đều. Đo thay vì suy
   * từ `useWindowDimensions` vì bề cao còn phụ thuộc tai thỏ, thanh điều hướng
   * và cỡ chữ hệ thống - những thứ không tính trước được.
   */
  const [rowsHeight, setRowsHeight] = useState(0);
  const onRowsLayout = useCallback(
    (e: LayoutChangeEvent) => setRowsHeight(e.nativeEvent.layout.height),
    [],
  );

  const rowHeight = (() => {
    // Chưa đo xong thì dùng cỡ cũ; nó đúng cho hai, ba ghế và chỉ hụt ở sáu.
    if (rowsHeight <= 0 || seats.length === 0) return ROW_HEIGHT_MAX;
    const usable = rowsHeight - ROW_GAP * (seats.length - 1);
    // Kẹp hai đầu: dưới `MIN` thì avatar 28dp và chữ 15dp bắt đầu chạm nhau;
    // trên `MAX` thì hai, ba ghế sẽ phình thành những khối cao vô lý.
    return Math.max(ROW_HEIGHT_MIN, Math.min(ROW_HEIGHT_MAX, usable / seats.length));
  })();

  /*
   * Cùng cách làm với `rowHeight`: đo bề cao thật của vùng cuộn cột trái, rồi
   * chia phần còn lại cho khung QR. Xem cụm hằng ở đầu file.
   */
  const [leftAvail, setLeftAvail] = useState(0);
  const onLeftLayout = useCallback(
    (e: LayoutChangeEvent) => setLeftAvail(e.nativeEvent.layout.height),
    [],
  );

  const panelHeight = (() => {
    if (leftAvail <= 0) return PANEL_MIN;
    const left = leftAvail - CODE_BLOCK_HEIGHT - PANEL_GAP - PANEL_GLOW_PAD;
    return Math.max(PANEL_MIN, Math.min(PANEL_MAX, left));
  })();

  const showPanelIcon = panelHeight >= PANEL_ICON_MIN;
  const showPanelLabel = panelHeight >= PANEL_LABEL_MIN;

  // Làm tròn: `react-native-qrcode-svg` nhận số lẻ vẫn vẽ, nhưng cạnh ô mã lệch
  // nửa pixel thì máy quét kém sáng đọc chậm hơn hẳn.
  const qrSize = Math.round(
    Math.max(
      QR_MIN,
      Math.min(QR_MAX, panelHeight - (showPanelLabel ? QR_CHROME_FULL : QR_CHROME_BARE)),
    ),
  );

  const joinUrl = room ? roomJoinUrl(room.SiteUrl, room.SessionId) : '';

  /*
   * ─── Bắt đầu ván: HAI lượt gọi, cách nhau một nhịp đếm ngược ──────────────
   *
   *   /ready  -> đẩy mọi điện thoại sang màn chờ (GameState)
   *   (10 giây "WHO GOES FIRST?")
   *   /start  -> nổ vòng đua ai đi trước (QuestionForTurn)
   *
   * ⚠️ ĐỪNG bỏ nhịp đếm ngược để "cho nhanh". Nó không phải trang trí: đó là
   * lúc điện thoại người chơi báo đã nhận `PlayerStart`, mà server cần cờ đó
   * mới ghi được câu hỏi vòng đua vào flow của họ. Gọi liền tay hai lệnh thì
   * người mất kết nối đúng lúc đó sẽ không lấy lại được câu hỏi. Bản web cũng
   * đúng 10 giây (`beginCountdown` trong main.js).
   *
   * ⚠️ Dùng **token license** (`session.token`), KHÔNG phải token người chơi:
   * hai route này kiểm `game.HostId` chứ không kiểm ghế.
   *
   * App KHÔNG gửi `GameStart`/`WhosTurn` - server tự arm watchdog cho cả hai
   * sau khi vòng đua có người thắng (GAME_RULES mục 8).
   */
  const [phase, setPhase] = useState<'idle' | 'readying' | 'countdown' | 'starting'>('idle');
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);
  const [startError, setStartError] = useState<string | null>(null);

  async function beginStart() {
    if (!gameId || !session || phase !== 'idle') return;

    setStartError(null);
    setPhase('readying');

    const ready = await markPlayersReady(gameId, session.token);
    if (!ready.isSuccess) {
      // Hay gặp nhất: "Not everyone has taken a seat yet" - kể cả khi danh sách
      // trông đã đủ, vì poll có thể đang hiện dữ liệu cũ vài giây.
      setPhase('idle');
      setStartError(apiErrorText(ready, t));
      return;
    }

    setSeconds(COUNTDOWN_SECONDS);
    setPhase('countdown');
  }

  const fireStart = useCallback(async () => {
    if (!gameId || !session) return;

    setPhase('starting');

    const result = await startGame(gameId, session.token);
    if (!result.isSuccess) {
      setPhase('idle');
      setStartError(apiErrorText(result, t));
      return;
    }

    // Chủ phòng cũng là một người chơi, nên từ đây họ xem cùng màn với khách.
    router.replace('/waiting');
  }, [gameId, session, router, t]);

  useEffect(() => {
    if (phase !== 'countdown') return;

    if (seconds <= 0) {
      void fireStart();
      return;
    }

    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, seconds, fireStart]);


  async function invite() {
    if (!room) return;

    /*
     * `Share` có sẵn trong RN, không cần thư viện: nó mở đúng bảng chia sẻ của
     * hệ điều hành, nên gửi được qua Zalo/WhatsApp/SMS/bất cứ app nào máy có.
     *
     * Tin nhắn mang CẢ HAI đường vào, và mã phòng đứng trước:
     *   - có app  -> đọc mã rồi gõ vào màn VÀO PHÒNG
     *   - chưa có -> bấm link chơi trên trình duyệt như cũ
     *
     * ⚠️ ĐỪNG thay link web bằng deep link `cyclic://`. Người chưa cài app sẽ
     * nhận một link chết, và phần lớn ứng dụng nhắn tin không biến chuỗi đó
     * thành link bấm được - nhìn như tin nhắn hỏng. Muốn một link chạy cho cả
     * hai thì phải là App Link thật (tên miền thật + assetlinks.json), mà
     * `localhost:7025` lúc dev thì không làm được.
     *
     * Người dùng bấm huỷ không phải lỗi - `Share.share` trả về
     * `{action: 'dismissedAction'}` chứ không ném, nên không cần bắt gì thêm.
     */
    await Share.share({
      message: t('lobby.inviteMessage', { code: room.RoomCode, url: joinUrl }),
      // Android dùng cho tiêu đề bảng chọn; iOS bỏ qua.
      title: t('lobby.inviteTitle'),
    });
  }

  return (
    <View style={styles.root}>
      <StageBackground />

      {/* Ngang thì tai thỏ nằm ở cạnh trái/phải - phải khai báo cả `left`/`right`. */}
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        {/*
          ⚠️ Lớp bọc `flex: 1` này là BẮT BUỘC, không phải div thừa.

          `SafeAreaView` chèn khoảng an toàn bằng PADDING, mà con
          `position: 'absolute'` thì neo theo mép ngoài chứ không theo padding
          đó. Đặt nút back thẳng dưới `SafeAreaView` là `top: 4` tính từ đỉnh
          màn hình thật - và ở chiều ngang thanh trạng thái VẪN nằm trên cạnh
          trên (xem NEXT_STEPS, mục `insets.top` vẫn cần ở màn ngang), nên chữ
          BACK chồng lên đồng hồ. Đã dính đúng vậy.
        */}
        <View style={styles.body}>
        {/* Nút back nổi đè lên, không nằm trong dòng chảy - xem `FormScreen`. */}
        <Pressable
          onPress={() => router.back()}
          style={styles.backRow}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <View style={styles.backCircle}>
            <ArrowLeftIcon color="#8FD0FF" />
          </View>
          <Text style={styles.backLabel}>{t('common.back').toUpperCase()}</Text>
        </Pressable>

        <View style={styles.stack}>
          {/* Tiêu đề ngang hàng nút back, căn giữa - cùng khuôn với
              `new-game.tsx`. Nút back là lớp phủ tuyệt đối nên không chiếm chỗ
              trong hàng, tiêu đề mới căn giữa theo màn hình được. */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('lobby.title')}</Text>
          </View>

          {!gameId || !session ? (
            <View style={styles.centerBlock}>
              <Text style={styles.note}>{t('lobby.noGame')}</Text>
              <NeonButton
                label={t('home.newGame')}
                color={neon.orange}
                onPress={() => router.replace('/new-game')}
              />
            </View>
          ) : loading ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color={lobbyColors.blue} size="large" />
              <Text style={styles.note}>{t('lobby.loading')}</Text>
            </View>
          ) : !room ? (
            <View style={styles.centerBlock}>
              <Text style={styles.error}>{error}</Text>
              <NeonButton label={t('lobby.retry')} color={neon.orange} onPress={openRoom} />
            </View>
          ) : (
            <View style={styles.middle}>
              {/*
                Cột trái là phần MỜI NGƯỜI VÀO (mã phòng, QR, chia sẻ) và nút
                START. Nút nằm bên này chứ không bên danh sách ghế: cột phải
                phải chừa đủ chỗ cho SÁU hàng ghế mà không cuộn.
              */}
              <View style={styles.col}>
              <SectionHeader title={t('lobby.roomCode')} />

              {/*
                Mã phòng + QR CUỘN ĐƯỢC, nút START thì không - nó nằm ngoài
                vùng cuộn nên luôn ghim ở đáy cột.

                ⚠️ Đừng gộp nút vào trong đây rồi đẩy xuống bằng `flex: 1`:
                làm vậy thì cột vừa khít đúng một máy, và máy tỉ lệ khác chỉ
                lệch vài dp là nút bị cắt mép dưới. Đã dính đúng vậy.
              */}
              <ScrollView
                style={styles.colScroll}
                contentContainerStyle={styles.colScrollInner}
                onLayout={onLeftLayout}
                showsVerticalScrollIndicator={false}
              >

              <LinearGradient
                colors={[lobbyColors.purple, '#E2A7FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.codeRim}
              >
                <LinearGradient
                  colors={['rgba(72,18,120,0.9)', 'rgba(30,8,58,0.95)']}
                  style={styles.codeInner}
                >
                  {/* Giãn ký tự vì mã này để ĐỌC TO cho người khác chép. */}
                  <Text style={styles.codeText} selectable>
                    {room.RoomCode.split('').join(' ')}
                  </Text>
                </LinearGradient>
              </LinearGradient>

              <View style={[styles.panel, { height: panelHeight }]}>
                <View style={styles.qrCol}>
                  {showPanelLabel ? (
                    <Text style={styles.panelLabel}>{t('lobby.qrLabel')}</Text>
                  ) : null}
                  {/* Nền TRẮNG là bắt buộc: máy quét cần tương phản cao. */}
                  <View style={styles.qrFrame}>
                    <QRCode
                      value={joinUrl}
                      size={qrSize}
                      backgroundColor="#FFFFFF"
                      color="#05041A"
                    />
                  </View>
                </View>

                <View style={styles.panelDivider} />

                <View style={styles.inviteCol}>
                  {/* Icon là thứ hi sinh đầu tiên khi khung hẹp: chữ và nút mời
                      còn mang thông tin, nó thì không. */}
                  {showPanelIcon ? <PeopleIcon /> : null}
                  <Text style={styles.inviteCopy} numberOfLines={showPanelLabel ? 2 : 1}>
                    {t('lobby.inviteCopy')}
                  </Text>
                  <Pressable
                    onPress={invite}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.inviteWrap, pressed && styles.pressed]}
                  >
                    <LinearGradient
                      colors={[lobbyColors.violet, lobbyColors.purple]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.inviteBtn}
                    >
                      <LinkIcon />
                      <Text style={styles.inviteBtnText}>{t('lobby.invite')}</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
              </ScrollView>

              <Pressable
                onPress={beginStart}
                disabled={!everyoneIn || phase !== 'idle'}
                accessibilityRole="button"
                accessibilityState={{ disabled: !everyoneIn || phase !== 'idle' }}
                accessibilityLabel={`${t('lobby.start')} — ${t('lobby.joinedCount', { joined, total })}`}
                style={({ pressed }) => [
                  styles.ctaWrap,
                  pressed && everyoneIn && styles.pressed,
                ]}
              >
                {everyoneIn ? (
                  <LinearGradient
                    colors={['#12A85A', '#3CE87A']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[styles.cta, styles.ctaLive]}
                  >
                    <Text style={styles.ctaText}>{t('lobby.start')}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.cta, styles.ctaLocked]}>
                    <LockIcon />
                    <Text style={[styles.ctaText, styles.ctaTextLocked]}>{t('lobby.start')}</Text>
                  </View>
                )}
              </Pressable>

              {startError ? <Text style={styles.error}>{startError}</Text> : null}
              </View>

              {/* Cột phải chỉ còn danh sách ghế. `onLayout` đo bề cao thật để
                  tính chiều cao mỗi hàng - xem `rowHeight`. */}
              <View style={styles.col}>
                {/*
                  Số ghế đã vào neo ở GÓC PHẢI hàng PLAYERS, thay cho thanh tiến
                  độ cũ. Đứng cạnh chính danh sách nó đang đếm thì đọc thẳng
                  được, và không tốn thêm dòng nào - bề cao ở đây đang khan.
                */}
                <SectionHeader
                  title={t('lobby.seats')}
                  trailing={t('lobby.joinedCount', { joined, total })}
                />

                {/*
                  Lưới an toàn: bình thường `rowHeight` đã tính sao cho sáu ghế
                  vừa khít nên không bao giờ cuộn. Nhưng máy quá thấp (hoặc cỡ
                  chữ hệ thống quá lớn) có thể ép `rowHeight` chạm `MIN` mà vẫn
                  thiếu chỗ - lúc đó cuộn được vẫn hơn là cắt mất ghế cuối.
                */}
                <ScrollView
                  style={styles.rowsScroll}
                  onLayout={onRowsLayout}
                  showsVerticalScrollIndicator={false}
                >
                <View style={styles.rows}>
                  {seats.map((p, i) => (
                    <PlayerRow
                      key={p.Id}
                      height={rowHeight}
                      index={i + 1}
                      name={p.IsSetupNickName ? p.NickName : t('lobby.seatEmpty')}
                      colour={p.PlayerColor || lobbyColors.blue}
                      ready={p.IsSetupNickName}
                      isHost={p.IsHost}
                      hostLabel={t('lobby.host')}
                      statusLabel={
                        p.IsSetupNickName ? t('lobby.statusReady') : t('lobby.statusWaiting')
                      }
                    />
                  ))}
                </View>
                </ScrollView>
              </View>
            </View>
          )}
        </View>
        </View>
      </SafeAreaView>

      {/*
        Màn đếm ngược "WHO GOES FIRST?".

        Là một lớp phủ tuyệt đối, KHÔNG phải `Modal`: trên Android thứ tự lớp
        giữa các Modal không đoán trước được (xem SETUP_NOTES), mà app đã có
        ConfirmDialog cũng là Modal. Lớp phủ thường thì không bao giờ chui
        xuống dưới.
      */}
      {phase !== 'idle' ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>{t('lobby.whoGoesFirst')}</Text>
          <Text style={styles.overlayBody}>{t('lobby.whoGoesFirstBody')}</Text>
          {phase === 'countdown' ? (
            <Text style={styles.overlayCount}>{t('lobby.startingIn', { seconds })}</Text>
          ) : (
            <View style={styles.overlaySpinner}>
              <ActivityIndicator color={lobbyColors.amber} size="large" />
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04061A' },
  safe: { flex: 1 },
  /** Mốc định vị cho nút back nổi - xem ghi chú ở chỗ dùng. */
  body: { flex: 1 },
  pressed: { transform: [{ scale: 0.98 }] },

  /**
   * Ba tầng như `new-game.tsx`: tiêu đề - hai cột - (nút nằm trong cột trái).
   * `body` bọc ngoài giữ mốc cho nút back nổi, `stack` mang lề.
   */
  stack: { flex: 1, paddingHorizontal: 20, paddingBottom: 10 },

  /** Cao đúng bằng nút back để tiêu đề nằm ngang hàng với nó. */
  header: { height: 44, justifyContent: 'center' },

  /** Mời người vào + START bên trái | danh sách ghế bên phải. */
  middle: { flex: 1, flexDirection: 'row', gap: 22, paddingTop: 4 },
  col: { flex: 1 },
  /** Phần cuộn được của cột trái; nút START nằm NGOÀI nó - xem chỗ dùng. */
  colScroll: { flex: 1 },
  // ⚠️ `paddingBottom` là chỗ cho QUẦNG SÁNG của khung QR loang ra. Bỏ đi thì
  // `ScrollView` cắt đúng ở mép hộp và viền dưới trông như mất - xem
  // `PANEL_GLOW_PAD`.
  colScrollInner: { paddingBottom: PANEL_GLOW_PAD },

  backRow: {
    position: 'absolute',
    top: 4,
    left: 14,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: lobbyColors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 10px rgba(47,143,255,0.55)',
  },
  backLabel: { color: text.primary, fontSize: 16, fontWeight: '700', letterSpacing: 2.4 },

  // Chiếm trọn bề ngang + căn giữa, KHÔNG bọc trong View alignItems:'center':
  // Android đo hụt bề rộng chữ nghiêng rồi cắt cụt (đã dính ở màn NEW GAME).
  title: {
    alignSelf: 'stretch',
    textAlign: 'center',
    // Nhỏ dần theo từng vòng: 30 (bản dọc) -> 26 -> 22. Giờ nó nằm trong hàng
    // cao 44dp cùng nút back, và mọi dp tiết kiệm được ở đây đều rơi xuống cột
    // ghế bên phải - nơi cần chỗ cho sáu hàng.
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    fontStyle: 'italic',
    color: '#F2F6FF',
    textShadowColor: 'rgba(140,200,255,0.6)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },

  codeRim: { marginTop: 6, padding: 1.5, borderRadius: 13, boxShadow: '0 0 18px rgba(200,107,255,0.6)' },
  codeInner: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  codeText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 4,
    textShadowColor: 'rgba(226,167,255,0.9)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },

  panel: {
    marginTop: 8,
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(63,224,255,0.55)',
    backgroundColor: 'rgba(10,12,40,0.78)',
    padding: 9,
    gap: 12,
    boxShadow: '0 0 12px rgba(47,143,255,0.35)',
  },
  // `justifyContent` cần từ khi khung có chiều cao đặt sẵn: QR bị kẹp ở
  // `QR_MAX` thì cột này thấp hơn khung, để mặc định nó dính lên đỉnh.
  qrCol: { alignItems: 'center', justifyContent: 'center', gap: 7 },
  panelLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.3, color: lobbyColors.cyan },
  qrFrame: {
    padding: 5,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(63,224,255,0.5)',
  },
  panelDivider: { width: 1, backgroundColor: 'rgba(150,190,235,0.25)' },
  inviteCol: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  inviteCopy: { fontSize: 13, lineHeight: 18, color: lobbyColors.dim, textAlign: 'center' },
  inviteWrap: { width: '100%' },
  inviteBtn: {
    height: 40,
    marginTop: 2,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 0 14px rgba(200,107,255,0.6)',
  },
  inviteBtnText: { fontSize: 13.5, fontWeight: '700', letterSpacing: 1.1, color: '#FFFFFF' },

  /**
   * `flex: 1` để vùng cuộn nhận trọn phần cao còn lại của cột - đó chính là con
   * số `onLayout` đo được và `rowHeight` chia ra. Đặt bề cao cố định ở đây là
   * phép đo mất nghĩa.
   */
  rowsScroll: { flex: 1, marginTop: 8 },
  // ⚠️ `gap` phải khớp `ROW_GAP` ở đầu file, phép chia dùng đúng con số đó.
  rows: { gap: ROW_GAP },

  ctaWrap: { marginTop: 8 },
  cta: {
    height: 54,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  ctaLive: { boxShadow: '0 0 16px rgba(46,232,95,0.55)' },
  // Nền ĐẶC, không phải rgba trong suốt: nút nằm ngay trên bệ phát sáng của
  // ảnh nền, để trong suốt thì bệ xuyên qua và nút trông như đang hỏng chứ
  // không phải đang khoá.
  ctaLocked: {
    backgroundColor: '#171B2E',
    borderWidth: 1.5,
    borderColor: 'rgba(140,160,210,0.35)',
  },
  ctaText: { fontSize: 19, fontWeight: '700', letterSpacing: 2, color: '#FFFFFF' },
  ctaTextLocked: { color: 'rgba(190,205,235,0.5)' },

  centerBlock: { marginTop: 40, gap: 18 },
  note: {
    color: lobbyColors.dim,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  error: { color: '#FF4D6A', fontSize: 13, lineHeight: 19 },

  // Phủ kín màn hình, nền gần như đặc: lúc này người chơi phải nhìn vào đồng hồ
  // đếm ngược, không phải vào danh sách ghế phía sau.
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4,6,26,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 18,
  },
  overlayTitle: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    fontStyle: 'italic',
    color: '#F2F6FF',
    textShadowColor: 'rgba(140,200,255,0.6)',
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  overlayBody: {
    fontSize: 15,
    lineHeight: 23,
    color: lobbyColors.dim,
    textAlign: 'center',
  },
  overlayCount: {
    fontSize: 44,
    fontWeight: '800',
    color: lobbyColors.amber,
    textShadowColor: 'rgba(255,198,30,0.55)',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  overlaySpinner: { marginTop: 8 },
});
