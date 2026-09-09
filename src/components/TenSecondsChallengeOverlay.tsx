import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useT } from '../i18n/I18nProvider';
import { boardColors, fill } from './GameBoardParts';
import { GlowDivider } from './GlowDivider';

/**
 * Ô **10-SEC CHALLENGE** - BA nhịp, không phải hai.
 *
 * Luật, đọc từ `ChallengeSquareResolver` + `Helper.GetMainAppendixQuestions` +
 * `mainHandlers.js` + hai template Vue của bản web:
 *
 * Người tới lượt rơi vào ô `challenge`. Server bốc một đề bài ngẫu nhiên và bốc
 * ngẫu nhiên MỘT người khác làm TRỌNG TÀI. Đề bài có hai loại:
 *
 *   `AppendixType = "A"` - thử thách thể chất ("đứng một chân nhắm mắt 10 giây",
 *                          "uống hết cốc nước trong 10 giây"...). CHỈ trọng tài
 *                          nhận gói 42, `Words` rỗng.
 *   `AppendixType = "B"` - có phần đọc/học. MỌI người còn lại nhận gói 42:
 *                          · `skipB = false` -> mỗi người được chia `Words` để đọc to
 *                          · `skipB = true`  -> không chia lời (tongue-twister,
 *                            dãy chữ cái, danh sách từ), `Words` RỖNG nhưng
 *                            `TotalReaders` vẫn > 0
 *
 * Ba nhịp:
 *
 *   `'assign'` (gói 42) - chia vai. Ai có `words` thì hiện lời để đọc; **nút
 *                         Start CHỈ trọng tài mới có**. Người đọc không có nút
 *                         nào, đọc xong thì chờ.
 *   `'run'`    (gói 30) - MỌI người nhận, để ai cũng đọc được ĐỀ BÀI. Hiện đề
 *                         bài + đếm ngược 10 giây. **Chỉ TRỌNG TÀI mới gửi gói
 *                         43** khi hết giờ (`ownsCountdown` ở `game-landscape`),
 *                         hai máy cùng gửi là server mở màn phán quyết hai lần.
 *                         Đây chính là phần bàn cờ web làm trong
 *                         `handleTenSecondsChallenge` -> `startCountdown(...)`.
 *   `'judge'`  (gói 43) - trọng tài phán quyết. Bản web KHÔNG có đồng hồ ở màn
 *                         này, nên ở đây cũng không.
 *
 * ⚠️ Đếm ngược là **10 giây**, lấy từ `CountdownSeconds` của gói 30. KHÔNG phải
 * `Constants.TenSecondChallenge` (= 20) - con số đó chỉ là hạn watchdog server.
 *
 * ⚠️ Nhịp `assign` KHÔNG có đồng hồ, cố ý: thử thách chỉ bắt đầu tính giờ sau
 * khi trọng tài bấm Start (chính gói 42 gửi về mới arm watchdog ở server).
 */

const ClockIcon = ({ color }: { color: string }) => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}
       strokeLinecap="round">
    <Circle cx={12} cy={13} r={8} />
    <Path d="M12 9.5v4" />
    <Path d="M9.5 3.5h5" />
  </Svg>
);

/**
 * "1st / 2nd / 3rd / 4th" - chép nguyên hàm `ordinal` của
 * `PlayerTenSecondsChallengeStart.cshtml`, kể cả nhánh 11/12/13.
 */
const ordinal = (n: number) => {
  const r100 = n % 100;
  if (r100 >= 11 && r100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
};

/**
 * Đề bài của nhánh tongue-twister được ghép chuỗi kèm `<br>` và `<strong>` ngay
 * trong C# (`Helper.cs`), nên tới app là HTML thật. Gỡ thẻ ra thành chữ thuần.
 */
const stripHtml = (raw: string) =>
  (raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();

export type ChallengePhase = 'assign' | 'run' | 'judge';

export function TenSecondsChallengeOverlay({
  phase,
  words,
  isJudge,
  readerNumber,
  totalReaders,
  title,
  studyText,
  appendixType,
  challengedName,
  judgeName,
  totalPlayers,
  countdownSeconds,
  onStart,
  onCountdownDone,
  onVerdict,
}: {
  phase: ChallengePhase;
  words: string[];
  isJudge: boolean;
  readerNumber: number;
  totalReaders: number;
  /** Đề bài (nhịp `run`). Có thể chứa HTML - đã gỡ thẻ trước khi hiện. */
  title: string;
  /** Chữ để học thuộc, hiện to đậm. Rỗng thì không có. */
  studyText: string;
  appendixType: string;
  /** Người BỊ CHẤM. */
  challengedName: string;
  /** TRỌNG TÀI. */
  judgeName: string;
  totalPlayers: number;
  countdownSeconds: number;
  /** Nhịp `assign`, chỉ trọng tài: gửi LẠI gói 42. */
  onStart: () => void;
  /** Nhịp `run`: hết 10 giây -> gửi gói 43. */
  onCountdownDone: () => void;
  /** Nhịp `judge`: phán quyết. */
  onVerdict: (isPass: boolean) => void;
}) {
  const t = useT();

  const [left, setLeft] = useState(countdownSeconds || 10);

  /** Một nhịp chỉ gửi ĐÚNG MỘT LẦN - cùng lý do với `QuestionOverlay`. */
  const sent = useRef(false);
  const done = useRef(onCountdownDone);
  done.current = onCountdownDone;

  useEffect(() => {
    sent.current = false;
    setLeft(countdownSeconds || 10);
  }, [phase, countdownSeconds]);

  /* Đồng hồ CHỈ chạy ở nhịp `run` - bản web cũng chỉ đếm ở bàn cờ. */
  useEffect(() => {
    if (phase !== 'run') return;
    const tick = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, [phase]);

  /* Hết giờ bắn trong EFFECT, không bắn trong `setInterval` - cùng lý do với `QuestionOverlay`. */
  useEffect(() => {
    if (phase !== 'run' || left > 0 || sent.current) return;
    sent.current = true;
    done.current();
  }, [phase, left]);

  const start = () => {
    if (sent.current) return;
    sent.current = true;
    onStart();
  };

  const verdict = (isPass: boolean) => {
    if (sent.current) return;
    sent.current = true;
    onVerdict(isPass);
  };

  const hasWords = words.length > 0;
  const urgent = left <= 3;
  const clockColor = urgent ? '#FF6B78' : boardColors.purple;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#2A1030', '#12061A', '#04030C']}
        locations={[0, 0.55, 1]}
        style={fill}
      />

      <View style={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.bannerTag}>
            <Text style={styles.bannerText} numberOfLines={1}>
              {t('challenge.title')}
            </Text>
          </View>

          <GlowDivider color="#C86BFF" accent="#FFC61E" height={1.5} flareWidth={70} style={styles.rule} />

          {phase === 'run' ? (
            <View style={[styles.timerTag, urgent && styles.timerTagUrgent]}>
              <ClockIcon color={clockColor} />
              <Text style={[styles.timerText, { color: clockColor }]}>{left}</Text>
              <Text style={styles.timerLabel}>{t('challenge.timeLeft')}</Text>
            </View>
          ) : null}
        </View>

        {/*
          ============================================================
          NHỊP 'assign' - gói 42. Điều kiện chép ĐÚNG từ
          `PlayerTenSecondsChallengeStartPartialHtml.cshtml`:
          mọi dòng lời đều gác theo `words.length`, KHÔNG phải `totalReaders`,
          và NÚT START CHỈ TRỌNG TÀI MỚI CÓ.
          ============================================================
        */}
        {phase === 'assign' ? (
          <>
            {hasWords && totalReaders > 1 ? (
              <Text style={styles.role} numberOfLines={2}>
                {t('challenge.reader').replace('{ordinal}', ordinal(readerNumber))}
              </Text>
            ) : null}

            {hasWords ? (
              <>
                <Text style={styles.wordsLabel}>{t('challenge.words')}</Text>
                <ScrollView
                  style={styles.wordBox}
                  contentContainerStyle={styles.wordWrap}
                  showsVerticalScrollIndicator={false}
                >
                  {words.map((w, i) => (
                    <View key={`${w}-${i}`} style={styles.wordChip}>
                      <Text style={styles.wordText}>{w.toUpperCase()}</Text>
                    </View>
                  ))}
                </ScrollView>

                <Text style={styles.prompt} numberOfLines={2}>
                  {totalReaders > 1 ? t('challenge.readAloudTurn') : t('challenge.readAloud')}
                </Text>
              </>
            ) : (
              <View style={styles.spacer} />
            )}

            {isJudge ? (
              <>
                <Text style={styles.footNote} numberOfLines={2}>
                  {hasWords ? t('challenge.startAfterAll') : t('challenge.startWhenReady')}
                </Text>

                <Pressable
                  onPress={start}
                  style={({ pressed }) => [styles.readyBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.readyText}>{t('challenge.start')}</Text>
                </Pressable>
              </>
            ) : (
              /* Người ĐỌC không có nút nào - đọc xong thì chờ trọng tài bấm Start. */
              <Text style={styles.footNote} numberOfLines={2}>
                {t('challenge.waitJudge').replace('{name}', judgeName)}
              </Text>
            )}
          </>
        ) : null}

        {/*
          ============================================================
          NHỊP 'run' - gói 30. ĐÂY MỚI LÀ CHỖ HIỆN ĐỀ BÀI.
          Chép theo `TenSecondsChallenge.cshtml` + `handleTenSecondsChallenge`.
          ============================================================
        */}
        {phase === 'run' ? (
          <>
            <Text style={styles.challengedLine} numberOfLines={2}>
              {t('challenge.hereIsYours').replace('{name}', challengedName)}
            </Text>

            <ScrollView style={styles.titleBox} showsVerticalScrollIndicator={false}>
              <Text style={styles.titleText}>{stripHtml(title)}</Text>

              {studyText ? (
                <Text style={styles.studyText}>{stripHtml(studyText)}</Text>
              ) : null}
            </ScrollView>

            {appendixType === 'B' ? (
              <Text style={styles.footNote} numberOfLines={2}>
                {t('challenge.checkPhones')}
              </Text>
            ) : null}

            {/*
              ⚠️ KHÔNG hiện dòng "…bấm Start trên điện thoại" ở nhịp này.
              Bản web đặt dòng đó trong `<div id="tensecondCountdown">` rồi
              `startCountdown()` GHI ĐÈ chính div ấy bằng đồng hồ - tức đồng hồ
              THAY CHỖ dòng đó, không đứng cạnh. Hiện cả hai là mâu thuẫn: bảo
              người ta bấm Start trong khi đã bấm rồi và đang đếm.
              Dòng đó chỉ thuộc nhịp `assign`.
            */}
          </>
        ) : null}

        {/* NHỊP 'judge' - gói 43. Bản web KHÔNG có đồng hồ ở đây. */}
        {phase === 'judge' ? (
          <>
            <Text style={styles.verdictAsk} numberOfLines={3}>
              {t('challenge.verdict')}
            </Text>

            <View style={styles.verdictRow}>
              <Pressable
                onPress={() => verdict(false)}
                style={({ pressed }) => [styles.failBtn, pressed && styles.pressed]}
              >
                <Text style={styles.failText}>{t('challenge.fail')}</Text>
              </Pressable>

              <Pressable
                onPress={() => verdict(true)}
                style={({ pressed }) => [styles.passBtn, pressed && styles.pressed]}
              >
                <Text style={styles.passText}>{t('challenge.pass')}</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Phủ kín vùng bàn cờ và chặn chạm xuống dưới - xem `QuestionOverlay`. */
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: 'rgba(200,107,255,0.4)',
    backgroundColor: '#04040E',
    overflow: 'hidden',
    boxShadow: '0 0 20px rgba(200,107,255,0.35)',
  },

  content: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 7 },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerTag: {
    height: 28,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    borderWidth: 1.3,
    borderColor: 'rgba(255,198,30,0.6)',
    backgroundColor: 'rgba(46,30,4,0.9)',
    boxShadow: '0 0 12px rgba(255,198,30,0.3)',
    maxWidth: '52%',
  },
  bannerText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#FFC61E' },
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
  },
  timerTagUrgent: { borderColor: 'rgba(255,107,120,0.8)', backgroundColor: 'rgba(74,12,20,0.95)' },
  timerText: { fontSize: 15, fontWeight: '900' },
  timerLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1, color: 'rgba(226,232,255,0.7)' },

  role: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5, color: '#FFC61E' },
  prompt: { fontSize: 13, color: 'rgba(226,232,255,0.8)', textAlign: 'center' },

  /* Đề bài - chỗ quan trọng nhất của nhịp `run`, cho chữ to. */
  challengedLine: { fontSize: 13, color: 'rgba(226,232,255,0.75)', textAlign: 'center' },
  titleBox: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#F47B20',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  titleText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  /* `StudyText` là thứ phải HỌC THUỘC - bản web để 32px đậm. */
  studyText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 1,
  },

  wordsLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: '#5FE6FF' },
  footNote: { fontSize: 12, color: 'rgba(226,232,255,0.75)', textAlign: 'center' },
  wordBox: { flex: 1 },
  wordWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 2 },
  wordChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: 'rgba(95,230,255,0.45)',
    backgroundColor: 'rgba(8,26,34,0.85)',
  },
  wordText: { fontSize: 15, fontWeight: '700', color: '#E2E8FF' },
  spacer: { flex: 1 },

  readyBtn: {
    alignSelf: 'center',
    minWidth: 200,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.6,
    borderColor: 'rgba(95,230,255,0.75)',
    backgroundColor: 'rgba(10,40,52,0.95)',
    boxShadow: '0 0 16px rgba(95,230,255,0.35)',
  },
  readyText: { fontSize: 15, fontWeight: '900', letterSpacing: 1.6, color: '#5FE6FF' },

  verdictAsk: {
    flex: 1,
    textAlignVertical: 'center',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#E2E8FF',
  },
  verdictRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  failBtn: {
    flex: 1,
    maxWidth: 240,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.6,
    borderColor: 'rgba(255,107,120,0.75)',
    backgroundColor: 'rgba(64,10,18,0.95)',
  },
  failText: { fontSize: 15, fontWeight: '900', letterSpacing: 1.4, color: '#FF6B78' },
  passBtn: {
    flex: 1,
    maxWidth: 240,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.6,
    borderColor: 'rgba(74,222,128,0.75)',
    backgroundColor: 'rgba(8,48,26,0.95)',
  },
  passText: { fontSize: 15, fontWeight: '900', letterSpacing: 1.4, color: '#4ADE80' },

  pressed: { opacity: 0.85 },
});
