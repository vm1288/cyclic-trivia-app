import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { CORRECT_QUESTION_POINT, type DirectionPacket, type MoveDirection } from '../api/game';
import { useT } from '../i18n/I18nProvider';
import { boardColors, fill } from './GameBoardParts';
import { GlowDivider } from './GlowDivider';
import { text } from '../theme/colors';

/**
 * "Bạn đi hướng nào?" - hiện sau khi tung xúc xắc, đè lên vùng bàn cờ.
 *
 * Cùng khuôn với `QuestionOverlay` (thanh trên + hai cột), vì đây là bước ngay
 * kế tiếp trong cùng một lượt và người chơi không nên phải học một bố cục mới.
 *
 * ⚠️ HẾT GIỜ PHẢI GỬI `random`, y như bản web (`AskMoveDirection.cshtml`, hàm
 * `skip`). Im lặng thì lượt treo cho tới khi watchdog của server cắt ngang, và
 * quân cờ đứng yên.
 *
 * ⚠️ KHÔNG suy đoán hướng nào lợi hơn hộ người chơi. Server đã gửi đủ dữ liệu
 * (chủ đề, battle, điểm cược) - việc của màn này là bày ra, không phải khuyên.
 */

/** Ngược chiều kim đồng hồ - xanh; thuận chiều - lục. Chép màu của bản web. */
const ANTI = '#0BD0FA';
const CLOCK = '#4DE84D';

const ClockIcon = ({ color }: { color: string }) => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}
       strokeLinecap="round">
    <Circle cx={12} cy={13} r={8} />
    <Path d="M12 9.5v4" />
    <Path d="M9.5 3.5h5" />
  </Svg>
);

/** Mũi tên vòng: `flip` để lật thành chiều ngược lại. */
const TurnIcon = ({ color, flip }: { color: string; flip?: boolean }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}
       strokeLinecap="round" strokeLinejoin="round"
       style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
    <Path d="M20 12a8 8 0 1 1-2.4-5.7" />
    <Path d="M20 3.5V8h-4.5" />
  </Svg>
);

const mmss = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export function MoveDirectionOverlay({
  packet,
  onSelect,
}: {
  packet: DirectionPacket;
  /** Gọi cả khi hết giờ, với `'random'`. */
  onSelect: (direction: MoveDirection) => void;
}) {
  const t = useT();

  const [left, setLeft] = useState(packet.DurationInSeconds || 15);

  /** Một lượt chỉ chọn ĐÚNG MỘT LẦN - xem ghi chú cùng lý do ở `QuestionOverlay`. */
  const sent = useRef(false);
  const pick = useRef(onSelect);
  pick.current = onSelect;

  useEffect(() => {
    sent.current = false;
    setLeft(packet.DurationInSeconds || 15);
  }, [packet.DurationInSeconds, packet.ClockwiseCategory, packet.AntiClockwiseCategory]);

  useEffect(() => {
    const tick = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, [packet.ClockwiseCategory, packet.AntiClockwiseCategory]);

  /*
   * ⚠️ Bắn hết giờ trong EFFECT, không phải trong hàm cập nhật của `setLeft` -
   * cùng cái bẫy đã dính ở `QuestionOverlay`: hàm cập nhật chạy giữa lúc React
   * render, gọi ngược lên màn cha từ đó là "Cannot update a component while
   * rendering a different component".
   */
  useEffect(() => {
    if (left > 0 || sent.current) return;
    sent.current = true;
    pick.current('random');
  }, [left]);

  const choose = (direction: MoveDirection) => {
    if (sent.current) return;
    sent.current = true;
    onSelect(direction);
  };

  const urgent = left <= 5;
  const clockColor = urgent ? '#FF6B78' : boardColors.purple;

  /*
   * CricTriv gọi điểm là "runs", FootieTriv là "goals". Bản web đọc `boardGameId`
   * đúng như vậy - đừng gọi trơ là "points" cho mọi bàn.
   */
  const unit = (n: number) => {
    const one = n <= 1;
    if (packet.boardGameId === 'crictriv') return t(one ? 'unit.run' : 'unit.runs');
    if (packet.boardGameId === 'footietriv') return t(one ? 'unit.goal' : 'unit.goals');
    return t(one ? 'unit.point' : 'unit.points');
  };

  const side = (which: 'clockwise' | 'anticlockwise') => {
    const isClock = which === 'clockwise';
    return {
      color: isClock ? CLOCK : ANTI,
      title: t(isClock ? 'direction.clockwise' : 'direction.anticlockwise'),
      category: (isClock ? packet.ClockwiseCategory : packet.AntiClockwiseCategory) ?? '',
      battle: !!(isClock ? packet.ClockwiseBattle : packet.AntiClockwiseBattle),
      nickname: isClock ? packet.ClockwiseIncumbentNickname : packet.AntiClockwiseIncumbentNickname,
      total: isClock ? packet.ClockwiseIncumbentTotalPoint : packet.AntiClockwiseIncumbentTotalPoint,
      prize: isClock ? packet.ClockwiseIncumbentPoint : packet.AntiClockwiseIncumbentPoint,
    };
  };

  const renderSide = (which: 'clockwise' | 'anticlockwise') => {
    const s = side(which);

    return (
      <Pressable
        onPress={() => choose(which)}
        style={({ pressed }) => [
          styles.option,
          { borderColor: `${s.color}8c` },
          pressed && styles.pressedSm,
        ]}
      >
        <LinearGradient
          colors={['rgba(10,13,34,0.55)', 'rgba(9,11,28,0.8)']}
          style={[fill, styles.optionFill]}
        />

        <View style={styles.optionHead}>
          <TurnIcon color={s.color} flip={which === 'clockwise'} />
          <Text style={[styles.optionTitle, { color: s.color }]} numberOfLines={1}>
            {s.title}
          </Text>
        </View>

        <Text style={styles.categoryLabel} numberOfLines={1}>
          {t('direction.category')}
        </Text>
        <Text style={styles.categoryValue} numberOfLines={2}>
          {s.category.toUpperCase()}
        </Text>

        <Text style={[styles.kind, { color: s.color }]}>
          {t(s.battle ? 'direction.battle' : 'direction.quiz')}
        </Text>

        {!s.battle ? (
          <Text style={styles.body} numberOfLines={2}>
            {t('direction.quizBody', {
              points: CORRECT_QUESTION_POINT,
              unit: unit(CORRECT_QUESTION_POINT),
            })}
          </Text>
        ) : packet.isLeaderBoard ? (
          <>
            <Text style={styles.body} numberOfLines={2}>
              {t('direction.battleLeaderWin', { unit: unit(2) })}
            </Text>
            <Text style={styles.body} numberOfLines={2}>
              {t('direction.battleLeaderLose')}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.body} numberOfLines={2}>
              {t('direction.battleWin', {
                points: s.prize ?? 0,
                unit: unit(s.prize ?? 0),
              })}
            </Text>
            <Text style={styles.body} numberOfLines={1}>
              {t('direction.battleRisk', { percent: packet.WaggerPercent ?? 0 })}
            </Text>
            <Text style={styles.rival} numberOfLines={1}>
              {s.nickname} · {s.total ?? 0} {unit(s.total ?? 0)}
            </Text>
          </>
        )}

        <View style={[styles.selectBtn, { borderColor: s.color }]}>
          <Text style={[styles.selectText, { color: s.color }]}>{t('direction.select')}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0D1030', '#06061A', '#03030C']}
        locations={[0, 0.55, 1]}
        style={fill}
      />

      <View style={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.bannerTag}>
            <Text style={styles.bannerText} numberOfLines={1}>
              {t('direction.title')}
            </Text>
          </View>

          <GlowDivider color="#1F6FD6" accent="#5FE6FF" height={1.5} flareWidth={70} style={styles.rule} />

          <View style={[styles.timerTag, urgent && styles.timerTagUrgent]}>
            <ClockIcon color={clockColor} />
            <Text style={[styles.timerText, { color: clockColor }]}>{mmss(left)}</Text>
          </View>
        </View>

        {/* Ngược chiều bên trái, thuận chiều bên phải - cùng thứ tự bản web. */}
        <View style={styles.row}>
          {renderSide('anticlockwise')}
          {renderSide('clockwise')}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Phủ kín vùng bàn cờ và CHẶN chạm xuống dưới - xem `QuestionOverlay`. */
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
    overflow: 'hidden',
    boxShadow: '0 0 20px rgba(31,111,214,0.35)',
  },

  content: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 10 },

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
  bannerText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#5FE6FF' },
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

  row: { flex: 1, flexDirection: 'row', gap: 12 },

  option: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 3,
  },
  optionFill: { borderRadius: 12 },
  pressedSm: { transform: [{ scale: 0.985 }] },

  optionHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  optionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 1.1 },

  categoryLabel: {
    marginTop: 4,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: boardColors.dim,
  },
  categoryValue: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: text.primary },

  kind: { marginTop: 4, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  body: { fontSize: 11.5, lineHeight: 15, color: '#D6E2FF' },
  rival: { fontSize: 11.5, lineHeight: 15, fontWeight: '700', color: boardColors.amber },

  selectBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    height: 26,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,11,28,0.7)',
  },
  selectText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
});
