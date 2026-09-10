import { useEffect } from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '../i18n/I18nProvider';
import type { LeaderboardRow } from '../api/game';
import { text } from '../theme/colors';

/**
 * MÀN XẾP HẠNG cuối ván — **chỉ** thể thức Leaderboard Challenge.
 *
 * Luật ở GAME_RULES mục **15b**: ván tính giờ không ghi `RecordScores` nên
 * không có gì để xếp hạng; chỉ ván `TotalRollDice > 0` mới tới được đây.
 *
 * Dựng trên bộ tranh riêng trong `assets/leaderboard/` (Tony gửi 2026-09-10),
 * chứ không vẽ bằng khối màu: `arena.png` làm nền, `podium.png` là bục sáu chỗ,
 * hai dải `title-*.png` làm tiêu đề, `btn-back.png` làm nút ra.
 *
 * ⚠️ **`podium.png` cố định SÁU chỗ theo thế 3 cao + 3 thấp.** Đó là lý do bố
 * cục là bục giữa màn chứ không phải hai cột: chia đôi màn là chống lại chính
 * bức tranh. Bảng chung của server cũng đúng **top 6** (`Take(6)`), khớp sẵn.
 */

/**
 * Sáu mặt bục, tính theo PHẦN TRĂM khung ảnh `podium.png`.
 *
 * ⚠️ Đo bằng mã (quét kênh alpha của chính tấm ảnh), không ướm bằng mắt: lệch
 * vài phần trăm là chữ leo lên viền neon và tấm ảnh trông như bị lỗi. Đổi tranh
 * thì phải đo lại — quy trình ghi ở TEST_CASES **K46**.
 *
 * Thứ tự mảng = thứ hạng 1..6, KHÔNG phải thứ tự trái sang phải: hạng nhất là
 * bục vàng ở giữa.
 */
const SLOTS = [
  { left: '38.5%', top: '17%', width: '23%', height: '33%', tall: true },
  { left: '13.5%', top: '26%', width: '19%', height: '24%', tall: true },
  { left: '67.5%', top: '27%', width: '19.5%', height: '23%', tall: true },
  { left: '14.5%', top: '76%', width: '15.5%', height: '11%', tall: false },
  { left: '40.5%', top: '76%', width: '18%', height: '11%', tall: false },
  { left: '68.5%', top: '76%', width: '17%', height: '11%', tall: false },
] as const;

/**
 * Tỉ lệ thật của `podium.png` (1578×692).
 *
 * ⚠️ Khung bọc PHẢI đúng tỉ lệ này. Bản đầu để khung `flex: 1` rồi vẽ ảnh bằng
 * `contain`: ảnh co lại nằm giữa khung, còn sáu ô chữ vẫn tính theo phần trăm
 * của KHUNG - thành ra tên và điểm trôi hẳn ra ngoài mặt bục. Nhìn ảnh chụp là
 * thấy ngay, nhưng đọc mã thì không.
 */
const PODIUM_RATIO = 1578 / 692;

/** Màu điểm của từng bục, lấy theo đúng màu neon trong tranh. */
const SLOT_COLOR = ['#FFD46A', '#A9CCFF', '#FF9E80', '#FF6BA8', '#C79BFF', '#5FE39C'];

const ARENA = require('../../assets/leaderboard/arena.png');
const PODIUM = require('../../assets/leaderboard/podium.png');
const TITLE_CROWN = require('../../assets/leaderboard/title-crown.png');
const TITLE_PLAIN = require('../../assets/leaderboard/title-plain.png');
const BTN_BACK = require('../../assets/leaderboard/btn-back.png');

export function LeaderboardStage({
  global: globalRows,
  current,
  meId,
  message,
  onLeave,
}: {
  /** Top 6 toàn giải. Thiếu người thì bục đó để trống, đúng như bảng vàng thật. */
  global: LeaderboardRow[];
  /** Người trong ván này — mang **hạng và điểm TOÀN CỤC**, xem `LeaderboardRow`. */
  current: LeaderboardRow[];
  meId: string | null;
  message?: string | null;
  onLeave: () => void;
}) {
  const t = useT();

  /*
   * ⚠️ Khung này nằm ở GỐC màn hình nên KHÔNG thừa hưởng lề an toàn của màn ván
   * chơi. Bỏ qua là thanh trạng thái đè lên nút back và thanh điều hướng cắt mất
   * cột cuối của bảng kết quả - đã thấy tận mắt trên SM-A175F.
   */
  const insets = useSafeAreaInsets();

  /*
   * Bục dựng lên theo thứ tự NGƯỢC: 6 trước, 1 sau cùng. Cùng nhịp với mọi lễ
   * trao giải - đọc từ dưới lên thì cái cuối cùng mới là cái đáng chờ.
   */
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withDelay(120, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [rise]);

  const stage = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ scale: 0.94 + rise.value * 0.06 }],
  }));

  return (
    <ImageBackground source={ARENA} style={styles.root} resizeMode="cover">
      {/* Phủ thêm một lớp tối: tranh nền sáng, chữ trắng đặt thẳng lên sẽ chìm. */}
      <View style={styles.dim} />

      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(10, insets.top + 4),
            paddingLeft: 12 + insets.left,
            paddingRight: 12 + insets.right,
          },
        ]}
      >
        <Pressable
          onPress={onLeave}
          accessibilityRole="button"
          accessibilityLabel={t('gameOver.leave')}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Image source={BTN_BACK} style={styles.backImg} resizeMode="contain" />
        </Pressable>

        <View style={styles.titleWrap}>
          <Image source={TITLE_CROWN} style={styles.titleImg} resizeMode="contain" />
          {/*
            ⚠️ Bó chữ vào KHOẢNG GIỮA HAI VƯƠNG MIỆN (~58% bề ngang dải), không
            phải cả dải: để rộng thì chữ đè lên hai cái vương miện của tranh.
          */}
          <Text style={styles.titleText} numberOfLines={1} adjustsFontSizeToFit>
            {t('gameOver.global')}
          </Text>
        </View>

        {/* Giữ cân: cùng bề ngang với nút back để dải tiêu đề nằm ĐÚNG giữa. */}
        <View style={styles.backImg} />
      </View>

      <View style={styles.podiumArea}>
        <Animated.View style={[styles.podiumBox, stage]}>
          <Image source={PODIUM} style={styles.podiumImg} resizeMode="stretch" />

          {SLOTS.map((slot, i) => {
            const row = globalRows[i];
            if (!row) return null;
            const isMe = row.PlayerId === meId;
            return (
              <View key={i} style={[styles.slot, slot]}>
                {/*
                  Số hạng phải VIẾT RA: tranh để mặt bục trắng trơn, mà thế đứng
                  cao thấp chỉ nói được ai nhất - ba bục hàng dưới bằng nhau thì
                  không ai đoán nổi đâu là 4, đâu là 6.

                  ⚠️ Hàng dưới ghép số vào CÙNG DÒNG với tên. Tách thành ba dòng
                  thì dòng đầu rơi đúng lên đỉnh neon sáng của bục và số biến mất
                  hẳn - đã thấy trên ảnh chụp máy thật.
                */}
                {slot.tall ? (
                  <Text
                    style={[styles.slotRank, { color: SLOT_COLOR[i] }]}
                    numberOfLines={1}
                  >
                    {i + 1}
                  </Text>
                ) : null}

                <View style={styles.slotNameRow}>
                  {!slot.tall ? (
                    <Text style={[styles.slotRankSmall, { color: SLOT_COLOR[i] }]}>
                      {i + 1}
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      slot.tall ? styles.slotName : styles.slotNameSmall,
                      isMe && styles.slotMine,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {row.PlayerName}
                  </Text>
                </View>

                <Text
                  style={[
                    slot.tall ? styles.slotScore : styles.slotScoreSmall,
                    { color: SLOT_COLOR[i] },
                  ]}
                  numberOfLines={1}
                >
                  {row.Score.toLocaleString()}
                </Text>
              </View>
            );
          })}
        </Animated.View>
      </View>

      <View
        style={[
          styles.footer,
          {
            paddingLeft: 14 + insets.left,
            paddingRight: 14 + insets.right,
            paddingBottom: 10 + insets.bottom,
          },
        ]}
      >
        <View style={styles.bandWrap}>
          <Image source={TITLE_PLAIN} style={styles.bandImg} resizeMode="contain" />
          <Text style={styles.bandText} numberOfLines={1} adjustsFontSizeToFit>
            {t('gameOver.currentMatch')}
          </Text>
        </View>

        {/*
          Hàng NGANG chứ không phải danh sách dọc: thể thức này nhiều nhất 4
          người (GAME_RULES mục 15), mà màn nằm ngang thì chiều cao mới là thứ
          hiếm - xếp dọc là đẩy chính hàng của người chơi xuống dưới mép.
        */}
        <View style={styles.cards}>
          {current.map((row) => {
            const isMe = row.PlayerId === meId;
            return (
              <View key={row.PlayerId} style={[styles.card, isMe && styles.cardMine]}>
                <Text style={[styles.cardRank, isMe && styles.cardRankMine]} numberOfLines={1}>
                  {row.Rank}
                </Text>
                <Text style={[styles.cardName, isMe && styles.cardNameMine]} numberOfLines={1}>
                  {row.PlayerName}
                  {isMe ? t('gameOver.youSuffix') : ''}
                </Text>
                <Text style={styles.cardScore} numberOfLines={1}>
                  {row.Score.toLocaleString()}
                </Text>
              </View>
            );
          })}
        </View>

        {message ? (
          <Text style={styles.message} numberOfLines={1}>
            {message}
          </Text>
        ) : null}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,3,20,0.35)' },

  header: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { justifyContent: 'center' },
  backImg: { width: 92, height: 46 },
  pressed: { opacity: 0.7 },
  titleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleImg: { width: '86%', height: 62 },
  titleText: {
    position: 'absolute',
    width: '58%',
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#FDE68A',
  },

  podiumArea: { flex: 1, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  /* Đúng tỉ lệ ảnh -> phần trăm của khung KHỚP phần trăm của tranh. */
  podiumBox: { height: '100%', aspectRatio: PODIUM_RATIO, maxWidth: '96%' },
  podiumImg: { width: '100%', height: '100%' },
  slot: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  slotRank: { fontSize: 17, fontWeight: '900', lineHeight: 19 },
  slotRankSmall: { fontSize: 12, fontWeight: '900', lineHeight: 14 },
  slotNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  slotName: { fontSize: 14.5, fontWeight: '800', lineHeight: 18, color: '#fff' },
  slotNameSmall: { fontSize: 11, fontWeight: '800', lineHeight: 13, color: '#fff' },
  slotScore: { fontSize: 24, fontWeight: '900', lineHeight: 28 },
  slotScoreSmall: { fontSize: 15, fontWeight: '900', lineHeight: 17 },
  slotMine: { color: '#FDE68A' },

  footer: {},
  bandWrap: { alignItems: 'center', justifyContent: 'center' },
  bandImg: { width: '54%', height: 34 },
  bandText: {
    position: 'absolute',
    width: '40%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#E9D5FF',
  },
  cards: { flexDirection: 'row', gap: 10, marginTop: 6 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.4,
    borderColor: 'rgba(129,140,248,0.55)',
    backgroundColor: 'rgba(10,6,32,0.72)',
  },
  cardMine: { borderColor: '#FDE68A', backgroundColor: 'rgba(60,44,8,0.6)' },
  cardRank: { fontSize: 12, fontWeight: '900', color: 'rgba(199,210,254,0.85)' },
  cardRankMine: { color: '#FDE68A' },
  cardName: { flex: 1, fontSize: 14, fontWeight: '800', color: text.primary },
  cardNameMine: { color: '#FDE68A' },
  cardScore: { fontSize: 17, fontWeight: '900', color: '#fff' },

  message: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(226,232,255,0.6)',
  },
});
