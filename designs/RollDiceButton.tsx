import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, StyleSheet, Platform, Easing } from 'react-native';
import Svg, { Polygon, Circle } from 'react-native-svg';

/**
 * Cyclic — Roll Dice button + result modal.
 * Die is a flat isometric SVG cube (react-native-svg, already a project dep) —
 * no CSS-3D/Animated-transform faking, no three.js/expo-gl. "Roll" = spin +
 * hop the isometric cube while the top-face pip pattern swaps rapidly,
 * decelerating and landing on the real result. Lighter and fully reliable
 * cross-platform since it's just Polygon/Circle + Animated.View transforms.
 *
 *   <RollDiceButton onRollComplete={(value) => console.log(value)} />
 */

const PIP_PATTERNS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

const C = { top: '#ad84ff', left: '#6a35d9', right: '#4a2a94', edge: 'rgba(0,0,0,0.28)', border: '#9d6bff' };

const glow = (color: string, opacity = 0.4, radius = 14) =>
  Platform.select({
    ios: { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: 0 } },
    android: { elevation: opacity > 0.3 ? 9 : 4 },
    default: {},
  }) as object;

// Isometric cube: 3 visible faces (top/left/right), pips on the top face only.
function CubeSVG({ size, value }: { size: number; value: number }) {
  const S = size / 2;
  const width = S * 1.732;
  const height = size;
  const cx = width / 2;
  const cy = height / 2;
  const T = { x: cx, y: cy - S };
  const R = { x: cx + S * 0.866, y: cy - S * 0.5 };
  const L = { x: cx - S * 0.866, y: cy - S * 0.5 };
  const Bd = { x: cx, y: cy };
  const Fb = { x: cx, y: cy + S };
  const Lb = { x: cx - S * 0.866, y: cy + S * 0.5 };
  const Rb = { x: cx + S * 0.866, y: cy + S * 0.5 };

  const pt = (a: number, b: number) => ({
    x: T.x + a * (R.x - T.x) + b * (L.x - T.x),
    y: T.y + a * (R.y - T.y) + b * (L.y - T.y),
  });
  const pts = (arr: { x: number; y: number }[]) => arr.map((p) => `${p.x},${p.y}`).join(' ');
  const dot = size * 0.062;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Polygon points={pts([L, Bd, Fb, Lb])} fill={C.left} stroke={C.edge} strokeWidth={1} />
      <Polygon points={pts([Bd, R, Rb, Fb])} fill={C.right} stroke={C.edge} strokeWidth={1} />
      <Polygon points={pts([T, R, Bd, L])} fill={C.top} stroke={C.edge} strokeWidth={1} />
      {PIP_PATTERNS[value].map(([row, col], i) => {
        const p = pt(0.22 + 0.28 * col, 0.22 + 0.28 * row);
        return <Circle key={i} cx={p.x} cy={p.y} r={dot} fill="#fdfaff" />;
      })}
    </Svg>
  );
}

// Roll timeline: hop keyframes (px, decelerating) matched to a total ~1900ms spin.
const HOP_KEYFRAMES = [
  { y: -30, d: 170 }, { y: 0, d: 150 },
  { y: -20, d: 190 }, { y: 0, d: 170 },
  { y: -12, d: 210 }, { y: 0, d: 190 },
  { y: -5, d: 230 }, { y: 0, d: 210 },
  { y: 0, d: 380 },
];
const SWAP_DELAYS = [90, 90, 110, 130, 160, 200, 250, 320, 400];

type Props = {
  /** Called with the final 1–6 result once the die settles. */
  onRollComplete?: (value: number) => void;
};

export default function RollDiceButton({ onRollComplete }: Props) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<'rolling' | 'settled'>('rolling');
  const [faceValue, setFaceValue] = useState(1);
  const spinDeg = useRef(new Animated.Value(0)).current;
  const hopY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const rotate = spinDeg.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1deg'], extrapolate: 'extend' });

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const roll = () => {
    clearTimers();
    const result = 1 + Math.floor(Math.random() * 6);
    setVisible(true);
    setPhase('rolling');
    scale.setValue(1);
    hopY.setValue(0);

    let elapsed = 0;
    SWAP_DELAYS.forEach((delay, i) => {
      elapsed += delay;
      const isLast = i === SWAP_DELAYS.length - 1;
      timers.current.push(
        setTimeout(() => setFaceValue(isLast ? result : 1 + Math.floor(Math.random() * 6)), elapsed)
      );
    });

    const target = (spinDeg as any)._value + 360 * 2 + Math.floor(Math.random() * 360);
    const spinAnim = Animated.timing(spinDeg, { toValue: target, duration: 1900, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    const hopAnim = Animated.sequence(HOP_KEYFRAMES.map((k) => Animated.timing(hopY, { toValue: k.y, duration: k.d, easing: Easing.out(Easing.quad), useNativeDriver: true })));

    Animated.parallel([spinAnim, hopAnim]).start(() => {
      setPhase('settled');
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.16, duration: 130, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 180 }),
      ]).start();
      onRollComplete?.(result);
    });
  };

  const close = () => {
    clearTimers();
    setVisible(false);
  };

  return (
    <>
      <Pressable onPress={roll} style={({ pressed }) => [styles.button, glow(C.border, 0.55, 16), pressed && { transform: [{ scale: 0.97 }] }]}>
        <View style={styles.iconWrap}>
          <CubeSVG size={32} value={3} />
        </View>
        <Text style={styles.buttonLabel}>ROLL DICE</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.dieWrap}>
            <Animated.View style={{ transform: [{ translateY: hopY }, { rotate }, { scale }] }}>
              <CubeSVG size={130} value={faceValue} />
            </Animated.View>
          </View>

          {phase === 'settled' && (
            <View style={styles.result}>
              <Text style={styles.resultLabel}>YOU ROLLED</Text>
              <Text style={styles.resultValue}>{faceValue}</Text>
              <View style={styles.resultActions}>
                <Pressable onPress={roll} style={({ pressed }) => [styles.rollAgain, pressed && { opacity: 0.85 }]}>
                  <Text style={styles.rollAgainLabel}>ROLL AGAIN</Text>
                </Pressable>
                <Pressable onPress={close} hitSlop={8} style={styles.closeBtn}>
                  <Text style={styles.closeGlyph}>✕</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 62,
    paddingHorizontal: 20,
    paddingLeft: 12,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: '#150c33',
    alignSelf: 'flex-start',
  },
  buttonLabel: { fontFamily: 'SairaCondensed_800ExtraBold', fontSize: 17, letterSpacing: 1.8, color: '#fff' },
  iconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(6,3,18,0.8)', alignItems: 'center', justifyContent: 'center', gap: 28 },
  dieWrap: { width: 130, height: 130, alignItems: 'center', justifyContent: 'center' },

  result: { alignItems: 'center', gap: 4 },
  resultLabel: { fontFamily: 'SairaCondensed_700Bold', fontSize: 11, letterSpacing: 2.4, color: 'rgba(200,170,255,0.7)' },
  resultValue: {
    fontFamily: 'SairaCondensed_800ExtraBold',
    fontSize: 48,
    color: '#fff',
    ...Platform.select({
      ios: { textShadowColor: 'rgba(157,107,255,0.85)', textShadowRadius: 20, textShadowOffset: { width: 0, height: 0 } },
      default: {},
    }),
  },
  resultActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  rollAgain: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: 'rgba(157,107,255,0.14)',
  },
  rollAgainLabel: { fontFamily: 'SairaCondensed_700Bold', fontSize: 13, letterSpacing: 1.3, color: '#fff' },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(190,205,255,0.4)',
    backgroundColor: 'rgba(12,10,34,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { color: '#e6ecff', fontSize: 16 },
});
