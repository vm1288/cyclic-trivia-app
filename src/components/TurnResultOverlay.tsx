import { useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '../i18n/I18nProvider';
import { boardColors, fill } from './GameBoardParts';
import { text } from '../theme/colors';

/**
 * Kết quả một câu trả lời, hiện GIỮA BÀN CỜ.
 *
 * Bản web hiện đúng chỗ này bằng `BoardMessage` mang HTML
 * (`CorrectAnswer.cshtml`, `WrongAnswer.cshtml`, `TooLateAnswer.cshtml`,
 * `OtherPlayerWrongAnswer.cshtml`). App không hiển thị được HTML đó nên tự dựng,
 * lấy dữ liệu từ HTTP response của chính lượt trả lời (đúng/sai/điểm/sao) và từ
 * gói `TimeoutQuestion` (ai nhanh hơn).
 *
 * ⚠️ Sau này khi làm nút ẨN BÀN CỜ thì đây là chỗ rẽ nhánh: bàn cờ TẮT thì hiện
 * khung đầy đủ (câu hỏi + đáp án đúng + điểm), bàn cờ BẬT thì vẫn gọn như bây
 * giờ vì bàn cờ đang chiếm chỗ. Giữ nguyên một component, thêm prop `compact`.
 */

export type TurnResult =
  /** Mình trả lời đúng. */
  | { kind: 'correct'; point: number; earnedStar: boolean }
  /** Mình trả lời sai. */
  | { kind: 'wrong' }
  /** Có người chốt câu trước mình. */
  | { kind: 'late'; by?: string };

export function TurnResultOverlay({ result }: { result: TurnResult }) {
  const t = useT();

  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.back(1.4)) });
  }, [enter, result]);

  const card = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.88 + enter.value * 0.12 }],
  }));

  const tone =
    result.kind === 'correct'
      ? { line: boardColors.green, tint: 'rgba(6,54,22,0.96)' }
      : result.kind === 'wrong'
        ? { line: boardColors.red, tint: 'rgba(58,8,16,0.96)' }
        : { line: boardColors.amber, tint: 'rgba(52,40,4,0.96)' };

  const title =
    result.kind === 'correct'
      ? t('result.correct')
      : result.kind === 'wrong'
        ? t('result.wrong')
        : result.by
          ? t('result.lateBy', { name: result.by })
          : t('result.late');

  const body =
    result.kind === 'correct'
      ? t('result.earned', { point: result.point })
      : result.kind === 'wrong'
        ? t('result.wrongBody')
        : t('result.lateBody');

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.card, { borderColor: tone.line }, card]}>
        <LinearGradient colors={[tone.tint, 'rgba(10,12,34,0.96)']} style={[fill, styles.cardFill]} />

        <Text style={[styles.title, { color: tone.line }]} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.bodyRow}>
          <Text style={styles.body} numberOfLines={2}>
            {body}
          </Text>
          {/* Sao chỉ hiện khi thật sự được cộng - xem `earnedStar`. */}
          {result.kind === 'correct' && result.earnedStar ? (
            <Text style={styles.star}>★</Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Không chặn chạm: ngay sau kết quả là bước tiếp theo của lượt. */
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    maxWidth: '80%',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.6,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  cardFill: { borderRadius: 16 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: 0.8, textAlign: 'center' },
  bodyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  body: { fontSize: 13, fontWeight: '600', color: text.primary, textAlign: 'center' },
  /* Cùng vàng với hàng sao ở ô người chơi, để mắt nối được hai chỗ với nhau. */
  star: { fontSize: 20, lineHeight: 26, color: '#FFD23F' },
});
