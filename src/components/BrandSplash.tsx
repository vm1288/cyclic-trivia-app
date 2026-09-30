import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { StageBackground } from './StageBackground';
import { bg } from '../theme/colors';

import { glowPad, glowRoom } from '../theme/glow';
/**
 * Màn chào NGANG lúc mở app (Tony 2026-09-16): nền sân khấu của Home + icon
 * `android-icon-foreground.png` (đã có sẵn chữ "Cyclic") + tagline
 * "Games for family, friends and fun!" bên dưới.
 *
 * ⚠️ Vì sao KHÔNG làm bằng splash native (`expo-splash-screen` trong app.json):
 * Android 12+ tự vẽ splash hệ thống lúc cold start - chỉ một icon giữa màu nền
 * đơn, không ảnh nền, không chữ - trong lúc tiến trình + bundle JS nạp. Mình
 * không chèn được gì vào đó; cái mình kiểm soát bắt đầu từ khung JS đầu tiên.
 * Hơn nữa Android 12+ **cắt icon theo hình tròn**: đưa icon có chữ vào là chữ
 * "Cyclic" bị xén (đo trên Zenfone Android 13, K95) - nên splash native giữ
 * `splash-logo.png` (biểu tượng tròn, không chữ) như cũ.
 *
 * Tony chốt (09-16, sau khi xem ảnh đo): "dùng splash-logo.png như cũ, chỉ khi
 * chuyển sang JS mới đổi". Lớp này làm đúng thế:
 *   1. Lớp NỀN vẽ lại y hệt splash native: nền `#070B1F` + `splash-logo.png`
 *      `NATIVE_LOGO_DP` ở tâm màn → gọi `hideAsync()` ở `onLayout` là splash
 *      native biến mất mà mắt không thấy gì đổi.
 *   2. Lớp TRANG TRÍ (nền sân khấu + icon có chữ + tagline) mờ VÀO đè lên
 *      (`FADE_IN_MS`), giữ `HOLD_MS`, rồi cả lớp mờ RA lộ Home.
 * Home dựng bên dưới song song nên lớp này không kéo dài thời gian tải; phần
 * nó thêm là `HOLD_MS` (3 s, Tony muốn người chơi kịp nhìn) + hai nhịp mờ.
 *
 * Đo trên Zenfone Max Pro M1 (Android 13, dev bundle): từ JS `main` tới khung
 * đầu ~15 s là do bundle dev + máy yếu, không phải lớp này (TEST_CASES K95).
 */
const NATIVE_LOGO = require('../../assets/splash-logo.png');
const ICON = require('../../assets/android-icon-foreground.png');
const TAGLINE = 'Games for family, friends and fun!';
/** Bằng `imageWidth` của expo-splash-screen trong app.json - đổi một là đổi cả hai. */
const NATIVE_LOGO_DP = 240;
/** Icon có chữ ở lớp trang trí; không cần khớp native vì hai lớp crossfade. */
const ICON_DP = 240;
/**
 * Chữ "Cyclic" trong icon chạm đáy ở ~96 % chiều cao file (512 px, bbox tới 490)
 * → 0.96 × 240 − 120 = +110 dp dưới tâm. Tagline bắt đầu ngay dưới đó.
 */
/* Tony 21/9: "sát với logo, cho cách ra một xíu" → 100 → 122. */
const TAGLINE_TOP_DP = 122;
const FADE_IN_MS = 350;
/** Tony (09-16): giữ ít nhất 3 giây - chuyển nhanh quá thì splash vô nghĩa. */
const HOLD_MS = 3000;
const FADE_OUT_MS = 350;

export function BrandSplash({ onDone }: { onDone: () => void }) {
  const dress = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    dress.value = withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.quad) });
    opacity.value = withDelay(
      FADE_IN_MS + HOLD_MS,
      withTiming(0, { duration: FADE_OUT_MS, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, [dress, opacity, onDone]);

  const root = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const dressing = useAnimatedStyle(() => ({ opacity: dress.value }));

  return (
    <Animated.View
      style={[styles.root, root]}
      pointerEvents="none"
      /* Lớp JS đã lên khung → gỡ splash native. Nuốt lỗi: gọi khi native đã tự ẩn là chuyện thường. */
      onLayout={() => {
        void SplashScreen.hideAsync().catch(() => {});
      }}
    >
      {/* 1. Bản sao của splash native: cùng nền, cùng logo, cùng cỡ, cùng chỗ. */}
      <View style={styles.center}>
        <Image source={NATIVE_LOGO} style={styles.nativeLogo} resizeMode="contain" />
      </View>

      {/* 2. Lớp trang trí mờ VÀO đè lên: nền sân khấu + icon có chữ + tagline. */}
      <Animated.View style={[styles.fill, dressing]}>
        <StageBackground />
        <View style={styles.center}>
          <Image source={ICON} style={styles.icon} resizeMode="contain" />
          <Animated.Text style={styles.tagline}>{TAGLINE}</Animated.Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* Phủ kín màn, TRÊN mọi thứ. Nền cùng màu splash native để lúc chuyển không đổi tông. */
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100, backgroundColor: bg.base },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /* Đúng tâm màn - cùng chỗ với splash native (Android 12+ căn giữa icon). */
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nativeLogo: { width: NATIVE_LOGO_DP, height: NATIVE_LOGO_DP },
  icon: { width: ICON_DP, height: ICON_DP },
  tagline: {
    ...glowRoom(8),
    position: 'absolute',
    top: '50%',
    marginTop: TAGLINE_TOP_DP - glowPad(8),
    left: 24,
    right: 24,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: '#F2F6FF',
    textAlign: 'center',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 1 },
  },
});
