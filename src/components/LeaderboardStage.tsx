import { Fragment, useEffect, useState } from 'react';
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
 * ⚠️ **`podium.png` cố định SÁU chỗ.** Đó là lý do bố cục là một dải giữa màn
 * chứ không phải hai cột: chia đôi màn là chống lại chính bức tranh. Bảng chung
 * của server cũng đúng **top 6** (`Take(6)`), khớp sẵn.
 */

/**
 * Sáu chỗ trên `podium.png`, tính theo PHẦN TRĂM khung ảnh.
 *
 * Bộ tranh thứ BA (2026-09-11 sáng) là **sáu thẻ hiệu** đánh số sẵn 1-6 từ trái
 * sang phải. Mỗi thẻ có hai chỗ trống: **ô tối** ở giữa (tên) và **dải màu** bên
 * dưới (điểm). **Số hạng đã in trong tranh nên app KHÔNG vẽ số nữa** — vẽ đè là
 * hai con số chồng nhau.
 *
 * ⚠️ Mỗi ô là **hộp canh theo TÂM của vùng**, không phải theo mép — tên người
 * chơi dài ngắn khác nhau. `scripts/dev-podium-zones.py --badge` gom hàng tối
 * liền nhau thành ô tối, tìm dải màu ngay dưới, lấy tâm rồi dựng hộp quanh tâm.
 * Đổi tranh thì chạy lại, đừng ướm mắt.
 *
 * Lịch sử: v1 bục 3 cao + 3 thấp, v2 sáu cúp (hạng theo chiều cao, thứ tự
 * 4-2-1-3-5-6), v3 thẻ hiệu này. Bản gốc từng bộ ở `assets/leaderboard/original/`.
 */
const SLOTS = [
  { name: { left: '2.41%', top: '48.88%', width: '11.53%', height: '11.31%' },
    score: { left: '2.54%', top: '66.04%', width: '11.26%', height: '12.02%' } },
  { name: { left: '19.29%', top: '49.01%', width: '11.42%', height: '11.05%' },
    score: { left: '19.42%', top: '66.07%', width: '11.16%', height: '12.15%' } },
  { name: { left: '36.00%', top: '49.47%', width: '11.42%', height: '10.67%' },
    score: { left: '36.13%', top: '66.04%', width: '11.16%', height: '12.02%' } },
  { name: { left: '52.58%', top: '49.04%', width: '11.42%', height: '11.18%' },
    score: { left: '52.71%', top: '66.04%', width: '11.16%', height: '12.02%' } },
  { name: { left: '69.35%', top: '49.63%', width: '11.42%', height: '10.54%' },
    score: { left: '69.48%', top: '66.07%', width: '11.16%', height: '12.15%' } },
  { name: { left: '85.75%', top: '48.60%', width: '12.16%', height: '11.69%' },
    score: { left: '85.89%', top: '66.04%', width: '11.88%', height: '12.02%' } },
] as const;

/**
 * Tỉ lệ thật của `podium.png` (1634×551).
 *
 * ⚠️ Khung bọc PHẢI đúng tỉ lệ này. Bản đầu để khung `flex: 1` rồi vẽ ảnh bằng
 * `contain`: ảnh co lại nằm giữa khung, còn sáu ô chữ vẫn tính theo phần trăm
 * của KHUNG - thành ra tên và điểm trôi hẳn ra ngoài mặt bục. Nhìn ảnh chụp là
 * thấy ngay, nhưng đọc mã thì không.
 */
const PODIUM_RATIO = 1634 / 551;


const ARENA = require('../../assets/leaderboard/arena.png');
const PODIUM = require('../../assets/leaderboard/podium.png');
const TITLE_CROWN = require('../../assets/leaderboard/title-crown.png');
const TITLE_PLAIN = require('../../assets/leaderboard/title-plain.png');
const BTN_BACK = require('../../assets/leaderboard/btn-back.png');

export function LeaderboardStage({
  global: globalRows,
  current,
  meId,
  onLeave,
}: {
  /** Top 6 toàn giải. Thiếu người thì bục đó để trống, đúng như bảng vàng thật. */
  global: LeaderboardRow[];
  /** Người trong ván này — mang **hạng và điểm TOÀN CỤC**, xem `LeaderboardRow`. */
  current: LeaderboardRow[];
  meId: string | null;
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
   * Chiều cao thật của khung tranh, đo một lần khi bố cục xong.
   *
   * ⚠️ Cỡ chữ phải tính TỪ Ô, không đặt cứng. Bộ tranh cúp (v2) có sáu ô to nhỏ
   * khác nhau: ô của hạng 1 cao 17,4% còn hạng 4 chỉ 12,6% - một cỡ chữ dùng
   * chung thì ô nhỏ bị bóp. Bộ thẻ hiệu (v3) sáu ô bằng nhau, nhưng giữ cách
   * này để đổi tranh lần nữa không phải sửa.
   */
  const [podiumHeight, setPodiumHeight] = useState(0);

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
            paddingTop: Math.max(4, insets.top),
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
        <Animated.View
          style={[styles.podiumBox, stage]}
          onLayout={(e) => setPodiumHeight(e.nativeEvent.layout.height)}
        >
          <Image source={PODIUM} style={styles.podiumImg} resizeMode="stretch" />

          {SLOTS.map((slot, i) => {
            const row = globalRows[i];
            if (!row) return null;
            const isMe = row.PlayerId === meId;

            /*
             * Cỡ chữ tính TỪ Ô, không đặt cứng - xem ghi chú ở `podiumHeight`.
             * Sáu thẻ này bằng nhau nên sáu cỡ ra như nhau, nhưng đổi tranh là
             * khác ngay.
             */
            const nameH = (podiumHeight * parseFloat(slot.name.height)) / 100;
            const scoreH = (podiumHeight * parseFloat(slot.score.height)) / 100;
            const nameSize = Math.max(10, nameH * 0.58);
            const scoreSize = Math.max(11, scoreH * 0.74);

            return (
              /*
               * ⚠️ `Fragment`, KHÔNG phải `View`. Bọc trong một `View` không kích
               * thước thì hai vùng con tính phần trăm theo CÁI BỌC RỖNG đó chứ
               * không phải khung tranh - chữ biến mất sạch, tranh vẫn lên bình
               * thường nên nhìn như "chưa có dữ liệu". Đã dính 2026-09-10.
               */
              <Fragment key={i}>
                {/* Ô tối: TÊN. Số hạng đã in sẵn trong tranh, không vẽ. */}
                <View style={[styles.zone, slot.name]}>
                  <Text
                    style={[
                      styles.nameText,
                      { fontSize: nameSize, lineHeight: nameSize },
                      isMe && styles.slotMine,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {row.PlayerName}
                  </Text>
                </View>

                {/*
                  Dải màu: ĐIỂM. Dải đã rực màu nên chữ trắng + bóng tối để đọc
                  được trên cả vàng lẫn tím - chữ màu thẻ thì chìm vào dải.
                */}
                <View style={[styles.zone, slot.score]}>
                  <Text
                    style={[styles.scoreText, { fontSize: scoreSize, lineHeight: scoreSize }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {row.Score.toLocaleString()}
                  </Text>
                </View>
              </Fragment>
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
  titleImg: { width: '86%', height: 56 },
  titleText: {
    position: 'absolute',
    width: '46%',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#FDE68A',
  },

  /* `flex-start`: cúp bám lên trên, chỗ trống dồn xuống dưới bảng kết quả. */
  podiumArea: { flex: 1, marginTop: -6, alignItems: 'center', justifyContent: 'flex-start' },
  /* Đúng tỉ lệ ảnh -> phần trăm của khung KHỚP phần trăm của tranh. */
  /* Chừa khoảng thở giữa cúp và dải KẾT QUẢ VÁN NÀY - 100% thì hai thứ dính nhau. */
  podiumBox: { height: '86%', aspectRatio: PODIUM_RATIO, maxWidth: '100%' },
  podiumImg: { width: '100%', height: '100%' },
  zone: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  /*
   * ⚠️ `includeFontPadding: false`: Android tự thêm đệm trên/dưới NGOÀI
   * `lineHeight`. Đệm đó làm chữ không vừa ô, `adjustsFontSizeToFit` bèn co lại
   * - điểm teo còn một nửa dù cỡ chữ tính ra đã đúng ô.
   */
  nameText: { fontWeight: '800', color: '#fff', textAlign: 'center', includeFontPadding: false },
  scoreText: {
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
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
  /*
   * ⚠️ Thể thức này trần 4 người (`PlayerCountRule.CapFor`: `Time == 0` -> 4),
   * nên bình thường một hàng là đủ. `wrap` + `minWidth` để nếu luật có đổi thì
   * hàng thứ năm xuống dòng chứ không bóp nhau đến mức không đọc được.
   */
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  card: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: '22%',
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

});
