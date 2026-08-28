import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '../i18n/I18nProvider';
import { DiceCube } from './DiceCube';

/**
 * Xúc xắc lăn, phủ giữa màn hình.
 *
 * Bám bản thiết kế `designs/Roll Dice Button.dc.html` (bản `.tsx` cùng tên chỉ
 * là bản sinh ra từ HTML đó, và chính nó ghi rõ mình là "fake-3D"). Ba chỗ **cố
 * ý khác**, đừng "sửa lại cho giống":
 *
 *  1. **Số là của SERVER.** Bản thiết kế tự bốc 1-6 để xem hiệu ứng; ở đây con
 *     số đã được server quyết lúc xử lý `Pub RollDice`. Bốc ở client là hai máy
 *     hiện hai kết quả khác nhau cho cùng một nước.
 *  2. **Không có "ROLL AGAIN", không có nút đóng.** Tung xong ván đi tiếp sang
 *     bước chọn hướng; nút tung lại là mời gửi thêm gói server không chờ.
 *  3. **`backdrop-filter: blur`** bỏ - RN không có sẵn, muốn mờ nền phải kéo
 *     thêm `expo-blur` cho một lớp sống 4 giây.
 *
 * Khối lập phương là THẬT (ba mặt, chiếu isometric) - xem `DiceCube`. Cú lăn
 * chép nhịp của `designs/RollDiceButton.tsx`: khối **vừa xoay vừa nảy**, độ nảy
 * thấp dần, và mặt đổi liên tục cho tới khi server trả kết quả.
 *
 * Xoay tự do trong không gian ba chiều thì phải kéo `expo-gl` + `three` về, tức
 * thêm native module và bắt buộc build lại APK - đã cân nhắc và không đáng cho
 * một hiệu ứng sống 4 giây.
 */

/** Cạnh viên xúc xắc trên màn hình, bằng bản thiết kế. */
const SIZE = 128;

/**
 * Chuỗi nảy trong lúc chờ kết quả, chép `HOP_KEYFRAMES` của bản thiết kế: nảy
 * cao rồi thấp dần, mỗi lần chạm "mặt bàn" là một lần đổi mặt.
 */
const HOPS: { y: number; d: number }[] = [
  { y: -30, d: 170 }, { y: 0, d: 150 },
  { y: -20, d: 190 }, { y: 0, d: 170 },
  { y: -12, d: 210 }, { y: 0, d: 190 },
  { y: -5, d: 230 }, { y: 0, d: 210 },
];

/** Một vòng xoay lúc đang chờ. */
const SPIN_MS = 1100;

/** Cú hạ cánh: xoay nốt cho tròn vòng rồi dừng. */
const LAND_MS = 700;

export function DiceRollOverlay({
  /** `null` = vẫn đang lăn, chưa biết kết quả. */
  value,
}: {
  value: number | null;
}) {
  const t = useT();

  const [face, setFace] = useState(1);
  const settled = value != null && value > 0;

  /** Góc xoay của khối, tính bằng độ và cứ tăng lên mãi. */
  const spin = useSharedValue(0);
  /** Độ cao đang nảy, tính bằng pixel (âm là đang ở trên không). */
  const hop = useSharedValue(0);
  /** Vào màn: mờ → rõ, nhỏ → to (`diceFadeIn` 360ms của bản thiết kế). */
  const enter = useSharedValue(0);
  /** Nảy một cái lúc dừng: `scale 1.14` rồi về 1. */
  const pop = useSharedValue(1);
  /**
   * Đã chốt số chưa.
   *
   * ⚠️ Phải là shared value chứ không phải state: nó được đọc TRONG
   * `useAnimatedReaction`, tức trên UI thread.
   */
  const locked = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) });
  }, [enter]);

  useEffect(() => {
    if (!settled) {
      locked.value = 0;

      spin.value = withRepeat(
        withTiming(spin.value + 360, { duration: SPIN_MS, easing: Easing.linear }),
        -1,
        false,
      );

      hop.value = withRepeat(
        withSequence(
          ...HOPS.map((k) => withTiming(k.y, { duration: k.d, easing: Easing.out(Easing.quad) })),
        ),
        -1,
        false,
      );
      return;
    }

    /*
     * ⚠️ KHOÁ trước khi đặt số. Cú hạ cánh vẫn chạy nốt một nhịp; không khoá thì
     * mặt cuối cùng lại là số ngẫu nhiên, lệch hẳn với con số hiện bên dưới.
     * Đã dính đúng vậy.
     */
    cancelAnimation(spin);
    cancelAnimation(hop);
    locked.value = 1;
    setFace(value as number);

    // Xoay nốt cho tròn vòng -> khối dừng đúng tư thế đứng, không nghiêng lệch.
    spin.value = withTiming(Math.ceil(spin.value / 360) * 360, {
      duration: LAND_MS,
      easing: Easing.out(Easing.cubic),
    });
    hop.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });

    // `scale 1.16` rồi bật về 1 - đúng nhịp chốt của bản thiết kế.
    pop.value = withSequence(
      withTiming(1.16, { duration: 130 }),
      withSpring(1, { damping: 9, stiffness: 180 }),
    );
  }, [settled, value, spin, hop, pop, locked]);

  /*
   * Đổi mặt mỗi nhịp nảy - tức đúng lúc khối chạm "mặt bàn", chứ không phải giữa
   * lúc đang bay.
   *
   * ⚠️ Phải làm bằng `useAnimatedReaction`, không phải `setInterval`: đồng hồ cú
   * lăn sống trên UI thread, còn hẹn giờ ở JS thread sẽ lệch pha ngay khi luồng
   * JS bận nhận gói SignalR - mà lúc tung xúc xắc thì nó bận nhất.
   */
  useAnimatedReaction(
    () => Math.floor(spin.value / 120),
    (step, previous) => {
      if (locked.value) return;
      if (previous === null || step === previous) return;
      runOnJS(setFace)(1 + Math.floor(Math.random() * 6));
    },
    [],
  );

  const cubeStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: hop.value },
      { rotate: `${spin.value}deg` },
      // `diceFadeIn` của thiết kế bắt đầu ở scale .4 rồi lớn dần lên 1.
      { scale: pop.value * (0.4 + enter.value * 0.6) },
    ],
  }));

  const backdrop = useAnimatedStyle(() => ({ opacity: enter.value }));

  return (
    <Animated.View style={[styles.root, backdrop]} pointerEvents="none">
      <View style={styles.dieWrap}>
        <Animated.View style={cubeStyle}>
          <DiceCube value={face} size={SIZE} />
        </Animated.View>
      </View>

      <View style={styles.result}>
        <Text style={styles.label}>{settled ? t('dice.rolled') : t('dice.rolling')}</Text>
        {settled ? <Text style={styles.value}>{value}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /*
   * ⚠️ `pointerEvents="none"`: lớp này chỉ để NHÌN. Chặn chạm ở đây sẽ nuốt mất
   * cú chạm đầu tiên vào khung chọn hướng hiện ngay sau đó.
   */
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: 'rgba(6,3,18,0.76)',
  },

  // Cao hơn cạnh khối: viên xúc xắc còn nảy lên khỏi chỗ đứng.
  dieWrap: { width: SIZE, height: SIZE * 1.35, alignItems: 'center', justifyContent: 'flex-end' },

  result: { alignItems: 'center', gap: 4 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 2.6, color: 'rgba(200,170,255,0.7)' },
  value: {
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(157,107,255,0.85)',
    textShadowRadius: 24,
    textShadowOffset: { width: 0, height: 0 },
  },
});
