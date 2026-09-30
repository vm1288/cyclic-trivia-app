import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../i18n/I18nProvider';

import { glowRoom } from '../theme/glow';
/**
 * Đồng hồ TỔNG của ván (K87, Tony 2026-09-14): nằm TRÊN CÙNG, cùng hàng với thanh trạng thái
 * của điện thoại — màn ngang thì giữa hàng đó trống (giờ bên trái, pin/sóng bên phải), app
 * đã vẽ dưới thanh đó nên chỗ này không tốn một pixel của bàn cờ, và không tấm nào che được.
 *
 *   ván tính phút    ⏱ 12:34      (< 60 s: đỏ)
 *   Leaderboard      🎲 7 rolls left
 *   đang dừng        ⏸ 12:34 (mờ, kim đứng)
 *
 * Tính từ giờ SERVER (`Timer.ServerNow`) để không tin đồng hồ máy: hết giờ =
 * `StartTime + DurationMinutes` — đúng công thức `GameDurationJob`; resume dời `StartTime` nên
 * sau khi dừng vẫn khớp server.
 */
export function GameClock({
  height,
  durationMinutes,
  startTime,
  pausedAt,
  serverNow,
  fetchedAt,
  rollsLeft,
  started,
  overs = false,
}: {
  /** Chiều cao thanh trạng thái (`insets.top`); dưới 18 thì không vẽ. */
  height: number;
  durationMinutes: number;
  startTime: string | null;
  pausedAt: string | null;
  serverNow: string | null;
  /** `Date.now()` lúc nhận state - để cộng phần trôi qua từ đó. */
  fetchedAt: number;
  /** Leaderboard Challenge (0 phút): số lượt tung còn lại. */
  rollsLeft: number | null;
  /** Ván đã bắt đầu chơi (có người thắng vòng đua) chưa - chưa thì đứng ở đủ giờ (K88). */
  started: boolean;
  /** K117: bàn cricket gọi lượt là "overs". */
  overs?: boolean;
}) {
  const t = useT();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (height < 18) return null;

  let label = '';
  let urgent = false;
  let paused = false;
  /*
   * K117: thể thức đếm lượt đi TRƯỚC - Test match / Limited-over có `DurationMinutes` = số overs (để
   * phân biệt thể thức) nhưng KHÔNG chạy đồng hồ phút; đếm ngược là lượt CỦA MÌNH còn lại.
   */
  if (rollsLeft !== null) {
    label = t(overs ? 'clock.oversLeft' : 'clock.rollsLeft', { n: String(rollsLeft) });
    urgent = rollsLeft <= 3;
  } else if (durationMinutes > 0 && startTime && serverNow) {
    const start = Date.parse(startTime);
    const now = pausedAt ? Date.parse(pausedAt) : Date.parse(serverNow) + (Date.now() - fetchedAt);
    /* Chưa có người thắng vòng đua: server chưa đặt StartTime của ván - đứng ở đủ giờ. */
    const left = started ? Math.max(0, Math.round(durationMinutes * 60 - (now - start) / 1000)) : durationMinutes * 60;
    const m = Math.floor(left / 60);
    const s = left % 60;
    label = `${m}:${s < 10 ? '0' : ''}${s}`;
    urgent = left <= 60 && !pausedAt;
    paused = !!pausedAt;
  } else {
    return null;
  }

  return (
    <View style={[styles.bar, { height }]} pointerEvents="none">
      <Text style={[styles.text, urgent && styles.urgent, paused && styles.paused]} numberOfLines={1}>
        {paused ? '⏸ ' : rollsLeft !== null ? '🎲 ' : '⏱ '}
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  text: {
    ...glowRoom(3), fontSize: 12, fontWeight: '800', letterSpacing: 1, color: '#B9A6FF', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  urgent: { color: '#FF5C6A' },
  paused: { color: 'rgba(198,212,240,0.55)' },
});
