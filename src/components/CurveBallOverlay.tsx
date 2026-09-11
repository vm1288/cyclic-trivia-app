import { useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { assetUrl } from '../api/game';
import { useT } from '../i18n/I18nProvider';
import { fill } from './GameBoardParts';
import { text } from '../theme/colors';

/**
 * Tấm CURVE BALL - hiện giữa cột bàn cờ khi server vừa áp một biến cố (gói 90).
 *
 * Chép bàn cờ web (`CaseActionShowCurveBall`, mainHandlers.js): tiêu đề theo
 * bàn - **Googly** (CricTriv), **VAR decisions** (FootieTriv), **Curve Ball**
 * (còn lại) - vàng `#ffd400`, ảnh `images/curveball.png` của server, rồi câu
 * hiệu ứng. Bàn cờ giữ tấm `ShowCurveBallCountDown` giây (server gửi kèm) rồi
 * tự đi tiếp; ở app tấm cũng tự tắt sau đúng chừng đó.
 *
 * Điện thoại người chơi web KHÔNG thấy tấm này (chỉ bàn cờ TV có) - app là mỗi
 * máy một bàn cờ nên mọi người đều thấy. Xem `TypeID.CurveBall` phía server.
 *
 * Không chặn chạm: hiệu ứng đã áp ở server, lượt kế mở ra ngay sau tấm.
 */
export function CurveBallOverlay({
  boardGameId,
  message,
}: {
  boardGameId: string;
  message: string;
}) {
  const t = useT();

  const enter = useSharedValue(0);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.back(1.5)) });
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [enter, glow]);

  const card = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.86 + enter.value * 0.14 }],
  }));
  const halo = useAnimatedStyle(() => ({ opacity: glow.value }));

  const title =
    boardGameId === 'crictriv'
      ? t('curve.titleCric')
      : boardGameId === 'footietriv'
        ? t('curve.titleFootie')
        : t('curve.title');

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.card, card]}>
        <LinearGradient
          colors={['rgba(56,40,4,0.97)', 'rgba(10,12,34,0.97)']}
          style={[fill, styles.cardFill]}
        />
        <Animated.View style={[styles.halo, halo]} pointerEvents="none" />

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Image
          source={{ uri: assetUrl('/images/curveball.png') }}
          style={styles.image}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.body} numberOfLines={3}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    /* Trên câu hỏi (20): tấm này tới ĐÚNG lúc đổi lượt, không được bị khung cũ che. */
    zIndex: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    maxWidth: '84%',
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.6,
    borderColor: '#ffd400',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  cardFill: { borderRadius: 16 },
  halo: {
    position: 'absolute',
    top: -1.6,
    left: -1.6,
    right: -1.6,
    bottom: -1.6,
    borderRadius: 16,
    borderWidth: 1.6,
    borderColor: '#ffd400',
    boxShadow: '0 0 18px rgba(255,212,0,0.85), 0 0 34px rgba(255,212,0,0.35)',
  },

  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#ffd400',
    textAlign: 'center',
  },
  image: { width: 96, height: 96 },
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    color: text.primary,
    textAlign: 'center',
  },
});
