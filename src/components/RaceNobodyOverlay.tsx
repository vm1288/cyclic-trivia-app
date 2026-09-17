import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useT } from '../i18n/I18nProvider';
import { boardColors, fill } from './GameBoardParts';

/**
 * Vòng đua "WHO GOES FIRST?" mà KHÔNG AI đúng (hết giờ hoặc mọi người đều sai) - chép
 * `WrongAnswerForTurn.cshtml` của bàn cờ: "OOPS! Nobody got it right..." + dòng vàng
 * "Next question is coming! (10s)" đếm lùi. Tới qua gương bàn cờ (K103); server phát
 * câu mới khi đếm về 0 (lưới `QuestionForTurn`), máy chỉ đếm cho có nhịp.
 *
 * Trước 09-17 mỗi máy hiện "X, you're out of time!" riêng - Tony: sai, phải là MỘT câu
 * chung cho cả phòng như bàn cờ.
 */
export function RaceNobodyOverlay({ seconds }: { seconds: number }) {
  const t = useT();
  const [left, setLeft] = useState(Math.max(1, seconds));
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.back(1.4)) });
  }, [enter]);

  useEffect(() => {
    setLeft(Math.max(1, seconds));
    const tick = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, [seconds]);

  const card = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.88 + enter.value * 0.12 }],
  }));

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.card, card]}>
        <LinearGradient colors={['rgba(58,8,16,0.96)', 'rgba(10,12,34,0.96)']} style={[fill, styles.cardFill]} />
        <Text style={styles.title} numberOfLines={2}>
          {t('race.nobody')}
        </Text>
        <Text style={styles.next} numberOfLines={1}>
          {t('race.nextQuestion', { seconds: String(left) })}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Không chặn chạm - cùng lý do với `RaceWinnerOverlay`. */
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    maxWidth: '84%',
    paddingHorizontal: 26,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.6,
    borderColor: boardColors.red,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  cardFill: { borderRadius: 16 },
  /* Chữ trắng như web (`style="color:#fff"`). */
  title: { fontSize: 20, lineHeight: 26, fontWeight: '900', letterSpacing: 0.6, color: '#FFFFFF', textAlign: 'center' },
  /* Dòng vàng như web (`color:#FFFF00`). */
  next: { fontSize: 14, fontWeight: '700', color: '#FFE23A', textAlign: 'center' },
});
