import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

/**
 * Cyclic — Home screen
 * Deps: expo-linear-gradient, react-native-svg, react-native-safe-area-context
 *   npx expo install expo-linear-gradient react-native-svg react-native-safe-area-context
 * Assets: assets/main-background.png (9:19.5), assets/app-logo.png
 */

type MenuKey = 'register' | 'join' | 'purchase' | 'howto';

type MenuItem = {
  key: MenuKey;
  line: string;   // neon stroke colour
  mid: string;    // lighter tint used at the rim's top/bottom
  glow: string;   // rgba for the outer halo
  Icon: (p: { color: string }) => JSX.Element;
};

const LockIcon = ({ color }: { color: string }) => (
  <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={4} y={10} width={16} height={11} rx={2.5} />
    <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
    <Circle cx={12} cy={15} r={1.6} />
    <Path d="M12 16.6V18" />
  </Svg>
);

const JoinIcon = ({ color }: { color: string }) => (
  <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={8.5} />
    <Path d="M8.5 12h7M12.5 8.8 15.8 12l-3.3 3.2" />
  </Svg>
);

const CartIcon = ({ color }: { color: string }) => (
  <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2.5 4h2.6l2.4 10h9.6l2.1-7.2H6.4" />
    <Circle cx={9} cy={18.2} r={1.6} />
    <Circle cx={16} cy={18.2} r={1.6} />
  </Svg>
);

const BookIcon = ({ color }: { color: string }) => (
  <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 6.6C10.4 5.3 8.3 4.8 4.5 4.9v12.6c3.8-.1 5.9.4 7.5 1.7 1.6-1.3 3.7-1.8 7.5-1.7V4.9c-3.8-.1-5.9.4-7.5 1.7Z" />
    <Path d="M12 6.6v12.6" />
  </Svg>
);

const MENU: MenuItem[] = [
  { key: 'register', line: '#ff6a12', mid: '#ffd24a', glow: 'rgba(255,106,18,',  Icon: LockIcon },
  { key: 'join',     line: '#c56bff', mid: '#e9b6ff', glow: 'rgba(197,107,255,', Icon: JoinIcon },
  { key: 'purchase', line: '#3aa5ff', mid: '#9fd8ff', glow: 'rgba(58,165,255,',  Icon: CartIcon },
  { key: 'howto',    line: '#25d366', mid: '#a6f7c6', glow: 'rgba(37,211,102,',  Icon: BookIcon },
];

function NeonButton({ item, onPress }: { item: MenuItem; onPress: () => void }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const spring = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 4 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={() => spring(0.97)} onPressOut={() => spring(1)}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {/* outer halo — RN shadows have no spread, so stack a soft shadow + elevation */}
        <View
          style={[
            styles.halo,
            {
              shadowColor: item.line,
              ...Platform.select({
                ios: { shadowOpacity: 0.9, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
                android: { elevation: 12 },
              }),
            },
          ]}
        >
          {/* rim: gradient border, 4px thick */}
          <LinearGradient
            colors={[item.mid, item.line, item.line, item.mid]}
            locations={[0, 0.22, 0.78, 1]}
            style={styles.rim}
          >
            {/* body */}
            <LinearGradient
              colors={['#14101a', '#07060c', '#100c16']}
              locations={[0, 0.55, 1]}
              style={styles.body}
            >
              {/* halftone dots on the right — use a small tiling PNG for the real thing */}
              <LinearGradient
                colors={['transparent', item.glow + '0.22)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.dots}
                pointerEvents="none"
              />
              {/* top hairline */}
              <LinearGradient
                colors={['transparent', item.line, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.hairline}
                pointerEvents="none"
              />
              <View style={styles.iconWrap}>
                <item.Icon color={item.line} />
              </View>
              <View style={{ flex: 1 }} />
              <Text style={[styles.chevron, { color: item.line, textShadowColor: item.line }]}>›</Text>
            </LinearGradient>
          </LinearGradient>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const menuWidth = Math.min(width * 0.78, 280);

  return (
    <View style={styles.root}>
      {/* cover, anchored to the bottom so the podium never scrolls off */}
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

      <SafeAreaView style={styles.safe}>
        <Image source={require('../assets/app-logo.png')} style={styles.logo} resizeMode="contain" />

        <Text style={styles.wordmark}>Cyclic</Text>

        <View style={styles.taglineRow}>
          <View style={styles.rule} />
          <Text style={[styles.tag, { color: '#17c964', textShadowColor: '#17c964' }]}>PLAY</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={[styles.tag, { color: '#ffc61e', textShadowColor: '#ffc61e' }]}>THINK</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={[styles.tag, { color: '#ff3b52', textShadowColor: '#ff3b52' }]}>WIN</Text>
          <View style={styles.rule} />
        </View>

        <View style={[styles.menu, { width: menuWidth }]}>
          {MENU.map((item) => (
            <NeonButton key={item.key} item={item} onPress={() => console.log(item.key)} />
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05041a' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: '16%' },
  safe: { flex: 1, alignItems: 'center', paddingTop: 24 },

  logo: { width: 158, height: 158 },
  wordmark: {
    marginTop: 14,
    fontSize: 58,
    lineHeight: 64,
    color: '#fff',
    fontStyle: 'italic',
    fontWeight: '800',
    textShadowColor: 'rgba(120,190,255,0.85)',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
    // fontFamily: 'Saira_800Italic',
  },

  taglineRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  rule: { width: 46, height: 1, backgroundColor: 'rgba(120,190,255,0.6)' },
  tag: { fontSize: 14, fontWeight: '700', letterSpacing: 3, textShadowRadius: 12 },
  dot: { color: '#7fa8ff', fontSize: 13 },

  menu: { marginTop: 34, gap: 14 },

  halo: { borderRadius: 18 },
  rim: { padding: 4, borderRadius: 18 },
  body: {
    height: 66,
    borderRadius: 14,
    paddingLeft: 8,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    overflow: 'hidden',
  },
  dots: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 118 },
  hairline: { position: 'absolute', left: '10%', right: '10%', top: 0, height: 1.5 },
  iconWrap: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  chevron: { fontSize: 28, fontWeight: '800', textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 } },
});
