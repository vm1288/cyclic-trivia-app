import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { StageBackground } from './StageBackground';
import { bg } from '../theme/colors';

/**
 * Màn chào NGANG lúc mở app (Tony 2026-09-16): nền sân khấu của Home + icon
 * `android-icon-foreground.png` (đã có sẵn chữ "Cyclic") + tagline
 * "Games for family, friends and fun!" bên dưới.
 *
 * ⚠️ Vì sao KHÔNG làm bằng splash native (`expo-splash-screen` trong app.json):
 * Android 12+ tự vẽ splash hệ thống lúc cold start - chỉ một icon giữa màu nền
 * đơn, không ảnh nền, không chữ - trong lúc tiến trình + bundle JS nạp. Mình
 * không chèn được gì vào đó; cái mình kiểm soát bắt đầu từ khung JS đầu tiên.
 *
 * Tony chọn (09-16) cách "LIỀN MẠCH, không thêm giây nào": splash native dùng
 * CHÍNH icon này, cùng cỡ (`imageWidth: 240` trong app.json = `ICON_DP` ở đây)
 * và cùng chỗ (giữa màn). Lớp này lên là icon đứng yên đúng chỗ cũ, chỉ nền +
 * tagline mờ VÀO quanh nó, giữ `HOLD_MS` ngắn rồi cả lớp mờ RA lộ Home - mắt
 * thấy một màn duy nhất. Home dựng bên dưới song song nên lớp này không kéo
 * dài thời gian tải; phần nó thêm chỉ là `HOLD_MS`.
 *
 * Nối hai nhịp cho khỏi lóe: `_layout.tsx` gọi `preventAutoHideAsync()` lúc
 * nạp module, lớp này gọi `hideAsync()` ở `onLayout` - splash native chỉ biến
 * mất khi lớp JS đã vẽ xong với cùng nền `#070B1F` + icon ở cùng chỗ.
 */
const ICON = require('../../assets/android-icon-foreground.png');
const TAGLINE = 'Games for family, friends and fun!';
/** Bằng `imageWidth` của expo-splash-screen trong app.json - đổi một là đổi cả hai. */
const ICON_DP = 240;
/**
 * Chữ "Cyclic" trong icon chạm đáy ở ~88 % chiều cao file (512 px, bbox tới 450)
 * → 0.88 × 240 − 120 = +91 dp dưới tâm. Tagline bắt đầu ngay dưới đó.
 */
const TAGLINE_TOP_DP = 100;
const FADE_IN_MS = 350;
const HOLD_MS = 600;
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
      {/* Nền + tagline mờ VÀO; icon thì có sẵn từ đầu, đúng chỗ splash native để nó. */}
      <Animated.View style={[styles.fill, dressing]}>
        <StageBackground />
      </Animated.View>

      <View style={styles.center}>
        <Image source={ICON} style={styles.icon} resizeMode="contain" />
        <Animated.Text style={[styles.tagline, dressing]}>{TAGLINE}</Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* Phủ kín màn, TRÊN mọi thứ. Nền cùng màu splash native để lúc chuyển không đổi tông. */
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100, backgroundColor: bg.base },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /* Icon đúng tâm màn - cùng chỗ với splash native (Android 12+ căn giữa icon). */
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { width: ICON_DP, height: ICON_DP },
  tagline: {
    position: 'absolute',
    top: '50%',
    marginTop: TAGLINE_TOP_DP,
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
