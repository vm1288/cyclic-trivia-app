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
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
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
import { neon, text } from '../src/theme/colors';

/**
 * Nhịp hỏi lại danh sách ghế.
 *
 * Đang dùng POLL chứ chưa dùng SignalR: bản đầu cần chạy được đã, và 3 giây là
 * đủ nhạy cho việc người chơi lần lượt nhận chỗ. Khi nối SignalR thì bỏ hẳn
 * vòng này - xem NEXT_STEPS.md.
 */
const POLL_MS = 3000;

/** Bằng đúng bản web (`beginCountdown` trong main.js). Đọc ghi chú ở `beginStart`. */
const COUNTDOWN_SECONDS = 10;

export default function LobbyScreen() {
  const params = useLocalSearchParams<{ gameId?: string }>();
  const router = useRouter();
  const license = useLicense();
  const t = useT();

  const session = license.status === 'active' ? license.session : null;

  /*
   * gameId đến từ hai đường: tham số route (vừa tạo ván xong) và phiên đã lưu
   * (bấm RESUME GAME từ màn hình chính). Ưu tiên tham số vì nó luôn là ván mới
   * nhất; phiên lưu là đường dự phòng khi mở lại app.
   */
  const gameId = params.gameId ?? session?.currentGameId ?? null;

  const [room, setRoom] = useState<RoomCode | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
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
   * Poll danh sách ghế. Dùng ref cho cờ sống để lần chạy sau không chồng lên
   * lần trước khi mạng chậm, và dọn sạch khi rời màn.
   */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      if (!gameId || !alive.current) return;

      const result = await getGameState(gameId);
      if (!alive.current) return;

      // Lỗi mạng thì giữ nguyên danh sách cũ và thử lại ở nhịp sau - nhấp nháy
      // giữa "có người" và "trống" khó chịu hơn là hiện hơi cũ vài giây.
      if (result.isSuccess) setSnapshot({ Game: result.Game, Players: result.Players });

      timer = setTimeout(tick, POLL_MS);
    }

    void tick();
    return () => {
      alive.current = false;
      clearTimeout(timer);
    };
  }, [gameId]);

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
  const progress = total > 0 ? joined / total : 0;

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

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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

          <Text style={styles.title}>{t('lobby.title')}</Text>
          <Text style={styles.subtitle}>{t('lobby.subtitle')}</Text>

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
            <>
              <SectionHeader title={t('lobby.roomCode')} />

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

              <View style={styles.panel}>
                <View style={styles.qrCol}>
                  <Text style={styles.panelLabel}>{t('lobby.qrLabel')}</Text>
                  {/* Nền TRẮNG là bắt buộc: máy quét cần tương phản cao. */}
                  <View style={styles.qrFrame}>
                    <QRCode value={joinUrl} size={92} backgroundColor="#FFFFFF" color="#05041A" />
                  </View>
                </View>

                <View style={styles.panelDivider} />

                <View style={styles.inviteCol}>
                  <PeopleIcon />
                  <Text style={styles.inviteCopy}>{t('lobby.inviteCopy')}</Text>
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

              <SectionHeader title={t('lobby.seats')} />

              <View style={styles.progressRow}>
                <Text style={styles.joinedText}>{t('lobby.joinedCount', { joined, total })}</Text>
                <View style={styles.spacer} />
                <View style={styles.track}>
                  <LinearGradient
                    colors={[lobbyColors.violet, lobbyColors.purple]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    // Chừa tối thiểu 4% để thanh không biến mất hoàn toàn lúc
                    // chưa ai vào - trông như hỏng.
                    style={[styles.fillBar, { width: `${Math.max(progress, 0.04) * 100}%` }]}
                  />
                </View>
                <Text style={styles.countText}>
                  {joined}/{total}
                </Text>
              </View>

              <View style={styles.rows}>
                {seats.map((p, i) => (
                  <PlayerRow
                    key={p.Id}
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

              <Pressable
                onPress={beginStart}
                disabled={!everyoneIn || phase !== 'idle'}
                accessibilityRole="button"
                accessibilityState={{ disabled: !everyoneIn || phase !== 'idle' }}
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

              {!everyoneIn ? <Text style={styles.note}>{t('lobby.startBlocked')}</Text> : null}
              {startError ? <Text style={styles.error}>{startError}</Text> : null}
            </>
          )}
        </ScrollView>
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
  scroll: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 30 },
  spacer: { flex: 1 },
  pressed: { transform: [{ scale: 0.98 }] },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start' },
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
    marginTop: 12,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    fontStyle: 'italic',
    color: '#F2F6FF',
    textShadowColor: 'rgba(140,200,255,0.6)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: lobbyColors.dim,
    textAlign: 'center',
  },

  codeRim: { marginTop: 9, padding: 1.5, borderRadius: 13, boxShadow: '0 0 18px rgba(200,107,255,0.6)' },
  codeInner: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
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
    marginTop: 11,
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(63,224,255,0.55)',
    backgroundColor: 'rgba(10,12,40,0.78)',
    padding: 11,
    gap: 12,
    boxShadow: '0 0 12px rgba(47,143,255,0.35)',
  },
  qrCol: { alignItems: 'center', gap: 7 },
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

  progressRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  joinedText: { fontSize: 14, color: lobbyColors.dim },
  track: {
    width: 120,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(120,140,200,0.22)',
    overflow: 'hidden',
  },
  fillBar: { height: '100%', borderRadius: 3 },
  countText: { fontSize: 14, fontWeight: '700', color: text.primary },

  rows: { gap: 6, marginTop: 9 },

  ctaWrap: { marginTop: 16 },
  cta: {
    height: 58,
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
