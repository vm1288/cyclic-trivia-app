import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';

/**
 * Cyclic — Waiting for Players (lobby)
 * Deps: expo-linear-gradient, react-native-svg, react-native-safe-area-context, react-native-qrcode-svg
 *   npx expo install expo-linear-gradient react-native-svg react-native-safe-area-context
 *   npx expo install react-native-qrcode-svg
 * Assets: assets/main-background.png (9:19.5)
 */

type Status = 'ready' | 'invited' | 'waiting';
type Player = { id: string; name: string; status: Status; host?: boolean };

const C = {
  cyan: '#3fe0ff',
  blue: '#2f8fff',
  purple: '#c86bff',
  violet: '#8b3cff',
  green: '#2ee85f',
  amber: '#ffc61e',
  text: '#f2f6ff',
  dim: 'rgba(198,212,240,0.78)',
};

const glow = (color: string, opacity = 0.5, radius = 12) =>
  Platform.select({
    ios: { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: 0 } },
    android: { elevation: opacity > 0.45 ? 10 : 5 },
    default: {},
  });

/* ── icons ─────────────────────────────────────────── */

const ChevronLeft = ({ color = C.cyan }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14.5 5.5 8 12l6.5 6.5" />
  </Svg>
);

const PeopleIcon = ({ color = C.purple }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={9} cy={8.4} r={3} />
    <Path d="M3.6 18c0-2.8 2.4-4.6 5.4-4.6s5.4 1.8 5.4 4.6" />
    <Circle cx={16.4} cy={7.6} r={2.2} />
    <Path d="M16.4 12c2.4 0 4 1.4 4 3.6" />
  </Svg>
);

const LinkIcon = ({ color = '#fff' }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9.5 14.5 14.5 9.5" />
    <Path d="M12.5 7.5 14 6a3.7 3.7 0 0 1 5.2 5.2l-1.5 1.5" />
    <Path d="M11.5 16.5 10 18a3.7 3.7 0 0 1-5.2-5.2l1.5-1.5" />
  </Svg>
);

const LockIcon = ({ color = 'rgba(190,205,235,0.5)' }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={5} y={10.5} width={14} height={9.5} rx={2.2} />
    <Path d="M8.4 10.5V7.6a3.6 3.6 0 0 1 7.2 0v2.9" />
  </Svg>
);

const CheckCircle = ({ color = C.green }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M8 12.4l2.6 2.6L16.4 9" />
  </Svg>
);

const MailIcon = ({ color = C.purple }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={3} y={6} width={18} height={12} rx={2} />
    <Path d="M3.6 7l8.4 6 8.4-6" />
  </Svg>
);

const AvatarGlyph = ({ color }: { color: string }) => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill={color}>
    <Circle cx={12} cy={8.6} r={3.6} />
    <Path d="M4.6 20.4c0-3.6 3.3-6 7.4-6s7.4 2.4 7.4 6z" />
  </Svg>
);

/* ── spinner ───────────────────────────────────────── */

function DotSpinner({ color = C.amber, size = 20 }) {
  const spin = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const dots = Array.from({ length: 8 });
  const r = size / 2 - 2;

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
      {dots.map((_, i) => {
        const a = (i / dots.length) * Math.PI * 2;
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
              opacity: 0.35 + (i / dots.length) * 0.65,
            }}
          />
        );
      })}
    </Animated.View>
  );
}

/* ── small building blocks ─────────────────────────── */

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.diamond}>◇</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <LinearGradient
        colors={['rgba(150,190,235,0.5)', 'rgba(150,190,235,0.14)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.sectionRule}
      />
      <Text style={[styles.diamond, { color: 'rgba(150,190,235,0.55)', fontSize: 8 }]}>◇</Text>
    </View>
  );
}

function StatusCell({ status }: { status: Status }) {
  if (status === 'ready') {
    return (
      <View style={styles.statusRow}>
        <CheckCircle />
        <Text style={[styles.statusText, { color: C.green }]}>Ready</Text>
      </View>
    );
  }
  if (status === 'invited') {
    return (
      <View style={styles.invitedPill}>
        <Text style={[styles.statusText, { color: C.purple, fontSize: 14 }]}>Invited</Text>
        <View style={styles.pillDivider} />
        <MailIcon />
      </View>
    );
  }
  return (
    <View style={styles.statusRow}>
      <DotSpinner />
      <Text style={[styles.statusText, { color: C.dim }]}>Waiting</Text>
    </View>
  );
}

function PlayerRow({ index, player }: { index: number; player: Player }) {
  const ring = player.host ? C.amber : player.status === 'invited' ? C.purple : C.blue;
  return (
    <View style={styles.playerRow}>
      <View style={styles.indexBox}>
        <Text style={styles.indexText}>{index}</Text>
      </View>

      <View style={[styles.avatar, { borderColor: ring }, glow(ring, 0.35, 8)]}>
        <AvatarGlyph color={ring} />
      </View>

      <Text style={styles.playerName} numberOfLines={1}>
        {player.name}
      </Text>

      {player.host ? (
        <View style={styles.hostPill}>
          <Text style={styles.hostText}>HOST</Text>
        </View>
      ) : null}

      <View style={{ flex: 1 }} />
      <StatusCell status={player.status} />
    </View>
  );
}

/* ── screen ────────────────────────────────────────── */

export default function WaitingForPlayersScreen({
  roomCode = 'A2WNHR',
  players = [
    { id: '1', name: 'Tony', status: 'ready', host: true },
    { id: '2', name: 'Anna', status: 'invited' },
    { id: '3', name: 'Minh', status: 'waiting' },
    { id: '4', name: 'Lan', status: 'waiting' },
    { id: '5', name: 'Khoa', status: 'waiting' },
    { id: '6', name: 'Priya', status: 'waiting' },
  ] as Player[],
  onBack,
  onInvite,
  onStart,
}: {
  roomCode?: string;
  players?: Player[];
  onBack?: () => void;
  onInvite?: () => void;
  onStart?: () => void;
}) {
  const joined = players.filter((p) => p.status === 'ready').length;
  const canStart = joined >= 2;
  const progress = joined / players.length;

  return (
    <View style={styles.root}>
      <Image source={require('../assets/main-background.png')} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={['#03030f', 'rgba(3,3,15,0.55)', 'transparent']}
        locations={[0, 0.5, 1]}
        style={styles.topFade}
        pointerEvents="none"
      />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Pressable onPress={onBack} style={styles.backRow} hitSlop={8}>
            <View style={[styles.backCircle, glow(C.blue, 0.55, 10)]}>
              <ChevronLeft />
            </View>
            <Text style={styles.backLabel}>BACK</Text>
          </Pressable>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>WAITING FOR PLAYERS</Text>
            <Text style={styles.subtitle}>
              Share the code, let players scan the QR,{'\n'}or invite them to join.
            </Text>
          </View>

          <SectionHeader title="ROOM CODE" />

          <LinearGradient
            colors={[C.purple, '#e2a7ff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.codeRim, glow(C.purple, 0.6, 18)]}
          >
            <LinearGradient
              colors={['rgba(72,18,120,0.9)', 'rgba(30,8,58,0.95)']}
              style={styles.codeInner}
            >
              <Text style={styles.codeText}>{roomCode.split('').join(' ')}</Text>
            </LinearGradient>
          </LinearGradient>

          {/* QR + invite */}
          <View style={[styles.panel, glow(C.blue, 0.35, 12)]}>
            <View style={styles.qrCol}>
              <Text style={styles.panelLabel}>COMMON QR CODE</Text>
              <View style={styles.qrFrame}>
                <QRCode value={`cyclic://join/${roomCode}`} size={88} backgroundColor="#fff" color="#05041a" />
              </View>
            </View>

            <View style={styles.panelDivider} />

            <View style={styles.inviteCol}>
              <PeopleIcon />
              <Text style={styles.inviteCopy}>Invite friends to join{'\n'}your trivia game</Text>
              <Pressable onPress={onInvite} style={({ pressed }) => [{ width: '100%', transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
                <LinearGradient
                  colors={['#8b3cff', '#c86bff']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.inviteBtn, glow(C.purple, 0.6, 14)]}
                >
                  <LinkIcon />
                  <Text style={styles.inviteBtnText}>INVITE PLAYERS</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          <SectionHeader title="PLAYERS" />

          <View style={styles.progressRow}>
            <Text style={styles.joinedText}>
              {joined} of {players.length} joined
            </Text>
            <View style={{ flex: 1 }} />
            <View style={styles.track}>
              <LinearGradient
                colors={[C.violet, C.purple]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.fill, { width: `${Math.max(progress, 0.04) * 100}%` }]}
              />
            </View>
            <Text style={styles.countText}>
              {joined}/{players.length}
            </Text>
          </View>

          <View style={{ gap: 6, marginTop: 9 }}>
            {players.map((p, i) => (
              <PlayerRow key={p.id} index={i + 1} player={p} />
            ))}
          </View>

          <Pressable
            onPress={canStart ? onStart : undefined}
            disabled={!canStart}
            style={({ pressed }) => [{ marginTop: 16, transform: [{ scale: pressed && canStart ? 0.99 : 1 }] }]}
          >
            {canStart ? (
              <LinearGradient
                colors={['#12a85a', '#3ce87a']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.cta, glow(C.green, 0.55, 16)]}
              >
                <Text style={styles.ctaText}>START GAME</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.cta, styles.ctaDisabled]}>
                <LockIcon />
                <Text style={[styles.ctaText, { color: 'rgba(190,205,235,0.5)' }]}>START GAME</Text>
              </View>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05041a' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: '16%' },
  scroll: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 26 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start' },
  backCircle: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: C.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  backLabel: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 2.4 },

  titleBlock: { marginTop: 12, alignItems: 'center' },
  title: {
    fontSize: 30, lineHeight: 34, fontWeight: '800', fontStyle: 'italic', color: C.text,
    letterSpacing: -0.4, textAlign: 'center',
    textShadowColor: 'rgba(140,200,255,0.6)', textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 },
    // fontFamily: 'Saira_800Italic',
  },
  subtitle: { marginTop: 6, fontSize: 14, lineHeight: 20, color: C.dim, textAlign: 'center' },

  sectionRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  diamond: { color: C.blue, fontSize: 9 },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', letterSpacing: 2.4, color: C.cyan,
    textShadowColor: 'rgba(63,224,255,0.6)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 },
  },
  sectionRule: { flex: 1, height: 1 },

  codeRim: { marginTop: 9, padding: 1.5, borderRadius: 13 },
  codeInner: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  codeText: {
    fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 4,
    textShadowColor: 'rgba(226,167,255,0.9)', textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 },
  },

  panel: {
    marginTop: 11, flexDirection: 'row', borderRadius: 16, borderWidth: 1.5,
    borderColor: 'rgba(63,224,255,0.55)', backgroundColor: 'rgba(10,12,40,0.78)',
    padding: 11, gap: 12,
  },
  qrCol: { alignItems: 'center', gap: 7 },
  panelLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.3, color: C.cyan },
  qrFrame: {
    padding: 5, borderRadius: 10, backgroundColor: '#fff',
    borderWidth: 2, borderColor: 'rgba(63,224,255,0.5)',
  },
  panelDivider: { width: 1, backgroundColor: 'rgba(150,190,235,0.25)' },
  inviteCol: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  inviteCopy: { fontSize: 13, lineHeight: 18, color: C.dim, textAlign: 'center' },
  inviteBtn: {
    height: 40, marginTop: 2, borderRadius: 10, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  inviteBtnText: { fontSize: 13.5, fontWeight: '700', letterSpacing: 1.1, color: '#fff' },

  progressRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  joinedText: { fontSize: 14, color: C.dim },
  track: { width: 128, height: 6, borderRadius: 3, backgroundColor: 'rgba(120,140,200,0.22)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  countText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  playerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9, height: 52,
    paddingHorizontal: 10, borderRadius: 11,
    backgroundColor: 'rgba(12,14,38,0.72)',
    borderWidth: 1, borderColor: 'rgba(120,150,220,0.22)',
  },
  indexBox: {
    width: 25, height: 25, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(30,36,72,0.9)',
  },
  indexText: { fontSize: 14, fontWeight: '700', color: '#dce6ff' },
  avatar: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,10,28,0.9)',
  },
  playerName: { fontSize: 16, fontWeight: '700', color: '#fff', maxWidth: 92 },

  hostPill: {
    paddingHorizontal: 9, height: 23, borderRadius: 12, borderWidth: 1.5,
    borderColor: C.purple, alignItems: 'center', justifyContent: 'center',
  },
  hostText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, color: '#f0dcff' },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 14, fontWeight: '600' },
  invitedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, height: 30,
    borderRadius: 15, borderWidth: 1.5, borderColor: C.purple,
  },
  pillDivider: { width: 1, height: 16, backgroundColor: 'rgba(200,107,255,0.5)' },

  cta: {
    height: 58, borderRadius: 13, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 12,
  },
  ctaDisabled: {
    backgroundColor: 'rgba(24,28,52,0.6)',
    borderWidth: 1.5, borderColor: 'rgba(140,160,210,0.22)',
  },
  ctaText: { fontSize: 19, fontWeight: '700', letterSpacing: 2, color: '#fff' },
});
