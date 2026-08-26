import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  Modal,
  StyleSheet,
  Platform,
  ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Path,
  Circle,
  Rect,
  Ellipse,
  Defs,
  Stop,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg';

/**
 * Cyclic — Game Board (in-game main screen)
 * Deps: expo-linear-gradient, react-native-svg, react-native-safe-area-context
 *   npx expo install expo-linear-gradient react-native-svg react-native-safe-area-context
 * Fonts (expo-font / @expo-google-fonts): Saira 400/600/700/800, Saira Condensed 700
 * Assets: pass `logo`, `boardImage`, and each player's `avatar` (camera frame) as props
 */

const C = {
  blue: '#2f8fff',
  blueSoft: '#7fc0ff',
  purple: '#c86bff',
  green: '#2ee85f',
  amber: '#ffc61e',
  red: '#ff3b4e',
  dim: 'rgba(198,212,240,0.72)',
  panel: 'rgba(10,13,34,0.8)',
  hair: 'rgba(110,140,210,0.24)',
};

const glow = (color: string, opacity = 0.35, radius = 14) =>
  Platform.select({
    ios: { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: 0 } },
    android: { elevation: opacity > 0.3 ? 9 : 4 },
    default: {},
  }) as object;

/* ── icons ─────────────────────────────────────────── */

const LockIcon = ({ color = '#ff6b78', size = 13 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Rect x={5} y={10.5} width={14} height={9.5} rx={2.2} />
    <Path d="M8.4 10.5V7.6a3.6 3.6 0 0 1 7.2 0v2.9" />
  </Svg>
);

const MicIcon = () => (
  <Svg width={9} height={9} viewBox="0 0 24 24" fill={C.green}>
    <Rect x={9} y={3} width={6} height={11} rx={3} />
    <Path d="M6 12a6 6 0 0 0 12 0h-2a4 4 0 0 1-8 0z" />
    <Rect x={11} y={18} width={2} height={3} />
  </Svg>
);

const CamIcon = () => (
  <Svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="#dce6ff" strokeWidth={2.4}>
    <Rect x={3.5} y={3.5} width={17} height={17} rx={4} />
    <Circle cx={12} cy={12} r={3.4} />
  </Svg>
);

const InfoIcon = ({ size = 17, color = '#cddcff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 10.6v6" />
    <Circle cx={12} cy={7.6} r={1.05} fill={color} stroke="none" />
  </Svg>
);

const PawnIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill={C.green}>
    <Path d="M12 3a3.4 3.4 0 0 1 2.1 6.1c1.6 1 2.6 2.6 2.6 4.3H7.3c0-1.7 1-3.3 2.6-4.3A3.4 3.4 0 0 1 12 3z" />
    <Path d="M6.4 16.2h11.2l1.4 4.6H5z" />
  </Svg>
);

const Dice3D = ({ size = 56 }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Defs>
      <SvgLinearGradient id="diceTop" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#d6c6ff" />
        <Stop offset="1" stopColor="#9d7bff" />
      </SvgLinearGradient>
      <SvgLinearGradient id="diceLeft" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#6b3fd4" />
        <Stop offset="1" stopColor="#3d1f8a" />
      </SvgLinearGradient>
      <SvgLinearGradient id="diceRight" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#8f63f0" />
        <Stop offset="1" stopColor="#5628ad" />
      </SvgLinearGradient>
    </Defs>
    <Path d="M24 5 42 15 24 25 6 15z" fill="url(#diceTop)" />
    <Path d="M6 15 24 25v18L6 33z" fill="url(#diceLeft)" />
    <Path d="M42 15 24 25v18l18-10z" fill="url(#diceRight)" />
    <Path d="M24 5 42 15 24 25 6 15z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
    <Ellipse cx={24} cy={15} rx={3.4} ry={1.9} fill="#2b1560" opacity={0.8} />
    <Circle cx={11.5} cy={23.5} r={1.9} fill="#e6dcff" opacity={0.92} />
    <Circle cx={15} cy={30.5} r={1.9} fill="#e6dcff" opacity={0.92} />
    <Circle cx={18.5} cy={37.5} r={1.9} fill="#e6dcff" opacity={0.92} />
    <Circle cx={30} cy={29} r={1.9} fill="#f2ecff" opacity={0.95} />
    <Circle cx={36.5} cy={34.5} r={1.9} fill="#f2ecff" opacity={0.95} />
  </Svg>
);

const ChatIcon = ({ size = 27 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.blueSoft} strokeWidth={1.7} strokeLinejoin="round">
    <Path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.4 3.4V16H6.5A2.5 2.5 0 0 1 4 13.5z" />
    {[8.6, 12, 15.4].map((x, i) => (
      <Circle key={i} cx={x} cy={10} r={1.25} fill={C.blueSoft} stroke="none" />
    ))}
  </Svg>
);

const BookIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#cddcff" strokeWidth={1.7} strokeLinejoin="round">
    <Path d="M3.5 5.2c2.6-1 5.7-1 8.5.9 2.8-1.9 5.9-1.9 8.5-.9v13c-2.6-1-5.7-1-8.5.9-2.8-1.9-5.9-1.9-8.5-.9z" />
    <Path d="M12 6.1v12.9" />
  </Svg>
);

const JokerIcon = ({ size = 30 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth={1.7} strokeLinejoin="round">
    <Path d="M12 2.8l2.1 5.3 5.6 1.4-4 4 .6 5.7-4.3-2.5-4.3 2.5.6-5.7-4-4 5.6-1.4z" />
  </Svg>
);

const SkipperIcon = ({ size = 30 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={C.blueSoft}>
    <Path d="M4.5 5.5 12 12l-7.5 6.5z" />
    <Path d="M12.5 5.5 20 12l-7.5 6.5z" />
  </Svg>
);

const EliminatorIcon = ({ size = 30 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#f9b23f" strokeWidth={2.4} strokeLinecap="round">
    <Path d="M6.5 4.5 17.5 14" />
    <Path d="M17.5 4.5 6.5 14" />
    <Path d="M6 18h12" />
    <Path d="M7.5 21h9" />
  </Svg>
);

const ChangerIcon = ({ size = 30 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ff7fb8" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5.5 18.5c0-6 3.2-9.5 8-9.5" />
    <Path d="M10.2 5.6 14 9l-3.8 3.4" />
    <Path d="M15.5 15h5.5" />
    <Path d="M15.5 19h5.5" />
  </Svg>
);

/* ── small pieces ──────────────────────────────────── */

const Stars = ({ filled, size = 10 }: { filled: number; size?: number }) => (
  <View style={{ flexDirection: 'row' }}>
    {[0, 1, 2, 3, 4].map(i => (
      <Text
        key={i}
        style={{
          fontSize: size,
          lineHeight: size * 1.2,
          color: i < filled ? C.amber : 'rgba(255,198,30,0.28)',
        }}
      >
        ★
      </Text>
    ))}
  </View>
);

type PlayerCard = { name: string; score: number; chip: string; stars: number; avatar?: ImageSourcePropType };

const PLAYERS: PlayerCard[] = [
  { name: 'Tony', score: 870, chip: '#1f6fd6', stars: 3 },
  { name: 'Anna', score: 640, chip: '#7c2fd6', stars: 4 },
  { name: 'Minh', score: 580, chip: '#d97706', stars: 3 },
  { name: 'Lan', score: 420, chip: '#0d9488', stars: 2 },
  { name: 'Khoa', score: 310, chip: '#c11f3a', stars: 4 },
];

const PlayerTile = ({ p }: { p: PlayerCard }) => (
  <View style={s.playerTile}>
    <View style={s.playerMedia}>
      {p.avatar ? (
        <Image source={p.avatar} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(24,30,60,0.9)' }]} />
      )}
      <View style={[s.badge, { left: 3 }]}>
        <MicIcon />
      </View>
      <View style={[s.badge, { right: 3 }]}>
        <CamIcon />
      </View>
      <View style={[s.scoreChip, { backgroundColor: p.chip }]}>
        <Text style={s.scoreChipText}>{p.score}</Text>
      </View>
    </View>
    <View style={s.playerNameRow}>
      <Text style={s.playerName} numberOfLines={1}>
        {p.name}
      </Text>
    </View>
    <View style={s.playerStars}>
      <Stars filled={p.stars} />
      <Text style={s.playerStarsText}>{p.stars}/5</Text>
    </View>
  </View>
);

type HandCard = {
  key: CardKey;
  name: string;
  accent: string;
  glow: string;
  tint: string;
  count: number;
  max?: number;
  desc: string;
  Icon: React.ComponentType<{ size?: number }>;
};

export type CardKey = 'joker' | 'skipper' | 'eliminator' | 'changer';

const HAND: HandCard[] = [
  { key: 'joker', name: 'JOKER', accent: C.purple, glow: 'rgba(200,107,255,0.55)', tint: 'rgba(52,18,96,0.85)', count: 1, max: 1, desc: 'Use as any card you need.', Icon: JokerIcon },
  { key: 'skipper', name: 'SKIPPER', accent: C.blueSoft, glow: 'rgba(47,143,255,0.55)', tint: 'rgba(12,44,100,0.85)', count: 3, desc: 'Skip a challenge or turn effect.', Icon: SkipperIcon },
  { key: 'eliminator', name: 'ELIMINATOR', accent: '#f9b23f', glow: 'rgba(245,158,11,0.55)', tint: 'rgba(84,48,4,0.85)', count: 3, desc: 'Remove one wrong answer.', Icon: EliminatorIcon },
  { key: 'changer', name: 'CHANGER', accent: '#ff7fb8', glow: 'rgba(255,95,168,0.55)', tint: 'rgba(88,12,52,0.85)', count: 3, max: 3, desc: 'Change the question or category.', Icon: ChangerIcon },
];

const HandTile = ({
  card,
  selected,
  onPress,
}: {
  card: HandCard;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={[s.handCard, { borderColor: card.glow }]}>
    <LinearGradient colors={[card.tint, 'rgba(9,11,28,0.94)']} style={StyleSheet.absoluteFillObject} />
    <card.Icon />
    <Text style={[s.handName, { color: card.accent }]}>{card.name}</Text>
    <View style={s.pipRow}>
      {Array.from({ length: card.max ?? 3 }).map((_, i) => (
        <View
          key={i}
          style={[
            s.pip,
            i < card.count
              ? { backgroundColor: card.accent, ...(glow(card.accent, 0.5, 6) as object) }
              : { backgroundColor: 'rgba(120,140,200,0.16)' },
          ]}
        />
      ))}
    </View>
    {selected && <View style={[s.handRing, { borderColor: card.accent }, glow(card.accent, 0.6, 16) as object]} />}
  </Pressable>
);

/* ── screen ────────────────────────────────────────── */

export type GameBoardScreenProps = {
  roomCode?: string;
  playerCount?: number;
  boardImage?: ImageSourcePropType;
  logo?: ImageSourcePropType;
  helpSheetOpen?: boolean;
  onPause?: () => void;
  onMenu?: () => void;
  onInfo?: () => void;
  onRollDice?: () => void;
  onOpenChat?: () => void;
  unreadCount?: number;
  onPlayCard?: (key: CardKey) => void;
};

export default function GameBoardScreen({
  roomCode = 'CYCLIC123',
  playerCount = 6,
  boardImage,
  logo,
  helpSheetOpen = false,
  onPause,
  onMenu,
  onInfo,
  onRollDice,
  onOpenChat,
  unreadCount = 3,
  onPlayCard,
}: GameBoardScreenProps) {
  const [sheet, setSheet] = React.useState(helpSheetOpen);
  const [selected, setSelected] = React.useState<CardKey | null>(null);

  return (
    <View style={s.root}>
      <LinearGradient colors={['#0d1030', '#06061a', '#03030c']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* header */}
        <View style={s.header}>
          {logo ? <Image source={logo} style={s.logo} /> : <View style={[s.logo, { backgroundColor: '#141a3c' }]} />}
          <View style={{ flexShrink: 1 }}>
            <Text style={s.roomText} numberOfLines={1}>
              {roomCode}
            </Text>
            <View style={s.statusRow}>
              <Text style={s.metaDim}>{playerCount} players</Text>
            </View>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onPause} style={s.pauseBtn}>
            <View style={s.pauseBars}>
              <View style={s.pauseBar} />
              <View style={s.pauseBar} />
            </View>
            <Text style={s.pauseText}>Pause Game</Text>
            <LockIcon />
          </Pressable>
          <Pressable onPress={onMenu} style={s.menuBtn}>
            {[0, 1, 2].map(i => (
              <View key={i} style={s.menuDot} />
            ))}
          </Pressable>
        </View>

        {/* player strip */}
        <View style={s.playerStrip}>
          {PLAYERS.map((p, i) => (
            <PlayerTile key={i} p={p} />
          ))}
        </View>

        {/* board — swap boardImage for the real artwork */}
        <View style={s.board}>
          {boardImage ? (
            <Image source={boardImage} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#123a20', '#07160d']} style={StyleSheet.absoluteFillObject} />
          )}
          <Pressable onPress={onInfo} style={s.infoBtn}>
            <InfoIcon />
            <Text style={s.infoText}>Info</Text>
          </Pressable>
        </View>

        {/* you + chat */}
        <View style={{ flexDirection: 'row', gap: 7 }}>
          <View style={s.youRow}>
            <View style={s.pawnRing}>
              <PawnIcon />
            </View>
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={s.youText}>
                  You <Text style={s.youMeta}>(Host)</Text>
                </Text>
                <Text style={s.colorText}>Green</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Stars filled={4} size={13} />
                <Text style={s.scoreValue}>4/5</Text>
                <Text style={s.scoreLabel}>score</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={onOpenChat} style={s.chatBtn}>
            <ChatIcon />
            {unreadCount > 0 && (
              <View style={s.unread}>
                <Text style={s.unreadText}>{unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* hand */}
        <View style={{ gap: 7 }}>
          <View style={s.sectionHead}>
            <Text style={s.sectionLabel}>YOUR CARDS</Text>
            <View style={s.sectionRule} />
            <Text style={s.sectionHint}>Tap to use</Text>
            <Pressable onPress={() => setSheet(true)} style={s.iBtn}>
              <Text style={s.iBtnText}>i</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            {HAND.map(c => (
              <HandTile
                key={c.key}
                card={c}
                selected={selected === c.key}
                onPress={() => {
                  const next = selected === c.key ? null : c.key;
                  setSelected(next);
                  if (next) onPlayCard?.(c.key);
                }}
              />
            ))}
          </View>
        </View>

        <View style={{ flex: 1 }} />

        {/* roll dice */}
        <View style={{ alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <Pressable onPress={onRollDice} style={s.diceBtn}>
            <View style={s.diceInnerRing} />
            <Dice3D />
          </Pressable>
          <Text style={s.diceLabel}>ROLL DICE</Text>
        </View>
      </SafeAreaView>

      {/* help cards sheet */}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable style={s.backdrop} onPress={() => setSheet(false)} />
        <View style={s.sheet}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <BookIcon />
            <Text style={s.sheetTitle}>Help Cards</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setSheet(false)} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </Pressable>
          </View>
          <View style={s.sheetGrid}>
            {HAND.map((h, i) => (
              <View key={h.key} style={[s.sheetCell, i < 3 && s.sheetCellDivider]}>
                <h.Icon size={28} />
                <Text style={[s.sheetName, { color: h.accent }]}>{h.name}</Text>
                <Text style={s.sheetDesc}>{h.desc}</Text>
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04040e' },
  safe: { flex: 1, paddingHorizontal: 14, paddingTop: 8, gap: 8 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  logo: { width: 40, height: 40, borderRadius: 20 },
  roomText: { fontFamily: 'Saira_700Bold', fontSize: 15, color: '#fff' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  metaDim: { fontFamily: 'Saira_400Regular', fontSize: 11.5, color: C.dim },

  pauseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 8,
    borderRadius: 12, borderWidth: 1.5, borderColor: C.red, backgroundColor: 'rgba(48,6,14,0.9)',
    ...(glow(C.red, 0.32, 12) as object),
  },
  pauseBars: { flexDirection: 'row', gap: 2.5 },
  pauseBar: { width: 3.5, height: 14, borderRadius: 2, backgroundColor: C.red },
  pauseText: { fontFamily: 'Saira_600SemiBold', fontSize: 12.5, color: '#ff6b78' },
  menuBtn: {
    width: 34, height: 38, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(110,140,210,0.42)',
    backgroundColor: 'rgba(12,16,42,0.8)', alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  menuDot: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: '#cddcff' },

  playerStrip: { flexDirection: 'row', gap: 5 },
  playerTile: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: C.hair, backgroundColor: C.panel, overflow: 'hidden' },
  playerMedia: { height: 74, position: 'relative' },
  playerNameRow: {
    height: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderTopWidth: 1, borderTopColor: 'rgba(110,140,210,0.18)',
  },
  playerName: { fontFamily: 'Saira_700Bold', fontSize: 10, color: '#eaf1ff' },
  badge: {
    position: 'absolute', top: 3, width: 17, height: 17, borderRadius: 9,
    backgroundColor: 'rgba(4,6,16,0.82)', alignItems: 'center', justifyContent: 'center',
  },
  scoreChip: {
    position: 'absolute', left: 0, bottom: 5, height: 17, paddingHorizontal: 7,
    borderTopRightRadius: 5, borderBottomRightRadius: 5, justifyContent: 'center',
  },
  scoreChipText: { fontFamily: 'Saira_700Bold', fontSize: 11, color: '#fff' },
  playerStars: { height: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  playerStarsText: { fontFamily: 'Saira_700Bold', fontSize: 9, color: 'rgba(198,212,240,0.8)' },

  board: {
    height: 292, borderRadius: 16, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(110,140,210,0.26)', position: 'relative',
  },
  infoBtn: {
    position: 'absolute', left: 9, bottom: 9, flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 30, paddingLeft: 7, paddingRight: 10, borderRadius: 15,
    backgroundColor: 'rgba(4,6,16,0.72)', borderWidth: 1, borderColor: 'rgba(150,190,235,0.35)',
  },
  infoText: { fontFamily: 'Saira_600SemiBold', fontSize: 12, color: '#dce6ff' },

  youRow: {
    flex: 1, height: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11,
    borderRadius: 12, borderWidth: 1, borderColor: C.hair, backgroundColor: C.panel,
  },
  pawnRing: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: C.green,
    backgroundColor: 'rgba(8,26,14,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  youText: { fontFamily: 'Saira_700Bold', fontSize: 14, color: '#fff' },
  youMeta: { fontFamily: 'Saira_400Regular', color: C.dim },
  colorText: { fontFamily: 'Saira_600SemiBold', fontSize: 12, color: C.green },
  scoreLabel: { fontFamily: 'Saira_600SemiBold', fontSize: 11, color: C.dim },
  scoreValue: { fontFamily: 'Saira_700Bold', fontSize: 11.5, color: '#fff' },

  chatBtn: {
    width: 56, height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(47,143,255,0.6)',
    backgroundColor: 'rgba(8,26,64,0.92)', alignItems: 'center', justifyContent: 'center',
    ...(glow(C.blue, 0.28, 14) as object),
  },
  unread: {
    position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, paddingHorizontal: 5,
    borderRadius: 10, backgroundColor: '#ff2d4d', borderWidth: 1.5, borderColor: '#0a0d22',
    alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { fontFamily: 'Saira_700Bold', fontSize: 11, color: '#fff' },

  diceBtn: {
    width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#8b5cf6',
    backgroundColor: 'rgba(46,20,110,0.95)', alignItems: 'center', justifyContent: 'center',
    ...(glow('#8b5cf6', 0.5, 26) as object),
  },
  diceInnerRing: {
    position: 'absolute', left: 6, right: 6, top: 6, bottom: 6, borderRadius: 42,
    borderWidth: 1, borderColor: 'rgba(180,150,255,0.35)',
  },
  diceLabel: { fontFamily: 'Saira_700Bold', fontSize: 15, letterSpacing: 1.8, color: '#fff' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionLabel: {
    fontFamily: 'SairaCondensed_700Bold', fontSize: 12, letterSpacing: 2.6, color: '#3fe0ff',
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: 'rgba(150,190,235,0.28)' },
  sectionHint: { fontFamily: 'Saira_400Regular', fontSize: 10.5, color: 'rgba(198,212,240,0.6)' },

  handCard: {
    flex: 1, height: 104, borderRadius: 13, borderWidth: 1.5, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 6, paddingVertical: 9,
  },
  handName: { fontFamily: 'Saira_700Bold', fontSize: 10.5, letterSpacing: 0.3 },
  pipRow: { flexDirection: 'row', gap: 3, alignSelf: 'stretch' },
  pip: { flex: 1, height: 6, borderRadius: 2 },
  handRing: { position: 'absolute', left: -1.5, right: -1.5, top: -1.5, bottom: -1.5, borderRadius: 14, borderWidth: 2 },

  iBtn: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1,
    borderColor: 'rgba(150,190,235,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  iBtnText: { fontFamily: 'Saira_700Bold', fontSize: 10, color: '#dce6ff' },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,3,10,0.6)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 28,
    borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#080b20',
    borderTopWidth: 1.5, borderColor: 'rgba(110,140,210,0.32)',
  },
  sheetTitle: { fontFamily: 'Saira_700Bold', fontSize: 17, color: '#fff' },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1.5,
    borderColor: 'rgba(150,190,235,0.42)', alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 15, color: '#dce6ff' },
  sheetGrid: {
    marginTop: 12, flexDirection: 'row', borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(110,140,210,0.26)', backgroundColor: 'rgba(8,11,30,0.8)', overflow: 'hidden',
  },
  sheetCell: { flex: 1, paddingVertical: 12, paddingHorizontal: 7, alignItems: 'center', gap: 6 },
  sheetCellDivider: { borderRightWidth: 1, borderRightColor: 'rgba(110,140,210,0.2)' },
  sheetName: { fontFamily: 'Saira_700Bold', fontSize: 12.5 },
  sheetDesc: { fontFamily: 'Saira_400Regular', fontSize: 9.5, lineHeight: 13, color: 'rgba(198,212,240,0.7)', textAlign: 'center' },
});
