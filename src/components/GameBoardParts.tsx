import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Path,
  Rect,
  Stop,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg';

import { characterImageUrl, type GameCard, type GamePlayer } from '../api/game';
import { text } from '../theme/colors';

/**
 * Các mảnh của màn bàn cờ, chuyển từ `designs/GameBoardScreen.tsx`.
 *
 * Ba chỗ BẮT BUỘC lệch với file design, đừng chép ngược lại:
 *
 * 1. Design dùng `Platform.select({ios: {shadowColor...}, android: {elevation}})`.
 *    Trên Android `elevation` không đổi được màu nên mọi quầng neon thành bóng
 *    xám. Dự án dùng `boxShadow` (RN 0.76+) - xem AGENTS.md.
 * 2. Design dùng `StyleSheet.absoluteFillObject`. RN 0.86 bỏ khai báo kiểu của
 *    nó, và trên `<Image>` thì nó không có tác dụng. Dùng hằng `fill` dưới đây.
 * 3. Design đặt `fontFamily: 'Saira_700Bold'`. Dự án CHƯA cài `expo-font` nên
 *    tên đó không phân giải được; đã đổi hết sang `fontWeight`.
 */

export const boardColors = {
  blue: '#2F8FFF',
  blueSoft: '#7FC0FF',
  purple: '#C86BFF',
  green: '#2EE85F',
  amber: '#FFC61E',
  red: '#FF3B4E',
  dim: 'rgba(198,212,240,0.72)',
  panel: 'rgba(10,13,34,0.8)',
  hair: 'rgba(110,140,210,0.24)',
} as const;

/** Thay cho `StyleSheet.absoluteFillObject` - xem ghi chú số 2 ở trên. */
export const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/* ── icons ─────────────────────────────────────────── */

export const LockIcon = ({ color = '#FF6B78', size = 13 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}
       strokeLinecap="round">
    <Rect x={5} y={10.5} width={14} height={9.5} rx={2.2} />
    <Path d="M8.4 10.5V7.6a3.6 3.6 0 0 1 7.2 0v2.9" />
  </Svg>
);

export const InfoIcon = ({ size = 17, color = '#CDDCFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9}
       strokeLinecap="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 10.6v6" />
    <Circle cx={12} cy={7.6} r={1.05} fill={color} stroke="none" />
  </Svg>
);

export const PawnIcon = ({ color = boardColors.green, size = 14 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 3a3.4 3.4 0 0 1 2.1 6.1c1.6 1 2.6 2.6 2.6 4.3H7.3c0-1.7 1-3.3 2.6-4.3A3.4 3.4 0 0 1 12 3z" />
    <Path d="M6.4 16.2h11.2l1.4 4.6H5z" />
  </Svg>
);

export const BookIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#CDDCFF" strokeWidth={1.7}
       strokeLinejoin="round">
    <Path d="M3.5 5.2c2.6-1 5.7-1 8.5.9 2.8-1.9 5.9-1.9 8.5-.9v13c-2.6-1-5.7-1-8.5.9-2.8-1.9-5.9-1.9-8.5-.9z" />
    <Path d="M12 6.1v12.9" />
  </Svg>
);

export const Dice3D = ({ size = 56 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Defs>
      <SvgLinearGradient id="diceTop" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#D6C6FF" />
        <Stop offset="1" stopColor="#9D7BFF" />
      </SvgLinearGradient>
      <SvgLinearGradient id="diceLeft" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#6B3FD4" />
        <Stop offset="1" stopColor="#3D1F8A" />
      </SvgLinearGradient>
      <SvgLinearGradient id="diceRight" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#8F63F0" />
        <Stop offset="1" stopColor="#5628AD" />
      </SvgLinearGradient>
    </Defs>
    <Path d="M24 5 42 15 24 25 6 15z" fill="url(#diceTop)" />
    <Path d="M6 15 24 25v18L6 33z" fill="url(#diceLeft)" />
    <Path d="M42 15 24 25v18l18-10z" fill="url(#diceRight)" />
    <Path d="M24 5 42 15 24 25 6 15z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
    <Ellipse cx={24} cy={15} rx={3.4} ry={1.9} fill="#2B1560" opacity={0.8} />
    <Circle cx={11.5} cy={23.5} r={1.9} fill="#E6DCFF" opacity={0.92} />
    <Circle cx={15} cy={30.5} r={1.9} fill="#E6DCFF" opacity={0.92} />
    <Circle cx={18.5} cy={37.5} r={1.9} fill="#E6DCFF" opacity={0.92} />
    <Circle cx={30} cy={29} r={1.9} fill="#F2ECFF" opacity={0.95} />
    <Circle cx={36.5} cy={34.5} r={1.9} fill="#F2ECFF" opacity={0.95} />
  </Svg>
);

const JokerIcon = ({ size = 30 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={boardColors.purple}
       strokeWidth={1.7} strokeLinejoin="round">
    <Path d="M12 2.8l2.1 5.3 5.6 1.4-4 4 .6 5.7-4.3-2.5-4.3 2.5.6-5.7-4-4 5.6-1.4z" />
  </Svg>
);

const SkipperIcon = ({ size = 30 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={boardColors.blueSoft}>
    <Path d="M4.5 5.5 12 12l-7.5 6.5z" />
    <Path d="M12.5 5.5 20 12l-7.5 6.5z" />
  </Svg>
);

const EliminatorIcon = ({ size = 30 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#F9B23F" strokeWidth={2.4}
       strokeLinecap="round">
    <Path d="M6.5 4.5 17.5 14" />
    <Path d="M17.5 4.5 6.5 14" />
    <Path d="M6 18h12" />
    <Path d="M7.5 21h9" />
  </Svg>
);

const ChangerIcon = ({ size = 30 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FF7FB8" strokeWidth={1.9}
       strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5.5 18.5c0-6 3.2-9.5 8-9.5" />
    <Path d="M10.2 5.6 14 9l-3.8 3.4" />
    <Path d="M15.5 15h5.5" />
    <Path d="M15.5 19h5.5" />
  </Svg>
);

/* ── bài ───────────────────────────────────────────── */

/**
 * Bốn loại bài, khoá theo `CardId` mà server gửi xuống.
 *
 * `max` là trần số lá của luật chơi (GAME_RULES mục 6): 3 mỗi loại, riêng Joker
 * 1. Nó quyết định số chấm vẽ dưới mỗi lá - đừng suy ra từ `Quantity` hiện có,
 * người chơi hết bài thì hàng chấm sẽ biến mất.
 */
export const CARD_STYLES = {
  Joker:      { accent: boardColors.purple, glow: 'rgba(200,107,255,0.55)', tint: 'rgba(52,18,96,0.85)',  max: 1, Icon: JokerIcon },
  Skipper:    { accent: boardColors.blueSoft, glow: 'rgba(47,143,255,0.55)', tint: 'rgba(12,44,100,0.85)', max: 3, Icon: SkipperIcon },
  Eliminator: { accent: '#F9B23F',           glow: 'rgba(245,158,11,0.55)', tint: 'rgba(84,48,4,0.85)',   max: 3, Icon: EliminatorIcon },
  Changer:    { accent: '#FF7FB8',           glow: 'rgba(255,95,168,0.55)', tint: 'rgba(88,12,52,0.85)',  max: 3, Icon: ChangerIcon },
} as const;

export type CardKey = keyof typeof CARD_STYLES;

export const CARD_ORDER: CardKey[] = ['Joker', 'Skipper', 'Eliminator', 'Changer'];

export const HandTile = ({
  cardKey,
  label,
  count,
  dimmed,
}: {
  cardKey: CardKey;
  label: string;
  count: number;
  dimmed: boolean;
}) => {
  const style = CARD_STYLES[cardKey];
  return (
    <View style={[styles.handCard, { borderColor: style.glow }, dimmed && styles.handDim]}>
      <LinearGradient colors={[style.tint, 'rgba(9,11,28,0.94)']} style={fill} />
      <style.Icon />
      <Text style={[styles.handName, { color: style.accent }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.pipRow}>
        {Array.from({ length: style.max }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.pip,
              i < count
                ? { backgroundColor: style.accent, boxShadow: `0 0 6px ${style.glow}` }
                : { backgroundColor: 'rgba(120,140,200,0.16)' },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

/** Gộp các lá cùng loại thành số lượng. Server trả mỗi lá một dòng. */
export function countCards(cards: GameCard[]): Record<CardKey, number> {
  const counts = { Joker: 0, Skipper: 0, Eliminator: 0, Changer: 0 };
  for (const card of cards) {
    if (card.IsUsed) continue;
    if (card.CardId in counts) counts[card.CardId] += card.Quantity;
  }
  return counts;
}

/* ── người chơi ────────────────────────────────────── */

export const Stars = ({ filled, size = 10 }: { filled: number; size?: number }) => (
  <View style={{ flexDirection: 'row' }}>
    {[0, 1, 2, 3, 4].map((i) => (
      <Text
        key={i}
        style={{
          fontSize: size,
          lineHeight: size * 1.2,
          color: i < filled ? boardColors.amber : 'rgba(255,198,30,0.28)',
        }}
      >
        ★
      </Text>
    ))}
  </View>
);

/**
 * Một ô người chơi trên dải ngang.
 *
 * KHÔNG có khung video/mic như bản thiết kế: dự án chưa có tầng truyền hình
 * ảnh nào, cả app lẫn server. Vẽ hai biểu tượng đó ra sẽ là hứa hẹn một tính
 * năng không tồn tại. Chỗ đó đang là ảnh nhân vật của người chơi.
 */
export const PlayerTile = ({
  player,
  isTurn,
  emptyLabel,
}: {
  player: GamePlayer;
  isTurn: boolean;
  emptyLabel: string;
}) => (
  <View
    style={[
      styles.playerTile,
      isTurn && { borderColor: boardColors.green, boxShadow: '0 0 10px rgba(46,232,95,0.45)' },
    ]}
  >
    <View style={styles.playerMedia}>
      <View style={[fill, { backgroundColor: 'rgba(24,30,60,0.9)' }]} />
      {player.CharacterId ? (
        <Image
          source={{ uri: characterImageUrl(player.CharacterId) }}
          style={fill}
          resizeMode="contain"
        />
      ) : null}
      <View style={[styles.scoreChip, { backgroundColor: player.PlayerColor || boardColors.blue }]}>
        <Text style={styles.scoreChipText}>{player.Point}</Text>
      </View>
    </View>
    <View style={styles.playerNameRow}>
      <Text style={styles.playerName} numberOfLines={1}>
        {player.IsSetupNickName ? player.NickName : emptyLabel}
      </Text>
    </View>
    <View style={styles.playerStars}>
      <Stars filled={player.Stars} />
      <Text style={styles.playerStarsText}>{player.Stars}/5</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  playerTile: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: boardColors.hair,
    backgroundColor: boardColors.panel,
    overflow: 'hidden',
  },
  playerMedia: { height: 74, position: 'relative' },
  playerNameRow: {
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(110,140,210,0.18)',
  },
  playerName: { fontSize: 10, fontWeight: '700', color: '#EAF1FF' },
  scoreChip: {
    position: 'absolute',
    left: 0,
    bottom: 5,
    height: 17,
    paddingHorizontal: 7,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    justifyContent: 'center',
  },
  scoreChipText: { fontSize: 11, fontWeight: '700', color: text.primary },
  playerStars: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  playerStarsText: { fontSize: 9, fontWeight: '700', color: 'rgba(198,212,240,0.8)' },

  handCard: {
    flex: 1,
    height: 92,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    overflow: 'hidden',
  },
  // Bài của người khác: mờ đi để không ai tưởng bấm được.
  handDim: { opacity: 0.55 },
  handName: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6 },
  pipRow: { flexDirection: 'row', gap: 4 },
  pip: { width: 6, height: 6, borderRadius: 3 },
});
