import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
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

export const ChatIcon = ({ size = 24, color = boardColors.blueSoft }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7}
       strokeLinejoin="round">
    <Path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.4 3.4V16H6.5A2.5 2.5 0 0 1 4 13.5z" />
    {[8.6, 12, 15.4].map((x, i) => (
      <Circle key={i} cx={x} cy={10} r={1.25} fill={color} stroke="none" />
    ))}
  </Svg>
);

/** Vương miện - dấu hiệu chủ phòng, thay cho chữ "(HOST)". */
export const CrownIcon = ({ size = 15, color = boardColors.amber }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M3 8.5l4.2 3.1L12 4.6l4.8 7 4.2-3.1-1.7 9.6H4.7z" />
    <Rect x={4.4} y={18.4} width={15.2} height={2.2} rx={1.1} />
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

/**
 * Pha một màu hex về phía trắng.
 *
 * Dùng để dựng viền gradient kiểu ống neon: sáng ở hai mép, đậm ở giữa - cùng
 * công thức `mid → stroke → mid` mà `src/theme/colors.ts` dùng cho các nút.
 */
export function lighten(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  const r = mix(parseInt(clean.slice(0, 2), 16));
  const g = mix(parseInt(clean.slice(2, 4), 16));
  const b = mix(parseInt(clean.slice(4, 6), 16));
  return `rgb(${r},${g},${b})`;
}

/**
 * Viền phát sáng NHỊP NHÀNG cho người đang tới lượt.
 *
 * ⚠️ Chạy bằng Reanimated (UI thread), KHÔNG bằng React state - đây là quy ước
 * bắt buộc của dự án (xem AGENTS.md). JS thread của app này sẽ bận vì poll và
 * sau đó là packet SignalR; nhịp sáng chạy trên JS thread sẽ giật.
 *
 * Là một lớp phủ riêng chứ không phải style của chính thẻ: `boxShadow` là chuỗi
 * nên không nội suy được, còn `opacity` của một lớp phủ thì có.
 *
 * ⚠️ Bên dưới lớp này **đừng để viền xanh TĨNH**. Đã dính một lần: viền tĩnh
 * cùng màu làm nhịp sáng chìm hẳn, nhìn chỉ thấy một viền xanh đứng yên dù
 * animation vẫn chạy (đo được biên độ ~29/255). Để nền trung tính thì màu xanh
 * hiện lên rồi tắt đi theo nhịp, không thể nhầm.
 */
export const TurnPulse = ({ radius = 10 }: { radius?: number }) => {
  const glow = useSharedValue(0.12);

  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 780, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [glow]);

  const style = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.turnPulse, { borderRadius: radius }, style]}
    />
  );
};

/* ── bài ───────────────────────────────────────────── */

/**
 * Bốn loại bài, khoá theo `CardId` mà server gửi xuống.
 *
 * `max` là trần số lá của luật chơi (GAME_RULES mục 6): 3 mỗi loại, riêng Joker
 * 1. Nó quyết định số chấm vẽ dưới mỗi lá - đừng suy ra từ `Quantity` hiện có,
 * người chơi hết bài thì hàng chấm sẽ biến mất.
 */
export const CARD_STYLES = {
  Joker:      { accent: boardColors.purple,  glow: 'rgba(200,107,255,0.55)', tint: '#2A1150', max: 1, Icon: JokerIcon },
  Skipper:    { accent: boardColors.blueSoft, glow: 'rgba(47,143,255,0.55)', tint: '#0A2450', max: 3, Icon: SkipperIcon },
  Eliminator: { accent: '#F9B23F',            glow: 'rgba(245,158,11,0.55)', tint: '#452703', max: 3, Icon: EliminatorIcon },
  Changer:    { accent: '#FF7FB8',            glow: 'rgba(255,95,168,0.55)', tint: '#4A0A2C', max: 3, Icon: ChangerIcon },
} as const;

/*
 * ⚠️ `tint` phải là màu ĐẶC (hex), không phải `rgba(...)` trong suốt.
 *
 * Trước đây dùng rgba nên nền chấm halftone của màn hình xuyên qua thân lá bài,
 * nhìn rất rối. Lá bài cần là một mặt phẳng đục để icon và chữ nổi lên.
 */

export type CardKey = keyof typeof CARD_STYLES;

export const CARD_ORDER: CardKey[] = ['Joker', 'Skipper', 'Eliminator', 'Changer'];

export const HandTile = ({
  cardKey,
  label,
  count,
  dimmed,
  compact,
  usable,
  active,
  onPress,
}: {
  cardKey: CardKey;
  label: string;
  count: number;
  dimmed: boolean;
  /**
   * Lá này BẤM ĐƯỢC ngay bây giờ - bản web cho nó rung (`cardshaking`).
   * Ở đây làm viền sáng lên thay vì rung: màn nhỏ, bốn lá rung một lúc rất rối.
   */
  usable?: boolean;
  /** Lá ĐANG CÓ TÁC DỤNG cho câu hỏi này (`used-highlight` của bản web). */
  active?: boolean;
  /** Có thì lá thành nút. Không có thì vẫn chỉ là ô hiển thị như cũ. */
  onPress?: () => void;
  /**
   * Bố cục nằm ngang: lá bài chỉ rộng ~56dp thay vì ~78dp, và "ELIMINATOR" bị
   * cắt ở cỡ chữ thường. Chỉ hạ cỡ chữ ở đó, đừng hạ chung - bản dọc rộng rãi
   * và chữ nhỏ hơn sẽ khó đọc.
   */
  compact?: boolean;
}) => {
  const style = CARD_STYLES[cardKey];

  /*
   * Hết lá loại này -> làm NHẠT, không làm TỐI.
   *
   * Trước đây thẻ hết bài bị phủ tối chồng lên nền vốn đã tối, thành ra không
   * đọc nổi tên thẻ. Nhạt đi vẫn nói được "không dùng được" mà vẫn nhìn rõ
   * mình đang thiếu lá nào.
   */
  const empty = count === 0;

  const Box: React.ElementType = onPress ? Pressable : View;

  return (
    <Box
      onPress={onPress}
      style={[
        styles.handCard,
        compact && styles.handCardCompact,
        { borderColor: empty ? 'rgba(150,170,215,0.30)' : style.glow },
        usable && styles.handCardUsable,
        active && styles.handCardActive,
      ]}
    >
      <LinearGradient
        colors={empty ? ['#141A32', '#090B1C'] : [style.tint, '#090B1C']}
        style={fill}
      />
      {/*
        Làm mờ bằng một LỚP PHỦ, không phải `opacity` của cả thẻ.
        `opacity` làm cả lá bài trong suốt và nền màn hình lại xuyên qua - đúng
        thứ vừa phải sửa. Thẻ đã hết bài thì KHÔNG phủ thêm, nếu không sẽ tối
        chồng tối.
      */}
      {dimmed && !empty ? <View style={[fill, styles.handDim]} /> : null}
      <View style={empty ? styles.handIconEmpty : undefined}>
        <style.Icon size={compact ? 26 : 30} />
      </View>

      {/*
        Bản `compact` xếp NGANG: icon bên trái, tên + chấm bên phải.
        Xếp dọc thì chiều cao ăn hết chỗ mà bề ngang lại thừa - đúng ngược với
        thứ lá bài cần khi nằm trong cột hẹp của bố cục ngang.
      */}
      <View style={compact ? styles.handTextRow : undefined}>
        <Text
          style={[
            styles.handName,
            compact && styles.handNameCompact,
            { color: empty ? 'rgba(198,212,240,0.75)' : style.accent },
          ]}
          numberOfLines={1}
        >
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
                  : { backgroundColor: 'rgba(200,215,255,0.30)' },
              ]}
            />
          ))}
        </View>
      </View>
    </Box>
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
          /*
           * 1.45 chứ không phải 1.2: glyph ★ thò xuống dưới đường cơ sở, để
           * lineHeight sát quá thì bị cắt mất chân - thấy rõ ở ô người chơi khi
           * tăng cỡ sao lên.
           */
          lineHeight: size * 1.45,
          /*
           * Chưa có: XÁM SÁNG, cùng tông với chấm rỗng của thẻ bài - vàng mờ
           * dễ bị nhìn thành "sao đã có nhưng tối", xám thì rõ là chưa có.
           * Đã có: vàng sáng hơn amber gốc cho nổi trên nền tối.
           */
          color: i < filled ? '#FFD23F' : 'rgba(200,215,255,0.30)',
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
  <LinearGradient
    /*
     * Viền GRADIENT theo màu nhân vật - React Native không có `borderImage`,
     * nên cách duy nhất là một lớp gradient bọc ngoài, chừa 1.5px làm viền,
     * rồi đặt thân thẻ (nền đục) lên trên.
     *
     * Sáng ở hai mép, đậm ở giữa: bắt chước ống neon thật, cùng công thức
     * `mid → stroke → mid` của các nút trong app.
     */
    colors={[
      lighten(player.PlayerColor || '#2F8FFF', 0.5),
      player.PlayerColor || '#2F8FFF',
      lighten(player.PlayerColor || '#2F8FFF', 0.5),
    ]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.playerRim}
  >
  <View style={[styles.playerTile, isTurn && styles.playerTileTurn]}>
    <View style={styles.playerMedia}>
      <View style={[fill, { backgroundColor: 'rgba(24,30,60,0.9)' }]} />
      {player.CharacterId ? (
        <Image
          source={{ uri: characterImageUrl(player.CharacterId) }}
          style={fill}
          resizeMode="contain"
        />
      ) : null}

      {/*
        Vệt đen mờ dần từ đáy lên, dừng ngay trên chỗ đặt tên.
        Không có nó thì tên trắng nằm đè lên bụng nhân vật sáng màu và không
        đọc nổi - nhân vật nào cũng có mảng sáng ở giữa thân.
      */}
      <LinearGradient
        colors={['transparent', 'rgba(4,6,16,0.72)', 'rgba(4,6,16,0.96)']}
        locations={[0, 0.4, 1]}
        style={styles.playerScrim}
      />

      {/*
        Tên ĐÈ LÊN ảnh nhân vật, chừa sẵn đúng HAI dòng và không bao giờ tràn
        sang dòng thứ ba (`numberOfLines={2}`). Chiều cao cố định giữ mọi ô cao
        bằng nhau dù tên một chữ hay hai dòng - không thì dải trên so le và bàn
        cờ bị đẩy lên xuống mỗi lần có người đổi tên.
      */}
      {/*
        Bọc trong View căn ĐÁY: `Text` không căn dọc được, nên tên một dòng
        trong khung cao hai dòng sẽ dính lên đỉnh khung - tức nằm giữa bụng
        nhân vật thay vì sát mép dưới.
      */}
      <View style={styles.playerNameBox}>
        <Text style={styles.playerName} numberOfLines={2} ellipsizeMode="tail">
          {player.IsSetupNickName ? player.NickName : emptyLabel}
        </Text>
      </View>
    </View>

    {/* Điểm nằm TRÊN hàng sao, căn giữa, không nền. */}
    <Text style={[styles.playerScore, { color: player.PlayerColor || boardColors.blue }]}>
      {player.Point}
    </Text>

    <View style={styles.playerStars}>
      {/*
        Cỡ 13, KHÔNG to hơn: ô chỉ rộng 20% màn hình, năm ngôi sao cỡ 15 là
        tràn và bị mép ô cắt mất sao ngoài cùng.
      */}
      <Stars filled={player.Stars} size={13} />
    </View>
  </View>

  {/*
    Nhịp sáng nằm NGOÀI thân thẻ, ngay trong lớp viền gradient.
    Để bên trong thì `overflow: 'hidden'` của thân thẻ (cần có, nếu không ảnh
    nhân vật đè lên viền ở hai góc trên) sẽ cắt luôn quầng sáng.
  */}
  {isTurn ? <TurnPulse radius={10} /> : null}
  </LinearGradient>
);

const styles = StyleSheet.create({
  playerRim: {
    // KHÔNG `flex: 1`: bề ngang do ô cha quyết định (game.tsx cấp đúng 20%).
    borderRadius: 10,
    padding: 1.5,
  },
  playerTile: {
    borderRadius: 9,
    /*
     * Nền gần như đen, khớp với đuôi vệt tối phủ dưới tên (`rgba(4,6,16,.96)`)
     * -> vùng tên, điểm và sao liền một mảng, không thấy đường gãy màu.
     */
    backgroundColor: '#04060F',
    /*
     * ⚠️ PHẢI cắt: ảnh nhân vật lấp đầy ô nên hai góc trên của nó đè lên viền
     * gradient bo tròn. `TurnPulse` đã chuyển ra ngoài nên không bị cắt theo.
     */
    overflow: 'hidden',
    /*
     * ⚠️ KHÔNG `overflow: 'hidden'`.
     *
     * Nó cắt luôn `boxShadow` nên viền xanh lúc tới lượt chỉ đổi màu mà KHÔNG
     * phát sáng. Bo góc đã có `borderRadius`, còn ảnh nhân vật thì `contain`
     * nên vốn không tràn ra ngoài.
     */
  },
  // Thấp hơn một chút so với bản đầu (74) để nhân vật có khoảng thở.
  // Quầng sáng hai lớp: lõi gắt sát viền + vầng loang nhẹ, cùng hệ với các
  // hiệu ứng neon khác của app (xem src/theme/colors.ts).
  // Thân thẻ không còn viền riêng (viền là lớp gradient bọc ngoài), nên
  // trạng thái tới lượt chỉ do lớp `TurnPulse` thể hiện.
  playerTileTurn: {},
  /** Lớp phủ nhịp sáng - xem `TurnPulse`. */
  turnPulse: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderWidth: 2,
    borderColor: boardColors.green,
    boxShadow: '0 0 12px rgba(46,232,95,0.9), 0 0 26px rgba(46,232,95,0.45)',
    zIndex: 2,
  },
  /*
   * Cao hơn trước vì TÊN giờ nằm đè bên trong ô ảnh, không còn hàng riêng.
   * Phần nhân vật thực tế vẫn bằng cũ: 76 trừ đi ~26 của hai dòng tên.
   */
  playerMedia: { height: 76, position: 'relative', paddingTop: 6, overflow: 'hidden' },
  playerScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 48 },
  playerNameBox: {
    position: 'absolute',
    left: 3,
    right: 3,
    bottom: 3,
    // Chừa đúng hai dòng chữ 10px (lineHeight 12); tên ngắn dồn xuống đáy.
    height: 24,
    justifyContent: 'flex-end',
  },
  playerName: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  playerScore: {
    // Sát vào hàng sao: lineHeight của ★ đã chừa sẵn khoảng trống phía trên.
    height: 17,
    lineHeight: 17,
    marginBottom: -2,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  playerStars: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 3,
  },

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
  // Phủ tối lên thân lá bài, giữ nguyên độ đục. Xem ghi chú ở HandTile.
  /*
   * Lá dùng được: viền dày + quầng trắng. Bản web cho nó RUNG (`cardshaking`);
   * Tony chốt không cần rung, nên độ nổi phải đến từ viền và quầng.
   */
  handCardUsable: {
    borderWidth: 2.5,
    boxShadow: '0 0 16px rgba(255,255,255,0.75)',
  },
  /* Lá đang có tác dụng cho câu hỏi này. */
  handCardActive: {
    borderColor: '#FFC61E',
    borderWidth: 2,
    boxShadow: '0 0 16px rgba(255,198,30,0.75)',
  },
  /*
   * ⚠️ 0.38 là KHÔNG ĐỦ. Đo trên máy 2026-09-09: lá bị làm mờ chỉ tối đi 0,8-5
   * đơn vị độ sáng so với lúc thường - mắt không nhận ra, mà cả điểm của luật
   * này là để người chơi thấy NGAY còn hai lá nào dùng được.
   *
   * Vẫn dùng LỚP PHỦ chứ không phải `opacity` của cả thẻ - xem ghi chú ở chỗ
   * dùng nó.
   */
  handDim: { backgroundColor: 'rgba(6,8,20,0.68)' },
  handIconEmpty: { opacity: 0.5 },
  handName: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4 },
  // Xếp ngang nên thấp hơn nữa. Lề quanh icon để HẸP: mỗi dp lề là một dp
  // chữ mất đi, mà cột phải vốn đã chật.
  handCardCompact: { height: 50, flexDirection: 'row', gap: 5, paddingHorizontal: 5 },
  handTextRow: { alignItems: 'flex-start', gap: 4 },
  handNameCompact: { fontSize: 9, letterSpacing: 0.2 },
  pipRow: { flexDirection: 'row', gap: 4 },
  pip: { width: 6, height: 6, borderRadius: 3 },
});
