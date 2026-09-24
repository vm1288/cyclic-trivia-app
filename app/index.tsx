import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCurrentGame, getGameState, shouldBeOnBoard } from '../src/api/game';
import { useConfirm } from '../src/components/ConfirmDialog';
import { GlowDivider } from '../src/components/GlowDivider';
import { NeonButton } from '../src/components/NeonButton';
import { MyGamesSheet } from '../src/components/MyGamesSheet';
import {
  BookIcon,
  CartIcon,
  JoinIcon,
  NewGameIcon,
} from '../src/components/NeonIcons';
import { NoGamesDialog } from '../src/components/NoGamesDialog';
import { StageBackground } from '../src/components/StageBackground';
import { useT } from '../src/i18n/I18nProvider';
import { useLicense } from '../src/session/LicenseSession';
import { usePlayer } from '../src/session/PlayerSession';
import { innerGlow, neon, outerGlow, text } from '../src/theme/colors';

/**
 * Logo dùng MỘT file lockup (hình + chữ "Cyclic" + tagline), vì logo chính thức
 * được cấp ở dạng một khối liền có sẵn hiệu ứng glow - tách ra sẽ mất glow ở
 * mép cắt, và chữ "Cyclic" nghiêng đậm kia là font riêng, dựng lại bằng <Text>
 * với font hệ thống sẽ không giống.
 *
 * Thay logo = ghi đè assets/brand/logo-lockup.png. PHẢI có nền trong suốt;
 * file nền trắng sẽ hiện thành khối trắng trên nền tối.
 */
/*
 * Tony 21/9: bỏ dòng PLAY • THINK • WIN nướng trong ảnh, thay bằng câu của splash "Games for family,
 * friends and fun!" vẽ bằng code. `logo-lockup-notagline.png` = `logo-lockup.png` cắt bỏ dải chữ dưới
 * (1122×1128, cắt ở y=1128 - dải tagline nằm 1137..1192). Đổi logo thì cắt lại y như vậy.
 */
const LOGO_LOCKUP = require('../assets/brand/logo-lockup-notagline.png');
/** Cùng câu với BrandSplash.TAGLINE - đổi một là đổi cả hai. */
const HOME_TAGLINE = 'Games for family, friends and fun!';

/** Tagline chỉ đi với logo Cyclic mặc định; logo sponsor đứng một mình. Ảnh lockup KHÔNG còn chữ (xem trên). */
const LOCKUP_INCLUDES_TAGLINE = false;

/** Ba nút dưới không đổi theo trạng thái license. */
const MENU = [
  { key: 'home.join', Icon: JoinIcon, color: neon.purple, href: '/join' },
  { key: 'home.purchase', Icon: CartIcon, color: neon.blue, href: '/purchase' },
  { key: 'home.howToPlay', Icon: BookIcon, color: neon.green, href: '/how-to-play' },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  /* Nút "My Games" đặt tuyệt đối nên tự cộng tai thỏ/thanh trạng thái (absolute bỏ qua padding của SafeAreaView). */
  const insets = useSafeAreaInsets();
  const license = useLicense();
  const player = usePlayer();
  const t = useT();
  const confirm = useConfirm();

  /**
   * Máy đã kích hoạt xong license thì nút đầu đổi thành NEW GAME - không còn
   * gì để đăng ký nữa.
   *
   * Chỉ tính `status === 'active'`. `'pending'` nghĩa là đã nhập đúng mã nhưng
   * chưa xong bước email/OTP, vẫn phải quay lại luồng đăng ký để làm nốt.
   * Trong lúc `'loading'` (còn đang đọc SecureStore) thì giữ nguyên REGISTER
   * GAME rồi tự đổi khi đọc xong - nhanh tới mức không kịp thấy, và như vậy
   * không bao giờ nháy NEW GAME cho máy chưa có license.
   */
  const activated = license.status === 'active';
  const session = activated ? license.session : null;

  type OpenGame = { id: string; players: number; minutes: number; joined: number };
  const [openGame, setOpenGame] = useState<OpenGame | null>(null);
  /*
   * K106 (Tony 18/9): không còn nhập mã license - mua trong app. Home có nút nhỏ "My Games"
   * (góc trên trái, đè lên logo) mở tấm quản lý; SET UP A MATCH mở tấm CHỌN game khi có hơn
   * một game; chưa có game nào thì cả hai ra hộp "No Games Found" dẫn sang EXPLORE GAMES.
   */
  const [sheet, setSheet] = useState<'manage' | 'choose' | null>(null);
  const [noGames, setNoGames] = useState(false);

  /**
   * Ghế của máy này trong một ván ĐANG CHƠI DỞ, nếu có.
   *
   * ⚠️ Đây là đường về DUY NHẤT cho người chơi khách. Đo trên máy thật
   * 2026-09-09 (TEST_CASES mục K10, ca KL-5): giết app giữa ván rồi mở lại thì
   * màn này về trắng, còn nút RESUME thì dẫn về phòng mà MÁY NÀY TỪNG LÀM CHỦ -
   * kể cả một phòng đã start xong và bỏ hoang, thả thẳng vào LOBBY còn nguyên
   * nút START GAME bấm được (ca K-A4). Người chơi khách phải JOIN + gõ lại mã
   * phòng mới vào lại được, dù server vẫn giữ đúng ghế cho họ.
   *
   * Hai lỗ hổng đó là K-A3 và K-A4. Chỗ hỏng nằm ở màn này, không ở server.
   */
  const [liveSeatGameId, setLiveSeatGameId] = useState<string | null>(null);

  /**
   * Hỏi SERVER xem có ván nào đang mở không - server là nguồn sự thật, vì id
   * lưu ở máy sẽ mất khi cài lại app dù ván vẫn đang có người chờ.
   *
   * Chạy lại MỖI LẦN màn hình này được focus, không chỉ lúc mount: bấm back từ
   * lobby là quay về đây, và lúc đó nút phải đã đúng.
   */
  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        if (!session) {
          if (alive) setOpenGame(null);
          return;
        }

        const result = await getCurrentGame(session.token);
        if (!alive) return;

        if (result.isSuccess) {
          if (result.IsOpen) {
            setOpenGame({
              id: result.GameId,
              players: result.NumberOfPlayers,
              minutes: result.DurationMinutes,
              joined: result.JoinedPlayers,
            });
            license.setCurrentGame(result.GameId);
          } else {
            setOpenGame(null);
            license.setCurrentGame(null);
          }
          return;
        }

        /*
         * Không hỏi được server (mất mạng/timeout) thì DÙNG TẠM id đã lưu và
         * vẫn hiện RESUME. Ẩn nút đi trong lúc mạng chập chờn là cách chắc chắn
         * làm người dùng mất đường quay lại phòng đang có người chờ.
         *
         * Không biết số người/thời lượng nên dòng phụ để trống - vẫn hơn là
         * không có nút.
         */
        const fallback = session.currentGameId;
        setOpenGame(fallback ? { id: fallback, players: 0, minutes: 0, joined: 0 } : null);
      })();

      return () => {
        alive = false;
      };
    }, [session, license]),
  );

  /**
   * Ghế đã lưu có còn thuộc một ván đang chạy không.
   *
   * Hỏi `/api/game/{id}/state` - endpoint này KHÔNG cần token, nên dùng được cả
   * cho người chơi khách (họ không có license, `getCurrentGame` phía trên bỏ
   * qua họ hoàn toàn).
   *
   * ⚠️ Ba nhánh, đừng gộp:
   *   - gọi hỏng vì MẠNG  -> giữ nguyên, KHÔNG xoá ghế. Xoá ghế lúc mạng chập
   *     là cắt đứt đường về của người đang chơi dở, đúng cái lỗi này định vá.
   *   - ván không còn / đã kết thúc -> xoá ghế, để lần sau khỏi hỏi lại mãi.
   *   - ván còn nhưng CHƯA vào cuộc -> không phải việc của nút này; `waiting`
   *     và `lobby` lo, nên chỉ cần không bật nút.
   */
  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        const seat = player.status === 'ready' ? player.seat : null;
        if (!seat) {
          if (alive) setLiveSeatGameId(null);
          return;
        }

        const state = await getGameState(seat.gameId);
        if (!alive) return;

        if (!state.isSuccess) {
          /* 404 = ván không còn; lỗi mạng thì giữ nguyên và thử lại lần focus sau. */
          if (state.kind === 'http') {
            setLiveSeatGameId(null);
            void player.clearSeat();
          }
          return;
        }

        if (state.Game.IsGameOver) {
          setLiveSeatGameId(null);
          void player.clearSeat();
          return;
        }

        /* K93: đang đếm ngược vòng đua cũng là "đang có ván" - mở lại app giữa 10 giây đó thì RESUME về bàn cờ. */
        setLiveSeatGameId(shouldBeOnBoard(state.Game) ? seat.gameId : null);
      })();

      return () => {
        alive = false;
      };
    }, [player]),
  );

  /**
   * "Start a different game" - đường thoát khỏi ván đang mở, hai trường hợp:
   *   - máy này LÀM CHỦ một ván chưa xong (`openGame`): bỏ con trỏ, ván cũ bị
   *     ghi đè khi tạo ván mới. Chủ phòng cũng kết thúc được tử tế hơn từ trong
   *     ván qua menu ba chấm → END GAME (K74).
   *   - máy này đang NGỒI GHẾ KHÁCH trong ván của người khác chưa xong
   *     (`liveSeatGameId`): trước 09-14 nút đầu là RESUME và KHÔNG có đường nào
   *     tạo ván mới cho tới khi ván kia hết giờ (Tony gặp đúng ca này). Nay bỏ
   *     ghế đã lưu rồi đi tạo ván - khách không có "Leave game" trong ván (Tony
   *     chốt), lối này là đủ.
   */
  async function confirmStartAnother() {
    const guestSeat = !!liveSeatGameId && !openGame;
    const ok = await confirm({
      title: t('home.startAnotherTitle'),
      message: t(guestSeat ? 'home.startAnotherBodyGuest' : 'home.startAnotherBody'),
      cancelLabel: t('common.cancel').toUpperCase(),
      confirmLabel: t('home.startAnotherConfirm').toUpperCase(),
      destructive: true,
    });
    if (!ok) return;

    if (liveSeatGameId) {
      // Ghế vẫn còn trên server; chỉ máy này quên nó đi. Ván kia chạy tiếp
      // nhờ watchdog, chủ phòng của nó vẫn kết thúc được.
      await player.clearSeat();
      setLiveSeatGameId(null);
    }
    // Ván cũ bị bỏ ngay khi tạo ván mới: `createGame` ghi đè
    // `Hosts.CurrentGameSessionId`. Ở đây chỉ cần buông con trỏ.
    license.setCurrentGame(null);
    router.push('/new-game');
  }

  /**
   * MÀN HOME LUÔN MANG LOGO CYCLIC - K135 (Tony 24/9).
   *
   * Trước đây máy đã đăng ký thì màn này đổi sang logo SPONSOR, nên chơi CricTriv xong là
   * home thành CricTriv: trông như máy chỉ có một game, trong khi Cyclic là nhà chung của
   * nhiều game. Logo của game nay hiện ở đúng chỗ nó thuộc về - NEW MATCH, CHOOSE YOUR
   * CHARACTER, phòng chờ và tấm My Games.
   *
   * ⚠️ Đừng "sửa lại cho đồng bộ" bằng cách lấy `license.session.sponsorLogoUri` ở đây.
   */
  const showDefaultLockup = true;

  /**
   * Nút đầu tiên có BA trạng thái:
   *   chưa đăng ký license  → REGISTER GAME
   *   đã đăng ký, không ván → NEW GAME
   *   đang có ván mở        → RESUME GAME (+ dòng phụ, + link "tạo ván khác")
   */
  const firstButton = liveSeatGameId
    ? { key: 'home.resume' as const, Icon: NewGameIcon, href: '/game-landscape' as const }
    : activated && openGame
      ? { key: 'home.resume' as const, Icon: NewGameIcon, href: '/lobby' as const }
      : { key: 'home.newGame' as const, Icon: NewGameIcon, href: '/new-game' as const };

  /** SET UP A MATCH: chưa game → hộp No Games; một game → thẳng /new-game; nhiều → tấm chọn. */
  const setUpMatch = () => {
    const games = license.all.filter((g) => g.activated);
    if (games.length === 0) { setNoGames(true); return; }
    if (games.length === 1) {
      if (!activated || license.session.hostId !== games[0].hostId) void license.switchTo(games[0].hostId);
      router.push('/new-game');
      return;
    }
    setSheet('choose');
  };

  const openMyGames = () => {
    if (license.all.filter((g) => g.activated).length === 0) { setNoGames(true); return; }
    setSheet('manage');
  };

  /** Huỷ gói = quản lý trên store; app chỉ dẫn tới trang đăng ký của store. */
  const cancelSubscription = async () => {
    const store = t(Platform.OS === 'ios' ? 'purchase.storeApple' : 'purchase.storeGoogle');
    const ok = await confirm({
      title: t('games.cancelTitle'),
      message: t('games.cancelBody', { store }),
      cancelLabel: t('common.cancel').toUpperCase(),
      confirmLabel: t('games.cancelOpen').toUpperCase(),
    });
    if (!ok) return;
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
    void Linking.openURL(url).catch(() => {});
  };

  // `players === 0` = đang dùng bản dự phòng lúc mất mạng, chưa biết chi tiết
  // ván -> bỏ dòng phụ thay vì hiện "0 người".
  const resumeDetail = liveSeatGameId
    ? t('home.resumeInGame')
    : openGame && openGame.players > 0
      ? openGame.minutes > 0
        ? t('home.resumeMinutes', {
            joined: openGame.joined,
            players: openGame.players,
            minutes: openGame.minutes,
          })
        : // minutes === 0 là thể thức Leaderboard Challenge, không có mốc phút.
          t('home.resumeLeaderboard', { joined: openGame.joined, players: openGame.players })
      : undefined;

  /**
   * BỐ CỤC NGANG: logo bên trái, cột nút bên phải.
   *
   * Chiều cao khả dụng chỉ còn ~393dp (trước là ~800), nên xếp dọc như cũ là
   * logo đẩy hết nút xuống dưới màn. Chia đôi bề ngang thì cả hai cùng nằm
   * trong tầm mắt và không phải cuộn.
   *
   * Cột nút hẹp hơn nửa màn là CỐ Ý: hai bức tường chấm halftone trong ảnh nền
   * nằm sát hai mép, nút tràn tới viền sẽ che mất chúng và màn hình mất chiều
   * sâu.
   */
  const menuWidth = Math.min(width * 0.38, 340);

  /**
   * Logo co theo CHIỀU CAO, không theo bề ngang.
   *
   * Ở chiều ngang thì bề cao mới là thứ khan hiếm; buộc theo bề ngang cột trái
   * là logo cao quá khung và bị cắt đầu đuôi.
   */
  /*
   * K68: license vừa bị server phán chết thì khung "hết hạn" chiếm chỗ dưới logo -
   * logo co lại nhường chỗ. Hiện cả khi máy còn license khác (đang dùng cái đó rồi
   * vẫn cần biết cái kia chết); "Để sau" thì cất.
   */
  const expired = license.expired;
  const logoHeight = Math.min(height * (expired ? 0.34 : 0.58), expired ? 130 : 230);

  /**
   * Logo trôi lên xuống 6px, chu kỳ 6s - đúng keyframe `cyc-float` của bản
   * thiết kế. Chạy trên UI thread nên không giật khi JS thread bận.
   */
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [float]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * float.value }],
  }));

  return (
    <View style={styles.root}>
      <StageBackground />

      {/* ⚠️ Ở chiều ngang, tai thỏ nằm ở cạnh TRÁI hoặc PHẢI - phải khai báo cả
          `left`/`right`, nếu không logo chui xuống dưới tai thỏ. Bản dọc cũ chỉ
          cần `top`/`bottom`. */}
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.row}>
          <View style={styles.logoCol}>
            {/* ⚠️ `alignSelf: 'stretch'` là BẮT BUỘC: `logoCol` căn giữa ngang,
                nên lớp bọc không stretch sẽ co về đúng bề ngang nội dung - mà
                nội dung là một <Image> rộng '100%' của chính nó, tức 0. Logo
                biến mất, không có lỗi nào. */}
            <Animated.View style={[styles.logoWrap, floatStyle]}>
              <Image
                source={LOGO_LOCKUP}
                style={[styles.logo, { height: logoHeight }]}
                resizeMode="contain"
              />
            </Animated.View>

            {expired ? (
              <View style={styles.expiredCard}>
                <Text style={styles.expiredTitle}>
                  {t(expired.reason === 'license_expired' ? 'expired.title' : 'expired.titleInactive')}
                </Text>
                <Text style={styles.expiredBody}>
                  {t(expired.reason === 'license_expired' ? 'expired.body' : 'expired.bodyInactive', {
                    sponsor: expired.sponsorName ?? t('expired.sponsorFallback'),
                    code: expired.licenseCode,
                  })}{' '}
                  {t('expired.bodyStore', { store: t(Platform.OS === 'ios' ? 'purchase.storeApple' : 'purchase.storeGoogle') })}
                </Text>
                <View style={styles.expiredRow}>
                  <Pressable
                    onPress={() => router.push('/purchase')}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.expiredBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.expiredBtnText}>{t('expired.renew')}</Text>
                  </Pressable>
                  <Pressable onPress={license.dismissExpired} accessibilityRole="button" hitSlop={8}>
                    <Text style={styles.expiredDismiss}>{t('expired.dismiss')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {!expired && showDefaultLockup && !LOCKUP_INCLUDES_TAGLINE && (
              <Text style={styles.tagline}>{HOME_TAGLINE}</Text>
            )}
          </View>

          {/*
            Cột nút vẫn cuộn được: mở đủ tiếng Đức/tiếng Việt dài, hoặc bật cỡ
            chữ hệ thống lên, là năm nút vượt quá 393dp bề cao.
          */}
          <ScrollView
            style={[styles.menuCol, { width: menuWidth }]}
            contentContainerStyle={styles.menuContent}
            showsVerticalScrollIndicator={false}
          >
            <NeonButton
              label={t(firstButton.key)}
              sublabel={resumeDetail}
              Icon={firstButton.Icon}
              color={neon.orange}
              onPress={() =>
                /*
                 * ⚠️ Ván ĐANG CHƠI DỞ phải được xét TRƯỚC `openGame`.
                 *
                 * `openGame` đến từ license, tức "phòng máy này làm chủ" - và nó
                 * luôn dẫn về `/lobby`. Chủ phòng chết app giữa ván mà xét
                 * `openGame` trước thì rơi vào lobby của chính ván đang chạy,
                 * còn nguyên nút START GAME (ca K-A4). Xét ghế trước thì cả chủ
                 * phòng lẫn khách đều về thẳng bàn cờ.
                 */
                liveSeatGameId
                  ? router.push('/game-landscape')
                  : activated && openGame
                    ? router.push({ pathname: '/lobby', params: { gameId: openGame.id } })
                    : setUpMatch()
              }
            />

            {/* Luôn có đường thoát khi ván cũ bị treo - không bao giờ để máy
                kẹt ở một ván không kết thúc được. */}
            {openGame || (liveSeatGameId && activated) ? (
              <Pressable
                onPress={confirmStartAnother}
                accessibilityRole="button"
                style={({ pressed }) => [styles.startAnother, pressed && styles.startAnotherPressed]}
              >
                <Text style={styles.startAnotherText}>{t('home.startAnother')}</Text>
              </Pressable>
            ) : null}

            {/*
              Vạch ngăn CHỈ xuất hiện khi nhóm trên có HAI nút (RESUME GAME +
              tạo ván khác). Lúc chỉ có một nút thì không có nhóm nào để tách,
              vạch trở thành đường kẻ trang trí vô nghĩa giữa các nút cùng cấp.
            */}
            {openGame || (liveSeatGameId && activated) ? <GlowDivider style={styles.groupDivider} /> : null}

            {MENU.map((item) => (
              <NeonButton
                key={item.key}
                label={t(item.key)}
                Icon={item.Icon}
                color={item.color}
                onPress={() => router.push(item.href)}
              />
            ))}

            {/*
              Chỉ hiện khi máy đã có license - chưa đăng ký thì chưa có game
              nào để đổi, và nút REGISTER GAME ở trên đã là đường vào rồi.

              Nhãn đổi theo số license: mới có một cái thì "Switch" là sai, chưa
              có gì để chuyển sang.
            */}
          </ScrollView>
        </View>

        {/* Nút nhỏ "My Games" góc trên trái, ĐÈ lên vùng logo - không chiếm hàng, logo không bị đẩy (K106). */}
        <Pressable
          onPress={openMyGames}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.myGames, { top: insets.top + 8, left: insets.left + 18 }, pressed && styles.pressed]}
        >
          <Text style={styles.myGamesText}>{t('home.myGames')}</Text>
        </Pressable>
      </SafeAreaView>

      <MyGamesSheet
        visible={sheet !== null}
        mode={sheet ?? 'manage'}
        sessions={license.all.filter((g) => g.activated)}
        activeHostId={activated ? license.session.hostId : null}
        onClose={() => setSheet(null)}
        onNewMatch={async (hostId) => {
          setSheet(null);
          if (!activated || license.session.hostId !== hostId) await license.switchTo(hostId);
          // Ván cũ của license này (nếu có) hiện ở RESUME; NEW MATCH là tạo ván mới thật.
          license.setCurrentGame(null);
          router.push('/new-game');
        }}
        onCancelSubscription={() => {
          setSheet(null);
          void cancelSubscription();
        }}
        onBuyAnother={() => {
          setSheet(null);
          router.push('/purchase');
        }}
      />

      <NoGamesDialog
        visible={noGames}
        onClose={() => setNoGames(false)}
        onExplore={() => {
          setNoGames(false);
          router.push('/purchase');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04061A' },
  safe: { flex: 1 },

  /** Hàng ngoài cùng: logo trái | cột nút phải. */
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },

  /**
   * `flex: 1` để cột logo NUỐT phần dư, còn cột nút giữ đúng bề ngang đã tính.
   * Làm ngược lại (cố định cột logo) thì máy bề ngang khác sẽ đẩy cột nút lệch
   * ra ngoài mép.
   */
  logoCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /**
   * Bề rộng do `menuWidth` quyết định, ở đây chỉ chặn cột không phình theo nội
   * dung. `flexGrow: 0` giữ ScrollView bám đúng bề cao khả dụng.
   */
  menuCol: { flexGrow: 0 },
  /**
   * Căn giữa dọc khi nội dung còn thấp hơn khung (`flexGrow: 1` +
   * `justifyContent: 'center'`), và tự chuyển sang cuộn từ trên xuống khi vượt.
   */
  menuContent: { flexGrow: 1, justifyContent: 'center', gap: 11, paddingVertical: 10 },

  /**
   * ⚠️ Ở bố cục ngang, logo buộc theo CHIỀU CAO (`logoHeight`) chứ không phải
   * bề ngang. `resizeMode="contain"` lo phần tỉ lệ, nên đổi sang logo sponsor
   * tỉ lệ khác vẫn không vỡ bố cục.
   */
  logoWrap: { alignSelf: 'stretch' },

  /* Khung "license hết hạn" (K68) - viền đỏ, nút GIA HẠN cam như nút mua. */
  expiredCard: {
    alignSelf: 'stretch',
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1.6,
    borderColor: '#FF3B52',
    backgroundColor: 'rgba(70,8,20,0.55)',
    boxShadow: '0 0 12px rgba(255,59,82,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  expiredTitle: { color: '#FF8A9A', fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
  expiredBody: { color: text.primary, fontSize: 12, lineHeight: 17 },
  expiredRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 2 },
  expiredBtn: {
    height: 34,
    paddingHorizontal: 22,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: neon.orange.stroke,
    backgroundColor: '#0A0810',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `${outerGlow(neon.orange)}, ${innerGlow(neon.orange)}`,
  },
  expiredBtnText: { color: text.primary, fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  expiredDismiss: { color: text.muted, fontSize: 13, textDecorationLine: 'underline' },
  pressed: { transform: [{ scale: 0.97 }] },
  logo: { width: '100%' },

  /* Cùng kiểu chữ với BrandSplash.tagline (cỡ nhỏ hơn vì logo Home thấp hơn). */
  tagline: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: '#F2F6FF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 1 },
  },

  /*
   * Nút phụ: viền sáng bạc, nền tối, quầng sáng nhẹ.
   *
   * Vẫn KHÔNG dùng màu neon - đây là hành động phá bỏ ván đang có, không nên
   * tranh chỗ với nút chính ngay trên nó. Nhưng giữ độ sáng đủ để đọc rõ trên
   * nền sân khấu: bản trước viền chỉ 0.28 alpha, bị nuốt mất giữa các nút neon
   * xung quanh.
   */
  startAnother: {
    height: 32,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(205,228,255,0.75)',
    backgroundColor: 'rgba(16,20,40,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 10px rgba(160,200,255,0.30), inset 0 0 16px rgba(120,170,255,0.12)',
  },
  startAnotherPressed: { opacity: 0.65 },
  startAnotherText: {
    color: '#F2F7FF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textShadowColor: 'rgba(170,210,255,0.6)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },

  // Quầng loang của GlowDivider cao gấp 12 lần sợi chính và tràn ra ngoài
  // khung, nên chừa khoảng dọc rộng hơn một vạch phẳng cùng vai trò.
  groupDivider: { marginVertical: 2 },

  // Link chữ, không phải nút: đây là hành động hiếm và không nên tranh chỗ với
  // bốn nút neon ngay trên nó.
  /* Nút nhỏ góc trên trái, tuyệt đối để không đẩy logo (K106). `top/left` tính từ SafeAreaView. */
  myGames: {
    position: 'absolute',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(205,228,255,0.7)',
    backgroundColor: 'rgba(16,20,40,0.85)',
    boxShadow: '0 0 10px rgba(160,200,255,0.30)',
  },
  myGamesText: { color: '#F2F7FF', fontSize: 12.5, fontWeight: '800', letterSpacing: 1 },
});
