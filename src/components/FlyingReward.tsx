import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CARD_STYLES, type CardKey } from './GameBoardParts';

/**
 * Phần thưởng bay từ GIỮA BÀN CỜ về đúng chỗ của nó: ngôi sao bay vào hàng sao
 * của ô người chơi, lá bài bay vào ô bài tương ứng.
 *
 * ⚠️ Component này render ở GỐC màn hình, không nằm trong khung bàn cờ: điểm
 * đến (hàng sao, ô bài) nằm ở cột phải, tức ngoài khung bàn cờ. Toạ độ vì vậy
 * đều là toạ độ MÀN HÌNH (`measureInWindow`), không phải toạ độ tương đối.
 *
 * ⚠️ Chạy Reanimated trên UI thread. Đúng lúc này luồng JS đang bận nhất: server
 * vừa gửi một loạt gói cập nhật điểm, sao, hạng, bài - hiệu ứng chạy bằng state
 * sẽ giật ngay tại đây.
 */

type Props = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** `star` hoặc tên lá bài (`Joker`, `Skipper`...). */
  reward: 'star' | CardKey;
  onDone: () => void;
};

/** Cỡ của vật bay - đủ to để thấy, đủ nhỏ để không che mất bàn cờ. */
const SIZE = 46;

export function FlyingReward({ from, to, reward, onDone }: Props) {
  const progress = useSharedValue(0);
  const pop = useSharedValue(0);

  useEffect(() => {
    /*
     * Nhịp: nảy lên tại chỗ cho người chơi kịp thấy đó là cái gì, RỒI mới bay.
     * Bay ngay lập tức thì mắt không kịp bắt, chỉ thấy một vệt loé.
     */
    pop.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2)) }),
      withDelay(420, withTiming(0.85, { duration: 160 })),
    );

    progress.value = withDelay(
      560,
      withTiming(1, { duration: 620, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, [progress, pop, onDone]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;

    /*
     * Đường bay cong: chen thêm một chút độ cao ở giữa đường. Bay thẳng tắp
     * trông như kéo icon bằng chuột, không ra "phần thưởng bay tới".
     */
    const arc = Math.sin(p * Math.PI) * -34;

    return {
      opacity: p < 0.92 ? 1 : (1 - p) / 0.08,
      transform: [
        { translateX: from.x + (to.x - from.x) * p },
        { translateY: from.y + (to.y - from.y) * p + arc },
        // To lúc đứng giữa bàn cờ, nhỏ dần khi về tới chỗ đậu.
        { scale: (0.4 + pop.value * 0.6) * (1 - p * 0.55) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.root, style]} pointerEvents="none">
      {reward === 'star' ? (
        <Text style={styles.star}>★</Text>
      ) : (
        <View style={[styles.card, { borderColor: CARD_STYLES[reward].glow, backgroundColor: CARD_STYLES[reward].tint }]}>
          {(() => {
            const Icon = CARD_STYLES[reward].Icon;
            return <Icon size={26} />;
          })()}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /*
   * Neo ở góc trên-trái màn hình rồi dịch bằng transform: `translate` chạy trên
   * UI thread, còn đổi `left/top` thì mỗi khung hình một lần layout lại.
   */
  root: {
    position: 'absolute',
    top: -SIZE / 2,
    left: -SIZE / 2,
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  star: {
    fontSize: 40,
    lineHeight: 48,
    color: '#FFD23F',
    textShadowColor: 'rgba(255,210,63,0.9)',
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  card: {
    width: SIZE,
    height: SIZE,
    borderRadius: 10,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 16px rgba(255,255,255,0.35)',
  },
});
