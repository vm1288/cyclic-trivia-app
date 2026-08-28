import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import type { GameQuestion } from '../api/game';
import { useT } from '../i18n/I18nProvider';
import { boardColors, fill } from './GameBoardParts';
import { GlowDivider } from './GlowDivider';
import { text } from '../theme/colors';

/**
 * Câu hỏi, phủ kín màn trong ván.
 *
 * Bố cục theo `designs/QuestionScreen.tsx`: thanh trên (nhãn - vạch sáng - đồng
 * hồ - SUBMIT), rồi một hàng chia đôi: câu hỏi bên trái, các đáp án bên phải.
 *
 * ⚠️ Màn này NẰM NGANG. Cột đáp án bên phải chỉ đủ chỗ vì màn ngang; đừng bê bố
 * cục này sang màn dọc.
 *
 * ⚠️ CHỌN rồi mới SUBMIT - hai bước, đúng như bản thiết kế VÀ bản web
 * (`PlayerQuestionForTurn.cshtml`, `selectAnswer` rồi `submitAnswer`). Đừng
 * "cho nhanh" bằng cách gửi luôn lúc chạm: người chơi chạm nhầm là mất lượt, mà
 * vòng đua thì không cho trả lời lại.
 *
 * ⚠️ KHÔNG có đáp án đúng ở client. Server cố ý `[JsonIgnore]` cả `IsCorrect`
 * lẫn `AnswerExplain`. Chấm điểm do server làm, kết quả về qua gói tin sau đó -
 * đừng tô xanh/đỏ ở đây, không có dữ liệu để tô.
 *
 * ⚠️ HẾT GIỜ PHẢI GỬI. Server đợi câu trả lời của từng người để biết vòng đua
 * xong chưa; im lặng là ván đứng đó. Vì vậy `onTimeout` chạy ngay cả khi người
 * chơi không chạm gì.
 */

/**
 * Bề ngang của khối nội dung bên trong khung.
 *
 * ⚠️ Bản thiết kế để 70% vì nó phủ CẢ MÀN HÌNH. Ở đây khung chỉ đè lên vùng bàn
 * cờ (cột trái) - vốn đã hẹp hơn nhiều - nên 70% nữa là chữ bị bóp. Giữ 100% và
 * để `padding` của khung lo phần lề.
 */
const CONTENT_WIDTH = '100%';

/*
 * MỌI đáp án cùng một màu - xanh, đúng kiểu ô "B" của bản thiết kế.
 *
 * ⚠️ Trước đây mỗi đáp án một màu riêng (tím / xanh / hổ phách / hồng) nên cả
 * bốn ô đã sáng sẵn khi chưa chọn gì, và ô vừa chọn chẳng nổi hơn. Giờ khác
 * biệt DUY NHẤT là ô đang chọn: nó chuyển VÀNG và nhấp nháy.
 */
const ANSWER_COLOR = '#7FC0FF';
const ANSWER_TINT = 'rgba(12,44,100,0.5)';
const ANSWER_BORDER = 'rgba(127,192,255,0.55)';

/** Màu của ô ĐANG chọn. */
const PICKED = '#FFC61E';

const VIOLET = '#8B5CF6';
const CYAN = '#5FE6FF';

/** A, B, C, D... */
const letter = (index: number) => String.fromCharCode(65 + index);

const mmss = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const ClockIcon = ({ color }: { color: string }) => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}
       strokeLinecap="round">
    <Circle cx={12} cy={13} r={8} />
    <Path d="M12 9.5v4" />
    <Path d="M9.5 3.5h5" />
  </Svg>
);

/**
 * Viền vàng nhấp nháy của đáp án đang chọn.
 *
 * Chạy bằng Reanimated trên UI THREAD, không phải state của React - đúng theo
 * AGENTS.md: luồng JS còn bận nhận gói tin SignalR, nhấp nháy bằng state sẽ
 * giật. Cùng cách làm với `TurnPulse` ở `GameBoardParts`.
 *
 * Là một LỚP PHỦ riêng chứ không phải style của chính ô: `boxShadow` là chuỗi
 * nên không nội suy được, còn `opacity` của lớp phủ thì có.
 */
const PickedPulse = ({ radius }: { radius: number }) => {
  const glow = useSharedValue(0.25);

  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [glow]);

  const style = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pickedPulse, { borderRadius: radius }, style]}
    />
  );
};

const ArrowIcon = ({ color = '#FFFFFF' }: { color?: string }) => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill={color}>
    <Path d="M5 3.5l16 8.5-16 8.5z" />
  </Svg>
);

export function QuestionOverlay({
  question,
  categories,
  durationSeconds,
  banner,
  onAnswer,
  onTimeout,
}: {
  question: GameQuestion;
  /**
   * Chuỗi chủ đề từ GỐC đi xuống - xem `categoryChain` trong `api/game.ts`.
   */
  categories: string[];
  durationSeconds: number;
  /**
   * Nhãn cố định cho ô góc trên bên trái, vd "WHO GOES FIRST?" của vòng đua.
   *
   * Bỏ trống với câu hỏi lượt thường: lúc đó ô đó là CHỦ ĐỀ GỐC, còn ô nhỏ bên
   * dưới lùi xuống thành chủ đề con đầu tiên.
   */
  banner?: string | null;
  onAnswer: (answerId: string, answerContent: string) => void;
  onTimeout: () => void;
}) {
  const t = useT();

  const [left, setLeft] = useState(durationSeconds);
  const [chosen, setChosen] = useState<string | null>(null);

  /*
   * ⚠️ Một câu hỏi chỉ được gửi ĐÚNG MỘT LẦN.
   *
   * Giữ trong `ref` chứ không phải state: cái chốt này phải ăn ngay trong cùng
   * một nhịp, mà state thì tới lần render sau mới đổi - đủ để bấm SUBMIT hai
   * lần liền tay lọt cả hai, hoặc để đồng hồ bắn `onTimeout` ngay sau khi người
   * chơi vừa gửi.
   */
  const sent = useRef(false);

  const timeout = useRef(onTimeout);
  timeout.current = onTimeout;

  useEffect(() => {
    sent.current = false;
    setChosen(null);
    setLeft(durationSeconds);
  }, [question.Id, durationSeconds]);

  useEffect(() => {
    const tick = setInterval(() => {
      setLeft((n) => (n > 0 ? n - 1 : 0));
    }, 1000);

    return () => clearInterval(tick);
  }, [question.Id]);

  /*
   * ⚠️ Bắn `onTimeout` Ở ĐÂY, trong một effect - KHÔNG phải bên trong hàm cập
   * nhật của `setLeft`.
   *
   * Hàm cập nhật của `setState` chạy TRONG lúc React render, nên gọi
   * `onTimeout` từ đó là gọi `setQuestion(null)` của màn cha giữa chừng:
   *
   *   Cannot update a component (`GameLandscapeScreen`) while rendering a
   *   different component (`QuestionOverlay`)
   *
   * Đã dính thật trên máy: đúng lúc hết giờ thì overlay biến mất kèm màn hình
   * lỗi đỏ. Effect chạy SAU render nên an toàn.
   */
  useEffect(() => {
    if (left > 0 || sent.current) return;
    sent.current = true;
    timeout.current();
  }, [left]);

  const submit = () => {
    if (sent.current || !chosen) return;
    const answer = question.Answers.find((a) => a.Id === chosen);
    if (!answer) return;
    sent.current = true;
    onAnswer(answer.Id, answer.Content);
  };

  const urgent = left <= 5;
  const clockColor = urgent ? '#FF6B78' : boardColors.purple;
  const canSubmit = !!chosen && !sent.current;

  /*
   * Hai ô nhãn LUÔN là chủ đề, không phải chữ "QUESTION" chết cứng:
   *
   *   vòng đua      ô lớn = "WHO GOES FIRST?"   ô nhỏ = chủ đề GỐC, rồi các con
   *   lượt thường   ô lớn = chủ đề GỐC          ô nhỏ = con đầu tiên, rồi phần còn lại
   *
   * Tức là có `banner` thì cả chuỗi chủ đề bị đẩy xuống một bậc.
   */
  const chip = banner ?? categories[0] ?? '';
  const rest = banner ? categories : categories.slice(1);
  const tagLabel = rest[0] ?? '';
  const trailing = rest.slice(1).join(' · ');

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0D1030', '#06061A', '#03030C']}
        locations={[0, 0.55, 1]}
        style={fill}
      />

      <View style={styles.content}>
        {/* ── thanh trên: nhãn — vạch sáng — đồng hồ — SUBMIT ── */}
        <View style={styles.topBar}>
          {chip ? (
            <View style={styles.bannerTag}>
              <Text style={styles.bannerText} numberOfLines={1}>
                {chip.toUpperCase()}
              </Text>
            </View>
          ) : null}

          <GlowDivider color="#1F6FD6" accent={CYAN} height={1.5} flareWidth={70} style={styles.rule} />

          {/* Đồng hồ đổi sang đỏ ở 5 giây cuối - nhìn được mà không cần đọc số. */}
          <View style={[styles.timerTag, urgent && styles.timerTagUrgent]}>
            <ClockIcon color={clockColor} />
            <Text style={[styles.timerText, { color: clockColor }]}>{mmss(left)}</Text>
          </View>

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              canSubmit ? styles.submitBtnOn : styles.submitBtnOff,
              pressed && canSubmit && styles.pressed,
            ]}
          >
            <Text style={[styles.submitText, !canSubmit && styles.submitTextOff]}>
              {t('question.submit')}
            </Text>
            <ArrowIcon color={canSubmit ? '#FFFFFF' : 'rgba(255,255,255,0.45)'} />
          </Pressable>
        </View>

        {/* ── hàng chính: câu hỏi — vạch dọc — đáp án ── */}
        <View style={styles.mainRow}>
          <View style={styles.questionCol}>
            {/*
              Bộ câu hỏi chỉ có một cấp chủ đề thì KHÔNG có gì để hiện ở đây -
              ẩn hẳn cả hàng thay vì để một ô rỗng.
            */}
            {tagLabel || trailing ? (
              <View style={styles.questionTagRow}>
                {tagLabel ? (
                  <View style={styles.questionTag}>
                    <Text style={styles.questionTagText} numberOfLines={1}>
                      {tagLabel.toUpperCase()}
                    </Text>
                  </View>
                ) : null}
                {trailing ? (
                  <Text style={styles.categoryText} numberOfLines={1}>
                    {trailing.toUpperCase()}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.questionText}>{question.Title}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.answersCol}>
            {question.Answers.map((answer, i) => {
              const picked = chosen === answer.Id;
              const color = picked ? PICKED : ANSWER_COLOR;

              return (
                <Pressable
                  key={answer.Id}
                  onPress={() => !sent.current && setChosen(answer.Id)}
                  disabled={sent.current}
                  style={({ pressed }) => [
                    styles.option,
                    { borderColor: picked ? PICKED : ANSWER_BORDER },
                    // Đã gửi rồi thì mờ hết đi, để rõ là không bấm được nữa.
                    sent.current && !picked && styles.optionDim,
                    pressed && !sent.current && styles.pressedSm,
                  ]}
                >
                  <LinearGradient
                    colors={
                      picked
                        ? ['rgba(84,60,4,0.55)', 'rgba(9,11,28,0.75)']
                        : [ANSWER_TINT, 'rgba(9,11,28,0.75)']
                    }
                    /*
                     * Bo góc cho CHÍNH gradient thay vì `overflow: 'hidden'` ở ô
                     * cha: `overflow` cắt luôn quầng sáng của viền nhấp nháy.
                     */
                    style={[fill, styles.optionFill]}
                  />

                  {picked ? <PickedPulse radius={10} /> : null}

                  <View style={[styles.optionBadge, { borderColor: color }]}>
                    <Text style={[styles.optionBadgeText, { color }]}>{letter(i)}</Text>
                  </View>

                  {/*
                   * Bản thiết kế để `numberOfLines={1}`, ở đây cho 2 dòng: đáp án
                   * thật lấy từ DB dài hơn nhiều so với chuỗi mẫu trong thiết kế,
                   * và cắt cụt đáp án là người chơi chọn mò.
                   */}
                  <Text
                    style={[styles.optionText, picked && { color: PICKED }]}
                    numberOfLines={2}
                  >
                    {answer.Content}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * Phủ kín VÙNG BÀN CỜ (component này là con của `boardCol`), và CHẶN chạm
   * xuống dưới.
   *
   * Không có `pointerEvents="none"` ở đây là cố ý: đang có câu hỏi thì không
   * được chạm vào bàn cờ phía sau.
   *
   * `zIndex` chỉ là đai an toàn cho thứ tự VẼ. Thứ quyết định việc nhận chạm
   * trên Android là VỊ TRÍ TRONG CÂY - component này phải được render SAU
   * `BoardCanvas` (xem ghi chú ở `game-landscape.tsx`).
   */
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: 'rgba(95,230,255,0.35)',
    backgroundColor: '#04040E',
    // `hidden` để nền gradient không tràn ra ngoài góc bo.
    overflow: 'hidden',
    boxShadow: '0 0 20px rgba(31,111,214,0.35)',
  },

  content: {
    flex: 1,
    width: CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  bannerTag: {
    height: 28,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    borderWidth: 1.3,
    borderColor: 'rgba(95,230,255,0.55)',
    backgroundColor: 'rgba(8,26,34,0.9)',
    boxShadow: '0 0 12px rgba(95,230,255,0.28)',
  },
  bannerText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: CYAN },

  rule: { flex: 1 },

  timerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.3,
    borderColor: 'rgba(200,107,255,0.55)',
    backgroundColor: 'rgba(52,18,96,0.85)',
    boxShadow: '0 0 12px rgba(200,107,255,0.3)',
  },
  timerTagUrgent: {
    borderColor: 'rgba(255,59,78,0.6)',
    backgroundColor: 'rgba(70,8,20,0.85)',
    boxShadow: '0 0 12px rgba(255,59,78,0.3)',
  },
  timerText: { fontSize: 13, fontWeight: '800' },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 28,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.4,
  },
  submitBtnOn: {
    borderColor: VIOLET,
    backgroundColor: 'rgba(51,25,94,0.95)',
    boxShadow: `0 0 14px ${VIOLET}73`,
  },
  /*
   * Chưa chọn gì thì nút tắt hẳn quầng sáng, không chỉ mờ chữ.
   *
   * Hai style TÁCH RỜI chứ không phải một style rồi ghi đè `boxShadow: 'none'`:
   * `boxShadow` của RN nhận chuỗi CSS, và ghi đè bằng chuỗi rỗng/`none` là hành
   * vi không được bảo đảm - dựng riêng nhánh "có sáng" an toàn hơn.
   */
  submitBtnOff: {
    borderColor: 'rgba(139,92,246,0.4)',
    backgroundColor: 'rgba(26,18,46,0.85)',
  },
  submitText: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: text.primary },
  submitTextOff: { color: 'rgba(255,255,255,0.45)' },

  pressed: { transform: [{ scale: 0.96 }] },
  pressedSm: { transform: [{ scale: 0.98 }] },

  mainRow: { flex: 1, flexDirection: 'row', alignItems: 'stretch', gap: 14 },

  questionCol: { flex: 1.05, justifyContent: 'center', gap: 9 },
  questionTagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  questionTag: {
    height: 24,
    paddingHorizontal: 12,
    borderRadius: 6,
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(127,192,255,0.5)',
    backgroundColor: 'rgba(10,13,34,0.85)',
  },
  questionTagText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.3, color: text.primary },
  categoryText: { flex: 1, fontSize: 10.5, fontWeight: '600', letterSpacing: 0.4, color: boardColors.dim },
  questionText: { fontSize: 15, lineHeight: 21, color: '#EAF1FF' },

  divider: { width: 1, backgroundColor: 'rgba(110,140,210,0.5)' },

  answersCol: { flex: 1, justifyContent: 'center', gap: 6 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1.4,
  },
  optionFill: { borderRadius: 10 },
  optionDim: { opacity: 0.35 },
  pickedPulse: {
    position: 'absolute',
    top: -1.4,
    left: -1.4,
    right: -1.4,
    bottom: -1.4,
    borderWidth: 1.8,
    borderColor: PICKED,
    boxShadow: '0 0 12px rgba(255,198,30,0.9), 0 0 24px rgba(255,198,30,0.4)',
  },
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,11,28,0.6)',
  },
  optionBadgeText: { fontSize: 13, fontWeight: '800' },
  optionText: { flex: 1, fontSize: 13.5, lineHeight: 17, fontWeight: '600', color: '#EAF1FF' },
});
