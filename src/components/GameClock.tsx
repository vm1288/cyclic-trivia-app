import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../i18n/I18nProvider';

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
  if (durationMinutes > 0 && startTime && serverNow) {
    const start = Date.parse(startTime);
    const now = pausedAt ? Date.parse(pausedAt) : Date.parse(serverNow) + (Date.now() - fetchedAt);
    const left = Math.max(0, Math.round(durationMinutes * 60 - (now - start) / 1000));
    const m = Math.floor(left / 60);
    const s = left % 60;
    label = `${m}:${s < 10 ? '0' : ''}${s}`;
    urgent = left <= 60 && !pausedAt;
    paused = !!pausedAt;
  } else if (rollsLeft !== null) {
    label = t('clock.rollsLeft', { n: String(rollsLeft) });
  } else {
    return null;
  }

  return (
    <View style={[styles.bar, { height }]} pointerEvents="none">
      <Text style={[styles.text, urgent && styles.urgent, paused && styles.paused]} numberOfLines={1}>
        {paused ? '⏸ ' : durationMinutes > 0 ? '⏱ ' : '🎲 '}
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  text: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: '#B9A6FF', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  urgent: { color: '#FF5C6A' },
  paused: { color: 'rgba(198,212,240,0.55)' },
});
