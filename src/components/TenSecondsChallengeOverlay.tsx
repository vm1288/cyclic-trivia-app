import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useT } from '../i18n/I18nProvider';
import { boardColors, fill } from './GameBoardParts';
import { GlowDivider } from './GlowDivider';

/**
 * Ô **10-SEC CHALLENGE** - hai nhịp, dùng chung một khung.
 *
 * Luật (chép theo `ChallengeSquareResolver` + `playerHandlers.js` của bản web):
 * người tới lượt rơi vào ô `challenge`, server bốc ngẫu nhiên MỘT người khác làm
 * TRỌNG TÀI. Có hai kiểu thử thách:
 *
 *   - kiểu thường: chỉ trọng tài nhận gói 42, `words` rỗng
 *   - kiểu "B":    mỗi người còn lại nhận một phần lời để đọc, kèm số thứ tự
 *
 * Hai nhịp của khung này:
 *
 *   `phase = 'start'`  (gói 42 về) - hiện vai trò + phần lời, một nút XONG.
 *                      Bấm là gửi LẠI gói 42 để server bắt đầu đếm 10 giây.
 *   `phase = 'judge'`  (gói 43 về) - hiện hai nút ĐẠT / HỎNG cho trọng tài,
 *                      kèm đồng hồ 10 giây. Bấm là gửi gói 30 `{ isPass }`.
 *
 * ⚠️ Nhịp `start` KHÔNG có đồng hồ đếm ngược, và đó là **cố ý**: thử thách chỉ
 * bắt đầu tính giờ SAU KHI người chơi bấm XONG (chính gói 42 gửi về mới arm
 * watchdog `TenSecondsChallengeCountDown` ở server). Tự đặt đồng hồ ở đây rồi
 * bấm hộ là cắt mất phần đọc lời.
 *
 * ⚠️ Nhịp `judge` thì NGƯỢC LẠI - hết giờ **không** được im lặng. Server gửi
 * gói 27 `TenSecondsChallengeFail` khi hết giờ và màn hình phải biến mất; phần
 * gửi `isPass: false` do `game-landscape.tsx` lo, không phải khung này.
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

export type ChallengePhase = 'start' | 'judge';

export function TenSecondsChallengeOverlay({
  phase,
  words,
  isJudge,
  readerNumber,
  totalReaders,
  /** Tên người ĐANG BỊ CHẤM - tức người tới lượt, không phải trọng tài. */
  turnPlayerName,
  durationSeconds,
  onReady,
  onVerdict,
}: {
  phase: ChallengePhase;
  words: string[];
  isJudge: boolean;
  readerNumber: number;
  totalReaders: number;
  turnPlayerName: string;
  durationSeconds: number;
  /** Nhịp `start`: đã đọc xong, cho đếm giờ. */
  onReady: () => void;
  /** Nhịp `judge`: phán quyết của trọng tài. */
  onVerdict: (isPass: boolean) => void;
}) {
  const t = useT();

  const [left, setLeft] = useState(durationSeconds || 10);

  /**
   * Một nhịp chỉ gửi ĐÚNG MỘT LẦN.
   *
   * Dùng `ref` chứ không phải state - đây là cái chốt, không phải thứ để vẽ lại
   * màn hình. Cùng lý do với `QuestionOverlay` và `CardChoiceOverlay`.
   */
  const sent = useRef(false);

  useEffect(() => {
    sent.current = false;
    setLeft(durationSeconds || 10);
  }, [phase, durationSeconds]);

  useEffect(() => {
    if (phase !== 'judge') return;
    const tick = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, [phase]);

  const ready = () => {
    if (sent.current) return;
    sent.current = true;
    onReady();
  };

  const verdict = (isPass: boolean) => {
    if (sent.current) return;
    sent.current = true;
    onVerdict(isPass);
  };

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

          {phase === 'judge' ? (
            <View style={[styles.timerTag, urgent && styles.timerTagUrgent]}>
              <ClockIcon color={clockColor} />
              <Text style={[styles.timerText, { color: clockColor }]}>{left}s</Text>
            </View>
          ) : null}
        </View>

        {phase === 'start' ? (
          <>
            {/*
              Bố cục chép theo `PlayerTenSecondsChallengeStartPartialHtml.cshtml`
              của bản web, và chữ lấy NGUYÊN VĂN từ đó - đừng tự viết lại cho
              "gọn hơn", người chơi web và người chơi app phải đọc cùng một câu.
            */}
            {totalReaders > 1 ? (
              <Text style={styles.role} numberOfLines={2}>
                {t('challenge.reader').replace('{ordinal}', ordinal(readerNumber))}
              </Text>
            ) : null}

            <Text style={styles.prompt} numberOfLines={2}>
              {totalReaders > 1 ? t('challenge.readAloudTurn') : t('challenge.readAloud')}
            </Text>

            {words.length > 0 ? (
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
              </>
            ) : (
              <View style={styles.spacer} />
            )}

            <Text style={styles.footNote} numberOfLines={2}>
              {totalReaders > 1 ? t('challenge.startAfterAll') : t('challenge.startWhenReady')}
            </Text>

            <Pressable
              onPress={ready}
              style={({ pressed }) => [styles.readyBtn, pressed && styles.pressed]}
            >
              <Text style={styles.readyText}>{t('challenge.start')}</Text>
            </Pressable>
          </>
        ) : (
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
        )}
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

  content: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },

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
  timerTagUrgent: { borderColor: 'rgba(255,107,120,0.7)', backgroundColor: 'rgba(74,12,20,0.9)' },
  timerText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  role: { fontSize: 17, fontWeight: '900', letterSpacing: 0.6, color: '#FFC61E' },
  prompt: { fontSize: 12, color: 'rgba(226,232,255,0.75)' },

  /* Lời để đọc - có thể dài, nên cho cuộn thay vì cắt mất chữ cuối. */
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
  wordText: { fontSize: 14, fontWeight: '700', color: '#E2E8FF' },
  spacer: { flex: 1 },

  readyBtn: {
    alignSelf: 'center',
    minWidth: 200,
    height: 44,
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
