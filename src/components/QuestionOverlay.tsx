import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GameQuestion } from '../api/game';
import { boardColors } from './GameBoardParts';
import { neon, text } from '../theme/colors';

/**
 * Câu hỏi, phủ kín màn trong ván.
 *
 * ⚠️ Màn này NẰM NGANG. Đáp án xếp 2×2 chứ không phải một cột dọc - bốn đáp án
 * xếp dọc trên màn cao ~390dp là mỗi ô còn ~60dp, chữ dài bị cắt.
 *
 * ⚠️ KHÔNG có đáp án đúng ở client. Server cố ý `[JsonIgnore]` cả `IsCorrect`
 * lẫn `AnswerExplain`. Chấm điểm do server làm, kết quả về qua gói tin sau đó -
 * đừng tô xanh/đỏ ở đây, không có dữ liệu để tô.
 *
 * ⚠️ HẾT GIỜ PHẢI GỬI. Server đợi câu trả lời của từng người để biết vòng đua
 * xong chưa; im lặng là ván đứng đó. Vì vậy `onTimeout` chạy ngay cả khi người
 * chơi không chạm gì.
 */
export function QuestionOverlay({
  question,
  category,
  durationSeconds,
  onAnswer,
  onTimeout,
}: {
  question: GameQuestion;
  category?: string | null;
  durationSeconds: number;
  onAnswer: (answerId: string, answerContent: string) => void;
  onTimeout: () => void;
}) {
  const [left, setLeft] = useState(durationSeconds);
  const [chosen, setChosen] = useState<string | null>(null);

  /*
   * ⚠️ Một câu hỏi chỉ được gửi ĐÚNG MỘT LẦN.
   *
   * Giữ trong `ref` chứ không phải state: cái chốt này phải ăn ngay trong cùng
   * một nhịp, mà state thì tới lần render sau mới đổi - đủ để bấm hai đáp án
   * liền tay lọt cả hai, hoặc để đồng hồ bắn `onTimeout` ngay sau khi người chơi
   * vừa chọn.
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
      setLeft((n) => {
        if (n <= 1) {
          clearInterval(tick);
          if (!sent.current) {
            sent.current = true;
            timeout.current();
          }
          return 0;
        }
        return n - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [question.Id]);

  const pick = (answerId: string, content: string) => {
    if (sent.current) return;
    sent.current = true;
    setChosen(answerId);
    onAnswer(answerId, content);
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.head}>
          {category ? <Text style={styles.category}>{category}</Text> : <View />}
          {/* Đồng hồ đổi sang đỏ ở 5 giây cuối - nhìn được mà không cần đọc số. */}
          <View style={[styles.clock, left <= 5 && styles.clockLow]}>
            <Text style={[styles.clockText, left <= 5 && styles.clockTextLow]}>{left}</Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={3}>
          {question.Title}
        </Text>

        <View style={styles.answers}>
          {question.Answers.map((answer) => {
            const picked = chosen === answer.Id;
            return (
              <Pressable
                key={answer.Id}
                onPress={() => pick(answer.Id, answer.Content)}
                disabled={sent.current}
                style={({ pressed }) => [
                  styles.answer,
                  picked && styles.answerPicked,
                  // Đã gửi rồi thì mờ hết đi, để rõ là không bấm được nữa.
                  sent.current && !picked && styles.answerDim,
                  pressed && !sent.current && styles.answerPressed,
                ]}
              >
                <Text style={[styles.answerText, picked && styles.answerTextPicked]} numberOfLines={2}>
                  {answer.Content}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * Phủ kín, và CHẶN chạm xuống dưới.
   *
   * Không có `pointerEvents="none"` ở đây là cố ý: đang có câu hỏi thì không
   * được bấm xúc xắc hay bất cứ thứ gì của bàn cờ phía sau.
   */
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3,3,15,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },

  card: {
    width: '100%',
    maxWidth: 760,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: neon.purple.stroke,
    backgroundColor: '#080C1E',
    padding: 14,
    gap: 10,
    boxShadow: `0 0 24px rgba(${neon.purple.rgb},0.35)`,
  },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  category: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: boardColors.blueSoft,
    textTransform: 'uppercase',
  },
  clock: {
    minWidth: 38,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(47,143,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockLow: { borderColor: boardColors.red },
  clockText: { fontSize: 15, fontWeight: '800', color: boardColors.blue },
  clockTextLow: { color: boardColors.red },

  title: { fontSize: 17, lineHeight: 23, fontWeight: '700', color: text.primary },

  /* 2×2 - xem ghi chú đầu file về vì sao không xếp một cột. */
  answers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  answer: {
    // `48%` chứ không phải `50%`: còn chỗ cho `gap` mà không tràn sang hàng ba.
    width: '48%',
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: boardColors.hair,
    backgroundColor: 'rgba(10,13,34,0.9)',
    justifyContent: 'center',
  },
  answerPressed: { opacity: 0.75 },
  answerPicked: {
    borderColor: boardColors.green,
    boxShadow: '0 0 14px rgba(46,232,95,0.45)',
  },
  answerDim: { opacity: 0.35 },
  answerText: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: text.primary },
  answerTextPicked: { color: boardColors.green },
});
