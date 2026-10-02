import { useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { RewardGlyph } from './RewardGlyph';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '../i18n/I18nProvider';
import { htmlToText } from '../utils/htmlToText';
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
 * ⚠️ HAI KHỔ, MỘT COMPONENT — rẽ bằng prop `compact` (ca **UI-2/3/4**):
 *
 *   `compact` (mặc định)  bàn cờ đang hiện, khung này chỉ được phần giữa bàn cờ
 *   đầy đủ                bàn cờ đã ẩn, khung được cả cột trái
 *
 * ⚠️ Khổ đầy đủ KHÔNG phải tôi tự nghĩ ra. Bản web đã có sẵn đúng hai khổ này
 * cho cùng một thông báo, rẽ ở `RenderCorrectAnswer(..., isMain, ...)`
 * (`PublicController.Player.cs`):
 *
 *   `isMain: true`  → `CorrectAnswerV2.cshtml` — BÀN CỜ: đáp án đúng in to,
 *                     dấu ✓, giải thích, rồi mới tới tên + điểm
 *   `isMain: false` → `CorrectAnswer.cshtml`   — MÁY NGƯỜI CHƠI: chỉ dấu ✓,
 *                     tên, điểm
 *
 * Ẩn bàn cờ đi thì chính máy này đóng vai bàn cờ, nên nó lấy khổ của bàn cờ.
 *
 * ⚠️ Chỉ khi trả lời ĐÚNG mới có đáp án + giải thích. Sai thì bản web
 * (`WrongAnswer.cshtml`) cũng không in chữ nào của đáp án: lúc đó những người
 * khác CÒN ĐANG tranh trả lời chính câu đó. Đừng "tận dụng chỗ trống" ở nhánh
 * sai.
 */

type TurnResultKind =
  /** Mình (hoặc người khác - xem `name`) trả lời đúng. */
  | {
      kind: 'correct';
      point: number;
      earnedStar: boolean;
      rollAgain?: 2 | 3;
      /**
       * Đáp án vừa chọn - đúng nên nó CHÍNH LÀ đáp án đúng.
       *
       * Cùng chuỗi máy gửi lên trong `questionTitle` của `submitAnswer`, và cũng
       * chính là chuỗi bàn cờ web in to giữa màn (`Model.questionTitle` trong
       * `CorrectAnswerV2.cshtml`). Cả hai khổ (K97).
       */
      answerText?: string;
      /**
       * Giải thích đáp án, server trả kèm trong response của `submitAnswer`.
       *
       * ⚠️ KHÔNG đi kèm câu hỏi lúc gửi đề - `AnswerExplain` bị `[JsonIgnore]`
       * ở `LocalizedQuestionDto`. Chỗ duy nhất nó ra khỏi server là response
       * của lượt trả lời ĐÚNG. Rỗng là chuyện thường (câu chưa có giải thích,
       * hoặc bàn không phải crictriv/footietriv).
       */
      explain?: string;
    }
  /**
   * Ô 10 giây - trọng tài chấm ĐẠT (gói 95, K98). Tên ở `name`. Chép
   * `MainTenSecondChallengePass.cshtml`: "{name} passed Challenge!" / "{point} runs." ★ /
   * "Your second roll please".
   */
  | { kind: 'challengePass'; point: number; earnedStar: boolean; rollAgain?: 2 | 3 }
  /** Ô 10 giây - trọng tài chấm TRƯỢT (gói 95). `TenSecondChallengeFail.cshtml`: "{name} failed Challenge!". */
  | { kind: 'challengeFail' }
  /**
   * Mình trả lời sai. `main` (K103): mình là NGƯỜI TỚI LƯỢT thì có dòng "The others are
   * racing to answer correctly" (`PlayerWrongAnswer.cshtml`); mình chỉ TRANH trả lời thì
   * không (`OtherPlayerWrongAnswer.cshtml` chỉ "You got it wrong!") - Tony 09-17.
   */
  | { kind: 'wrong'; main?: boolean }
  /** Mình hết giờ, không kịp trả lời. `main` như trên. */
  | { kind: 'timeout'; main?: boolean }
  /** Có người chốt câu trước mình. */
  | { kind: 'late'; by?: string }
  /** K116: vòng đua - mình sai, người khác còn đang trả lời. Đứng tới khi có kết quả chung. */
  | { kind: 'raceWrong' };

/**
 * `name`: tên người trả lời khi tấm là của NGƯỜI KHÁC (gói 93, K94). Bỏ trống =
 * tấm của chính máy này, màn bàn cờ điền tên mình.
 */
export type TurnResult = TurnResultKind & {
  name?: string;
  /**
   * K100: lời chào lượt kế ("It's Maya's go" / "So Tony, it's your go") tới trong lúc tấm này
   * đang hiện thì GẮN VÀO tấm - như bàn cờ web in "Now it's the turn of X" ngay dưới kết quả -
   * thay vì xếp hàng rồi bị xúc xắc của người kế nuốt mất.
   */
  nextTurnText?: string;
};

export function TurnResultOverlay({
  result,
  /** Tên người vừa trả lời - bản web luôn nêu tên, không nói trống không. */
  name,
  /** "runs" / "goals" / "points" tuỳ bàn - xem `MoveDirectionOverlay`. */
  unit,
  oneUnit,
  /**
   * Bàn cờ đang chiếm chỗ hay không.
   *
   * `true` (mặc định) = khổ gọn. Mặc định phải là gọn vì đó là trạng thái
   * thường trực của ván; khổ đầy đủ chỉ xuất hiện khi người chơi chủ động ẩn
   * bàn cờ đi.
   */
  compact = true,
}: {
  result: TurnResult;
  name: string;
  unit: string;
  /** K116: dạng số ít ("1 run" thay "1 runs"); thiếu thì dùng `unit`. */
  oneUnit?: string;
  compact?: boolean;
}) {
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
    result.kind === 'correct' || result.kind === 'challengePass'
      ? { line: boardColors.green, tint: 'rgba(6,54,22,0.96)' }
      : result.kind === 'wrong' || result.kind === 'timeout' || result.kind === 'challengeFail' || result.kind === 'raceWrong'
        ? { line: boardColors.red, tint: 'rgba(58,8,16,0.96)' }
        : { line: boardColors.amber, tint: 'rgba(52,40,4,0.96)' };

  /*
   * ⚠️ Hai dòng này chép ĐÚNG cấu trúc view của bản web - tên ở dòng trên, chi
   * tiết ở dòng dưới. Đừng đổi thành khẩu hiệu ngắn kiểu "CORRECT!" / "WRONG":
   * chữ này team đã thống nhất, người chơi web và app phải đọc cùng một câu.
   *
   *   correct -> CorrectAnswer.cshtml       "{name} got it right!" / "{point} runs."
   *   wrong   -> PlayerWrongAnswer.cshtml   "{name} got it wrong!" / "The others are racing…"
   *   timeout -> PlayerTimeoutAnswer.cshtml "{name}, you're out of time!" / "The others are racing…"
   *   late    -> OtherCorrectAnswer.cshtml  "{name}" / "got it right first!"
   */
  const title =
    result.kind === 'correct'
      ? t('result.correct', { name })
      : result.kind === 'challengePass'
        ? t('result.challengePass', { name })
        : result.kind === 'challengeFail'
          ? t('result.challengeFail', { name })
          : result.kind === 'wrong'
            ? t('result.wrong', { name })
            : result.kind === 'timeout'
              ? t('result.timeout', { name })
              : result.kind === 'raceWrong'
                ? t('result.raceWrong')
                : t('result.lateBy', { name: result.by ?? '' });

  /* Trượt thử thách: web chỉ có một dòng tên + "Y It's your go" - dòng sau là tấm chào lượt lo. */
  const body =
    result.kind === 'correct' || result.kind === 'challengePass'
      ? t('result.earned', { point: result.point, unit: result.point === 1 && oneUnit ? oneUnit : unit })
      : result.kind === 'wrong' || result.kind === 'timeout'
        /* Tấm của NGƯỜI KHÁC sai/hết giờ (K100): người xem chính là người sắp tranh trả lời.
           Người sai chỉ là người TRANH - mình (K103) hay người khác (Tony 2/10): không có dòng dưới. */
        ? result.main === false
          ? ''
          : result.name
            ? t('result.wrongBodyOthers')
            : t('result.wrongBody')
        : result.kind === 'challengeFail'
          ? ''
          : result.kind === 'raceWrong'
            ? t('result.raceWrongBody')
            : t('result.late');

  /*
   * Bản web hiện thêm dòng này khi người chơi còn lượt tung nữa. Tấm của NGƯỜI KHÁC
   * (`result.name`) thì nói về họ: "Maya's second roll" (K100).
   */
  const extra =
    (result.kind === 'correct' || result.kind === 'challengePass') && result.rollAgain
      ? result.name
        ? t(result.rollAgain === 3 ? 'result.rollAgainThirdOther' : 'result.rollAgainSecondOther', { name })
        : t(result.rollAgain === 3 ? 'result.rollAgainThird' : 'result.rollAgainSecond')
      : null;

  /*
   * Khối "đáp án đúng + giải thích" - ở CẢ HAI khổ.
   *
   * Tony (09-16, K97): *"web có show câu giải thích đáp án"* - bàn cờ web in
   * `CorrectAnswerV2.cshtml` (đáp án + giải thích) cho cả phòng xem, mà app là
   * cả ghế lẫn bàn cờ, nên khổ gọn (trạng thái thường trực) cũng phải in. Trước
   * 09-16 khối này chỉ có ở khổ đầy đủ vì tưởng "bàn cờ đang hiện thì không có
   * chỗ" - thực ra tấm nằm đè lên bàn cờ, cao thêm vài dòng không sao. Khổ gọn
   * dùng cỡ chữ nhỏ hơn (`answerTextCompact` / `explainCompact`).
   *
   * ⚠️ Hai điều kiện, thiếu một là không hiện:
   *   - `correct`   : sai thì người khác còn đang tranh trả lời câu đó
   *   - có nội dung : câu chưa nhập giải thích thì `explain` rỗng, mà một cái
   *                   khung rỗng lửng lơ trông như lỗi
   */
  const answerBlock =
    result.kind === 'correct' && (result.answerText || result.explain)
      ? { answerText: result.answerText ?? '', explain: result.explain ?? '' }
      : null;

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View
        style={[styles.card, compact ? null : styles.cardFull, { borderColor: tone.line }, card]}
      >
        <LinearGradient colors={[tone.tint, 'rgba(10,12,34,0.96)']} style={[fill, styles.cardFill]} />

        {answerBlock ? (
          <View style={styles.answerBlock}>
            {answerBlock.answerText ? (
              <View style={styles.answerRow}>
                {/*
                  Chép bố cục của `CorrectAnswerV2.cshtml`: đáp án nằm trong một
                  mảng nền sáng, dấu ✓ đứng NGAY BÊN PHẢI chứ không phải trên
                  đầu - để mắt đọc một mạch "đáp án đúng" thay vì hai vật rời.
                */}
                <Text style={[styles.answerText, compact ? styles.answerTextCompact : null]} numberOfLines={3}>
                  {htmlToText(answerBlock.answerText)}
                </Text>
                <Text style={[styles.answerTick, { color: tone.line }]}>✓</Text>
              </View>
            ) : null}

            {answerBlock.explain ? (
              <Text style={[styles.explain, compact ? styles.explainCompact : null]} numberOfLines={compact ? 3 : 4}>
                {htmlToText(answerBlock.explain)}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text
          style={[styles.title, compact ? null : styles.titleFull, { color: tone.line }]}
          numberOfLines={2}
        >
          {title}
        </Text>

        {body ? (
        <View style={styles.bodyRow}>
          <Text style={[styles.body, compact ? null : styles.bodyFull]} numberOfLines={2}>
            {body}
          </Text>
          {/* Sao chỉ hiện khi thật sự được cộng - xem `earnedStar`. */}
          {(result.kind === 'correct' || result.kind === 'challengePass') && result.earnedStar ? (
            <RewardGlyph size={20} />
          ) : null}
        </View>
        ) : null}

        {extra ? (
          <Text style={styles.extra} numberOfLines={1}>
            {extra}
          </Text>
        ) : null}

        {result.nextTurnText ? (
          <Text style={[styles.extra, styles.nextTurn]} numberOfLines={1}>
            {result.nextTurnText}
          </Text>
        ) : null}
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
  /*
   * Khổ đầy đủ: rộng gần hết cột trái. Không đặt chiều cao - khung phải co theo
   * nội dung, vì nhánh sai/hết giờ vẫn chỉ có hai dòng.
   */
  cardFull: { maxWidth: '96%', paddingHorizontal: 20, paddingVertical: 16, gap: 8 },
  cardFill: { borderRadius: 16 },
  answerBlock: { alignItems: 'center', gap: 6, paddingBottom: 2 },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  answerText: {
    flexShrink: 1,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: '#fff',
    /* Mảng nền sáng - `class="answer-background"` của bản web. */
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  answerTextCompact: { fontSize: 16, lineHeight: 21 },
  answerTick: { fontSize: 22, fontWeight: '900' },
  explain: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    color: 'rgba(226,232,255,0.9)',
  },
  explainCompact: { fontSize: 12.5, lineHeight: 17 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: 0.8, textAlign: 'center' },
  titleFull: { fontSize: 24, lineHeight: 30 },
  bodyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  body: { fontSize: 13, fontWeight: '600', color: text.primary, textAlign: 'center' },
  bodyFull: { fontSize: 16 },
  /* Cùng vàng với hàng sao ở ô người chơi, để mắt nối được hai chỗ với nhau. */
  extra: { fontSize: 13, color: 'rgba(226,232,255,0.85)', textAlign: 'center', marginTop: 2 },
  /* Lời chào lượt kế gắn vào tấm - cùng xanh lá với tấm chào lượt đứng riêng. */
  nextTurn: { color: '#7CF29A', fontWeight: '700' },
});
