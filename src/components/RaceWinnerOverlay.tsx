import { useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '../i18n/I18nProvider';
import { boardColors, fill } from './GameBoardParts';
import { text } from '../theme/colors';

/**
 * "X nhanh nhất! Người đó đi trước" - hiện GIỮA BÀN CỜ khi vòng đua có kết quả.
 *
 * ⚠️ Trước đây app không hiện gì cả, và đó là một lỗ hổng thật: bàn cờ của bản
 * web luôn hiện câu này giữa màn hình, còn máy người chơi thì chỉ CHÍNH người
 * thắng nhận được một `BoardMessage` riêng - người thua không nhận gì, chỉ thấy
 * màn hình tự nhiên đổi lượt mà không hiểu vì sao. App native lại là "mỗi điện
 * thoại một bàn cờ", nên phải hiện cho tất cả.
 *
 * Dữ liệu tới qua gói `RaceWinner` (87) - gói riêng của app, chỉ mang tên người
 * thắng. Gói `BoardMessage` (26) của bản web mang HTML dựng sẵn nên app không
 * dùng được (xem NEXT_STEPS, mục "server đang đẩy HTML").
 */
export function RaceWinnerOverlay({ name, isMe }: { name: string; isMe: boolean }) {
  const t = useT();

  const enter = useSharedValue(0);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.back(1.6)) });

    /*
     * Nhấp nháy nhẹ để mắt bắt được ngay - chạy Reanimated trên UI thread, đúng
     * lúc này luồng JS đang bận nhận cả loạt gói tin xếp lại lượt chơi.
     */
    glow.value = withDelay(
      260,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.4, { duration: 620, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [enter, glow]);

  const card = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.86 + enter.value * 0.14 }],
  }));

  const halo = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.card, card]}>
        <LinearGradient
          colors={['rgba(52,40,4,0.96)', 'rgba(10,12,34,0.96)']}
          style={[fill, styles.cardFill]}
        />
        <Animated.View style={[styles.halo, halo]} pointerEvents="none" />

        <Text style={styles.title} numberOfLines={2}>
          {isMe ? t('race.winnerYou') : t('race.winner', { name })}
        </Text>
        <Text style={styles.body} numberOfLines={1}>
          {isMe ? t('race.firstYou') : t('race.first')}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * Phủ vùng bàn cờ nhưng KHÔNG chặn chạm: đây chỉ là thông báo, và ngay sau nó
   * là lượt chơi bắt đầu - nuốt mất cú chạm đầu tiên là hỏng nhịp.
   */
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
    borderColor: boardColors.amber,
    alignItems: 'center',
    gap: 5,
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
    borderColor: boardColors.amber,
    boxShadow: '0 0 18px rgba(255,198,30,0.85), 0 0 34px rgba(255,198,30,0.35)',
  },

  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: boardColors.amber,
    textAlign: 'center',
  },
  body: { fontSize: 13, fontWeight: '600', color: text.primary, textAlign: 'center' },
});
