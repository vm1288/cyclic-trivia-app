import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { text } from '../theme/colors';

export const lobbyColors = {
  cyan: '#3FE0FF',
  blue: '#2F8FFF',
  purple: '#C86BFF',
  violet: '#8B3CFF',
  green: '#2EE85F',
  amber: '#FFC61E',
  dim: 'rgba(198,212,240,0.78)',
} as const;

/** Người chơi đã ngồi vào ghế. */
export const CheckCircle = ({ color = lobbyColors.green }: { color?: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}
       strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M8 12.4l2.6 2.6L16.4 9" />
  </Svg>
);

export const PeopleIcon = ({ color = lobbyColors.purple }: { color?: string }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7}
       strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={9} cy={8.4} r={3} />
    <Path d="M3.6 18c0-2.8 2.4-4.6 5.4-4.6s5.4 1.8 5.4 4.6" />
    <Circle cx={16.4} cy={7.6} r={2.2} />
    <Path d="M16.4 12c2.4 0 4 1.4 4 3.6" />
  </Svg>
);

export const LinkIcon = ({ color = '#FFFFFF' }: { color?: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}
       strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9.5 14.5 14.5 9.5" />
    <Path d="M12.5 7.5 14 6a3.7 3.7 0 0 1 5.2 5.2l-1.5 1.5" />
    <Path d="M11.5 16.5 10 18a3.7 3.7 0 0 1-5.2-5.2l1.5-1.5" />
  </Svg>
);

/** Nút START GAME khi chưa đủ người. */
export const LockIcon = ({ color = 'rgba(190,205,235,0.5)' }: { color?: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}
       strokeLinecap="round" strokeLinejoin="round">
    <Path d="M7 10.5h10a2.2 2.2 0 0 1 2 2.2v5.1a2.2 2.2 0 0 1-2 2.2H7a2.2 2.2 0 0 1-2-2.2v-5.1a2.2 2.2 0 0 1 2-2.2Z" />
    <Path d="M8.4 10.5V7.6a3.6 3.6 0 0 1 7.2 0v2.9" />
  </Svg>
);

/** Hình người trong vòng tròn màu của người chơi. */
export const AvatarGlyph = ({ color }: { color: string }) => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill={color}>
    <Circle cx={12} cy={8.6} r={3.6} />
    <Path d="M4.6 20.4c0-3.6 3.3-6 7.4-6s7.4 2.4 7.4 6z" />
  </Svg>
);

/**
 * Vòng chấm xoay cho ghế còn trống.
 *
 * Quay bằng Reanimated (UI thread) chứ không phải `Animated` của RN: màn này
 * chạy vòng poll và sẽ còn nhận packet SignalR, JS thread sẽ bận - animation
 * chạy trên đó sẽ giật.
 */
export function DotSpinner({ color = lobbyColors.amber, size = 20 }: { color?: string; size?: number }) {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
  }, [spin]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  const count = 8;
  const r = size / 2 - 2;

  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: size / 2 + Math.cos(a) * r - 1.6,
              top: size / 2 + Math.sin(a) * r - 1.6,
              width: 3.2,
              height: 3.2,
              borderRadius: 2,
              backgroundColor: color,
              opacity: 0.35 + (i / count) * 0.65,
            }}
          />
        );
      })}
    </Animated.View>
  );
}

/** Một hàng người chơi trong danh sách ghế. */
export function PlayerRow({
  index,
  name,
  colour,
  ready,
  isHost,
  hostLabel,
  statusLabel,
}: {
  index: number;
  name: string;
  colour: string;
  ready: boolean;
  isHost: boolean;
  hostLabel: string;
  statusLabel: string;
}) {
  // Ghế trống dùng màu trung tính: màu của người chơi chỉ có nghĩa sau khi họ
  // chọn nhân vật, hiện sớm sẽ khiến ghế trống trông như đã có người.
  const ring = ready ? colour : lobbyColors.blue;

  return (
    <View style={styles.row}>
      <View style={styles.indexBox}>
        <Text style={styles.indexText}>{index}</Text>
      </View>

      <View style={[styles.avatar, { borderColor: ring, boxShadow: `0 0 8px ${ring}59` }]}>
        <AvatarGlyph color={ring} />
      </View>

      <Text style={[styles.name, !ready && styles.nameEmpty]} numberOfLines={1}>
        {name}
      </Text>

      {isHost ? (
        <View style={styles.hostPill}>
          <Text style={styles.hostText}>{hostLabel}</Text>
        </View>
      ) : null}

      <View style={styles.spacer} />

      <View style={styles.status}>
        {ready ? <CheckCircle /> : <DotSpinner />}
        <Text style={[styles.statusText, { color: ready ? lobbyColors.green : lobbyColors.dim }]}>
          {statusLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 52,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: 'rgba(12,14,38,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(120,150,220,0.22)',
  },
  indexBox: {
    width: 25,
    height: 25,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,36,72,0.9)',
  },
  indexText: { fontSize: 14, fontWeight: '700', color: '#DCE6FF' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,10,28,0.9)',
  },
  name: { fontSize: 15, fontWeight: '700', color: text.primary, maxWidth: 96 },
  nameEmpty: { color: lobbyColors.dim, fontWeight: '400' },
  spacer: { flex: 1 },

  hostPill: {
    paddingHorizontal: 9,
    height: 23,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: lobbyColors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, color: '#F0DCFF' },

  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 14, fontWeight: '600' },
});
