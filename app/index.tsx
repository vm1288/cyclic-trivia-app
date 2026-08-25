import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentGame } from '../src/api/game';
import { useConfirm } from '../src/components/ConfirmDialog';
import { GlowDivider } from '../src/components/GlowDivider';
import { NeonButton } from '../src/components/NeonButton';
import {
  BookIcon,
  CartIcon,
  JoinIcon,
  LockIcon,
  NewGameIcon,
} from '../src/components/NeonIcons';
import { StageBackground } from '../src/components/StageBackground';
import { useT } from '../src/i18n/I18nProvider';
import { useLicense } from '../src/session/LicenseSession';
import { neon, tagline, text } from '../src/theme/colors';

/**
 * Logo dùng MỘT file lockup (hình + chữ "Cyclic" + tagline), vì logo chính thức
 * được cấp ở dạng một khối liền có sẵn hiệu ứng glow - tách ra sẽ mất glow ở
 * mép cắt, và chữ "Cyclic" nghiêng đậm kia là font riêng, dựng lại bằng <Text>
 * với font hệ thống sẽ không giống.
 *
 * Thay logo = ghi đè assets/brand/logo-lockup.png. PHẢI có nền trong suốt;
 * file nền trắng sẽ hiện thành khối trắng trên nền tối.
 */
const LOGO_LOCKUP = require('../assets/brand/logo-lockup.png');

/**
 * Đặt `true` khi file lockup đã bao gồm sẵn dòng PLAY • THINK • WIN, để khỏi
 * vẽ chồng thêm một dòng nữa bằng code.
 *
 * Chỉ áp cho logo Cyclic mặc định. Logo sponsor thì luôn đứng một mình.
 */
const LOCKUP_INCLUDES_TAGLINE = true;

/** Ba nút dưới không đổi theo trạng thái license. */
const MENU = [
  { key: 'home.join', Icon: JoinIcon, color: neon.purple, href: '/join' },
  { key: 'home.purchase', Icon: CartIcon, color: neon.blue, href: '/purchase' },
  { key: 'home.howToPlay', Icon: BookIcon, color: neon.green, href: '/how-to-play' },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const license = useLicense();
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

  async function confirmStartAnother() {
    const ok = await confirm({
      title: t('home.startAnotherTitle'),
      message: t('home.startAnotherBody'),
      cancelLabel: t('common.cancel').toUpperCase(),
      confirmLabel: t('home.startAnotherConfirm').toUpperCase(),
      destructive: true,
    });
    if (!ok) return;

    // Ván cũ bị bỏ ngay khi tạo ván mới: `createGame` ghi đè
    // `Hosts.CurrentGameSessionId`. Ở đây chỉ cần buông con trỏ.
    license.setCurrentGame(null);
    router.push('/new-game');
  }

  /**
   * Máy đã đăng ký thì mang thương hiệu của SPONSOR, không phải Cyclic.
   *
   * Và khi đó KHÔNG vẽ thêm chữ: logo sponsor vốn đã là một khối hoàn chỉnh có
   * sẵn tên riêng bên trong (vd "CricTriv by Cyclic"), ghép thêm dòng "Cyclic"
   * nữa là thừa và sai thương hiệu.
   *
   * `sponsorLogoUri` có thể null dù đã đăng ký (sponsor chưa có logo, hoặc tải
   * hỏng lúc kích hoạt) - lúc đó vẫn dùng logo Cyclic mặc định.
   */
  const sponsorLogoUri = activated ? license.session.sponsorLogoUri : null;
  const showDefaultLockup = !sponsorLogoUri;

  /**
   * Nút đầu tiên có BA trạng thái:
   *   chưa đăng ký license  → REGISTER GAME
   *   đã đăng ký, không ván → NEW GAME
   *   đang có ván mở        → RESUME GAME (+ dòng phụ, + link "tạo ván khác")
   */
  const firstButton = !activated
    ? { key: 'home.register' as const, Icon: LockIcon, href: '/register' as const }
    : openGame
      ? { key: 'home.resume' as const, Icon: NewGameIcon, href: '/lobby' as const }
      : { key: 'home.newGame' as const, Icon: NewGameIcon, href: '/new-game' as const };

  // `players === 0` = đang dùng bản dự phòng lúc mất mạng, chưa biết chi tiết
  // ván -> bỏ dòng phụ thay vì hiện "0 người".
  const resumeDetail =
    openGame && openGame.players > 0
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
   * Cột nút hẹp hơn bề rộng màn hình là CỐ Ý: hai bức tường chấm halftone trong
   * ảnh nền nằm sát hai mép, nút tràn viền sẽ che mất chúng và màn hình mất
   * chiều sâu. 78% chừa vừa đủ để thấy tường ở hai bên.
   */
  const menuWidth = Math.min(width * 0.78, 300);

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

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={floatStyle}>
            <Image
              source={sponsorLogoUri ? { uri: sponsorLogoUri } : LOGO_LOCKUP}
              style={[styles.logo, { width: menuWidth * 0.8 }]}
              resizeMode="contain"
            />
          </Animated.View>

          {showDefaultLockup && !LOCKUP_INCLUDES_TAGLINE && (
            <View style={styles.tagline}>
              <View style={styles.taglineRule} />
              <Text style={[styles.taglineWord, { color: tagline.play }]}>PLAY</Text>
              <Text style={styles.taglineDot}>•</Text>
              <Text style={[styles.taglineWord, { color: tagline.think }]}>THINK</Text>
              <Text style={styles.taglineDot}>•</Text>
              <Text style={[styles.taglineWord, { color: tagline.win }]}>WIN</Text>
              <View style={styles.taglineRule} />
            </View>
          )}

          <View style={[styles.menu, { width: menuWidth }]}>
            <NeonButton
              label={t(firstButton.key)}
              sublabel={resumeDetail}
              Icon={firstButton.Icon}
              color={neon.orange}
              onPress={() =>
                openGame
                  ? router.push({ pathname: '/lobby', params: { gameId: openGame.id } })
                  : router.push(firstButton.href)
              }
            />

            {/* Luôn có đường thoát khi ván cũ bị treo - không bao giờ để máy
                kẹt ở một ván không kết thúc được. */}
            {openGame ? (
              <Pressable
                onPress={confirmStartAnother}
                accessibilityRole="button"
                style={({ pressed }) => [styles.startAnother, pressed && styles.startAnotherPressed]}
              >
                <Text style={styles.startAnotherText}>{t('home.startAnother')}</Text>
              </Pressable>
            ) : null}

            {/*
              Vạch ngăn giữa nhóm nút VỀ VÁN CHƠI (tạo/tiếp tục/bỏ ván) và các
              mục còn lại. Khi có hai nút cùng nói về ván, chúng dễ bị đọc lẫn
              vào JOIN A GAME ngay bên dưới.
            */}
            <GlowDivider style={styles.groupDivider} />

            {MENU.map((item) => (
              <NeonButton
                key={item.key}
                label={t(item.key)}
                Icon={item.Icon}
                color={item.color}
                onPress={() => router.push(item.href)}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04061A' },
  safe: { flex: 1 },
  /**
   * Neo lên trên chứ không căn giữa dọc: bệ phát sáng nằm ở đáy ảnh nền, căn
   * giữa sẽ đẩy cột nút xuống đè lên nó.
   */
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 32,
  },

  // Chiều cao cố định, resizeMode="contain" lo phần tỉ lệ - nên đổi sang logo
  // khác tỉ lệ khác vẫn không vỡ bố cục.
  logo: { height: 190 },

  tagline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  taglineWord: { fontSize: 14, fontWeight: '800', letterSpacing: 2.5 },
  taglineDot: { color: text.muted, fontSize: 12 },
  taglineRule: { width: 26, height: 1, backgroundColor: 'rgba(120,180,255,0.55)' },

  menu: { marginTop: 30, gap: 14 },

  /*
   * Nút phụ: viền sáng bạc, nền tối, quầng sáng nhẹ.
   *
   * Vẫn KHÔNG dùng màu neon - đây là hành động phá bỏ ván đang có, không nên
   * tranh chỗ với nút chính ngay trên nó. Nhưng giữ độ sáng đủ để đọc rõ trên
   * nền sân khấu: bản trước viền chỉ 0.28 alpha, bị nuốt mất giữa các nút neon
   * xung quanh.
   */
  startAnother: {
    height: 42,
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
  groupDivider: { marginVertical: 10 },
});
