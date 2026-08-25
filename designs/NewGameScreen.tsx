import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';

/**
 * Cyclic — New Game screen
 * Deps: expo-linear-gradient, react-native-svg, react-native-safe-area-context
 *   npx expo install expo-linear-gradient react-native-svg react-native-safe-area-context
 * Assets: assets/main-background.png (9:19.5)
 */

const IDLE = {
  line: '#2f8fff',
  label: '#eef4ff',
  fill: ['rgba(9,14,32,0.82)', 'rgba(4,6,18,0.9)'] as const,
  glowRgb: '47,143,255',
  glowOpacity: 0.32,
};

const ACTIVE_PURPLE = {
  line: '#c86bff',
  label: '#c86bff',
  fill: ['rgba(58,16,92,0.78)', 'rgba(22,8,44,0.88)'] as const,
  glowRgb: '200,107,255',
  glowOpacity: 0.5,
};

const ACTIVE_ORANGE = {
  line: '#ff8a1e',
  label: '#ff8a1e',
  fill: ['rgba(74,32,4,0.82)', 'rgba(26,12,2,0.9)'] as const,
  glowRgb: '255,138,30',
  glowOpacity: 0.5,
};

type Variant = typeof IDLE;

const glowStyle = (v: Pick<Variant, 'line' | 'glowOpacity'>) =>
  Platform.select({
    ios: {
      shadowColor: v.line,
      shadowOpacity: v.glowOpacity,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 },
    },
    android: { elevation: v.glowOpacity > 0.4 ? 8 : 4 },
    default: {},
  });

const ClockIcon = ({ color }: { color: string }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7v5.2l3.4 2" />
  </Svg>
);

const TrophyIcon = ({ color }: { color: string }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
    <Path d="M8 5.5H5.6v1.6A3 3 0 0 0 8.6 10M16 5.5h2.4v1.6A3 3 0 0 1 15.4 10" />
    <Path d="M12 13v3.6M8.6 20h6.8M9.8 20l.6-3.4h3.2l.6 3.4" />
  </Svg>
);

const LENGTHS = [
  { label: '1 MINUTE', Icon: ClockIcon },
  { label: '15 MINUTES', Icon: ClockIcon },
  { label: '60 MINUTES', Icon: ClockIcon },
  { label: 'LEADERBOARD\nCHALLENGE', Icon: TrophyIcon },
];

const PLAYERS = [1, 2, 3, 4, 5, 6];

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.diamond}>◇</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <LinearGradient
        colors={['rgba(150,190,235,0.55)', 'rgba(150,190,235,0.18)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.sectionRule}
      />
      <Text style={[styles.diamond, { color: 'rgba(150,190,235,0.6)', fontSize: 8 }]}>◇</Text>
    </View>
  );
}

/** Halftone dot field. Swap for a tiling PNG (`resizeMode="repeat"`) for the exact reference look. */
function DotField({ color, style }: { color: string; style?: any }) {
  return (
    <LinearGradient
      colors={['transparent', `rgba(${color},0.22)`]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={style}
      pointerEvents="none"
    />
  );
}

export default function NewGameScreen({ onBack }: { onBack?: () => void }) {
  const [length, setLength] = React.useState(0);
  const [players, setPlayers] = React.useState(1);

  return (
    <View style={styles.root}>
      <Image
        source={require('../assets/main-background.png')}
        resizeMode="cover"
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['#03030f', 'rgba(3,3,15,0.55)', 'transparent']}
        locations={[0, 0.5, 1]}
        style={styles.topFade}
        pointerEvents="none"
      />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Pressable onPress={onBack} style={styles.backRow} hitSlop={8}>
            <View style={styles.backCircle}>
              <Text style={styles.backArrow}>←</Text>
            </View>
            <Text style={styles.backLabel}>BACK</Text>
          </Pressable>

          <View style={styles.titleBlock}>
            <LinearGradient
              colors={['transparent', 'rgba(160,215,255,0.85)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.titleStreak}
              pointerEvents="none"
            />
            {/* RN can't clip a gradient to text — near-white fill + glow, or use a PNG of the wordmark */}
            <Text style={styles.title}>NEW GAME</Text>
            <Text style={styles.subtitle}>Set up the table, then let players join.</Text>
          </View>

          <SectionHeader title="GAME LENGTH" />

          <View style={styles.grid}>
            {LENGTHS.map((item, i) => {
              const v = length === i ? ACTIVE_PURPLE : IDLE;
              return (
                <Pressable
                  key={item.label}
                  onPress={() => setLength(i)}
                  style={({ pressed }) => [styles.gridCell, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                >
                  <View style={[styles.card, { borderColor: v.line }, glowStyle(v)]}>
                    <LinearGradient colors={v.fill as any} style={StyleSheet.absoluteFillObject} />
                    <DotField color={v.glowRgb} style={styles.cardDots} />
                    <item.Icon color={v.line} />
                    <Text style={[styles.cardLabel, { color: v.label }]}>{item.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <SectionHeader title="PLAYERS" />

          <View style={styles.chipRow}>
            {PLAYERS.map((n) => {
              const v = players === n ? ACTIVE_ORANGE : IDLE;
              return (
                <Pressable
                  key={n}
                  onPress={() => setPlayers(n)}
                  style={({ pressed }) => [styles.chipCell, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
                >
                  <View style={[styles.chip, { borderColor: v.line }, glowStyle(v)]}>
                    <LinearGradient colors={v.fill as any} style={StyleSheet.absoluteFillObject} />
                    <Text style={[styles.chipText, { color: v.label, textShadowColor: v.line }]}>{n}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => console.log({ length, players })}
            style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.99 : 1 }], marginTop: 44 }]}
          >
            <View style={[styles.cta, glowStyle({ line: '#2ee85f', glowOpacity: 0.45 })]}>
              <LinearGradient
                colors={['rgba(10,30,16,0.85)', 'rgba(4,12,7,0.92)']}
                style={StyleSheet.absoluteFillObject}
              />
              <DotField color="46,232,95" style={styles.ctaDots} />
              <Text style={styles.ctaLabel}>CREATE GAME</Text>
            </View>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05041a' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: '16%' },
  scroll: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 40 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start' },
  backCircle: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#3aa5ff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#3aa5ff', shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
    ...Platform.select({ android: { elevation: 6 } }),
  },
  backArrow: { color: '#8fd0ff', fontSize: 17, fontWeight: '700' },
  backLabel: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 2.4 },

  titleBlock: { marginTop: 22, alignItems: 'center' },
  titleStreak: { position: 'absolute', left: -30, right: -30, top: '38%', height: 2 },
  title: {
    fontSize: 45, lineHeight: 52, fontWeight: '800', fontStyle: 'italic', color: '#f4f9ff',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(140,200,255,0.65)', textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 },
    // fontFamily: 'Saira_800Italic',
  },
  subtitle: { marginTop: 8, fontSize: 15, color: 'rgba(206,222,245,0.85)' },

  sectionRow: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 10 },
  diamond: { color: '#3aa5ff', fontSize: 9 },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', letterSpacing: 2.2, color: '#3fe0ff',
    textShadowColor: 'rgba(63,224,255,0.6)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 },
  },
  sectionRule: { flex: 1, height: 1 },

  grid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  gridCell: { width: '48%' },
  card: {
    height: 64, borderRadius: 13, borderWidth: 2, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11,
  },
  cardDots: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 96 },
  cardLabel: { flex: 1, fontSize: 12.5, lineHeight: 15, fontWeight: '700', letterSpacing: 0.9 },

  chipRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  chipCell: { flex: 1, aspectRatio: 1 },
  chip: {
    flex: 1, borderRadius: 12, borderWidth: 2, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  chipText: { fontSize: 21, fontWeight: '700', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },

  cta: {
    height: 68, borderRadius: 15, borderWidth: 2.5, borderColor: '#2ee85f', overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  ctaDots: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 150 },
  ctaLabel: {
    fontSize: 21, fontWeight: '700', letterSpacing: 2.5, color: '#eafff0',
    textShadowColor: 'rgba(46,232,95,0.7)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 },
  },
});
