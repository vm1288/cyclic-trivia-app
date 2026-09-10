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
 * ⚠️ **`podium.png` cố định SÁU chỗ theo thế 3 cao + 3 thấp.** Đó là lý do bố
 * cục là bục giữa màn chứ không phải hai cột: chia đôi màn là chống lại chính
 * bức tranh. Bảng chung của server cũng đúng **top 6** (`Take(6)`), khớp sẵn.
 */

/**
 * Sáu chỗ trên `podium.png`, tính theo PHẦN TRĂM khung ảnh.
 *
 * Bộ tranh thứ hai (2026-09-10 tối) là **sáu chiếc cúp**, mỗi cúp có hai ô để
 * trống: **huy chương tròn** ở trên và **biển tên** ở dưới. Nên mỗi hạng cần
 * HAI vùng chứ không phải một.
 *
 * ⚠️ Sáu cúp KHÔNG xếp theo hạng từ trái sang phải. Thứ tự trong tranh là
 * **4 – 2 – 1 – 3 – 5 – 6**, nhận ra bằng chiều cao (cúp cao hơn = hạng cao
 * hơn). Mảng này xếp theo HẠNG, phần trăm bên trong đã trỏ đúng cột.
 *
 * ⚠️ Mỗi ô là **hộp canh theo TÂM của vùng**, không phải theo mép.
 * `scripts/dev-podium-zones.py` gom các hàng tối liền nhau trong mỗi cột thành
 * hai miền (vòng tròn, biển tên), lấy tâm rồi dựng hộp quanh tâm đó. Phải làm
 * vậy vì **tên người chơi dài ngắn khác nhau**: canh theo mép thì tên ngắn nằm
 * lệch, tên dài tràn ra. Bản trước đo theo mép và Tony nhìn ra ngay.
 *
 * ⚠️ Đổi tranh thì chạy lại công cụ đó, đừng ướm mắt. Nó tự tìm sáu cột và tự
 * sắp hạng theo chiều cao cúp.
 *
 * ⚠️ Hạng 4 và 5 trong tranh này **cao gần bằng nhau** (lệch 0,6%), nên thứ tự
 * giữa chúng là quy ước chứ không phải đo được: giữ thế sóng 4-2-1-3-5-6 đọc từ
 * trái sang phải, tức cúp tím = 4, cúp xanh lá = 5.
 */
const SLOTS = [
  { medal: { left: '40.18%', top: '20.66%', width: '8.85%', height: '19.05%' },
    plate: { left: '39.30%', top: '54.90%', width: '10.55%', height: '7.83%' } },
  { medal: { left: '22.08%', top: '34.93%', width: '7.96%', height: '17.07%' },
    plate: { left: '21.11%', top: '65.43%', width: '9.71%', height: '6.49%' } },
  { medal: { left: '57.45%', top: '36.52%', width: '7.49%', height: '16.79%' },
    plate: { left: '56.61%', top: '65.66%', width: '9.09%', height: '7.06%' } },
  { medal: { left: '5.95%', top: '45.78%', width: '6.86%', height: '13.83%' },
    plate: { left: '4.73%', top: '72.01%', width: '8.81%', height: '5.15%' } },
  { medal: { left: '72.80%', top: '43.75%', width: '6.97%', height: '16.65%' },
    plate: { left: '72.05%', top: '70.85%', width: '8.58%', height: '7.06%' } },
  { medal: { left: '88.14%', top: '51.73%', width: '6.44%', height: '14.39%' },
    plate: { left: '87.36%', top: '75.98%', width: '8.14%', height: '5.73%' } },
] as const;

/**
 * Tỉ lệ thật của `podium.png` (1604×482).
 *
 * ⚠️ Khung bọc PHẢI đúng tỉ lệ này. Bản đầu để khung `flex: 1` rồi vẽ ảnh bằng
 * `contain`: ảnh co lại nằm giữa khung, còn sáu ô chữ vẫn tính theo phần trăm
 * của KHUNG - thành ra tên và điểm trôi hẳn ra ngoài mặt bục. Nhìn ảnh chụp là
 * thấy ngay, nhưng đọc mã thì không.
 */
const PODIUM_RATIO = 1604 / 482;

/** Màu điểm của từng bục, lấy theo đúng màu neon trong tranh. */
const SLOT_COLOR = ['#FFC93C', '#7FB6FF', '#FF8A50', '#C07BFF', '#4FE38A', '#FF5C6A'];

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
   * ⚠️ Cỡ chữ phải tính TỪ Ô, không đặt cứng. Sáu cúp to nhỏ khác nhau: ô của
   * hạng 1 cao 17,4% còn hạng 4 chỉ 12,6% - một cỡ chữ dùng chung thì ô nhỏ bị
   * bóp, số hạng teo lại còn tên thì đè lên nó. Đã thấy tận mắt.
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
            const color = SLOT_COLOR[i];

            /* Chiều cao ô = phần trăm của khung tranh -> cỡ chữ theo tỉ lệ ô. */
            const medalH = (podiumHeight * parseFloat(slot.medal.height)) / 100;
            const plateH = (podiumHeight * parseFloat(slot.plate.height)) / 100;
            const rankSize = Math.max(10, medalH * 0.42);
            const nameSize = Math.max(9, medalH * 0.26);
            /*
             * ⚠️ `lineHeight` KHÔNG được vượt chiều cao biển: vượt là
             * `adjustsFontSizeToFit` co chữ lại cho vừa, và điểm teo đi một
             * nửa dù cỡ chữ tính ra đã đúng. Nên để đúng bằng cỡ chữ.
             */
            const scoreSize = Math.max(11, plateH * 0.82);

            return (
              /*
               * ⚠️ `Fragment`, KHÔNG phải `View`. Bọc trong một `View` không kích
               * thước thì hai vùng con tính phần trăm theo CÁI BỌC RỖNG đó chứ
               * không phải khung tranh - chữ biến mất sạch, tranh vẫn lên bình
               * thường nên nhìn như "chưa có dữ liệu". Đã dính 2026-09-10.
               */
              <Fragment key={i}>
                {/*
                  Vòng tròn giữ DANH TÍNH: số hạng ở trên, tên ngay dưới. Hai thứ
                  này đi liền nhau nên phải nằm chung một chỗ - tách ra hai đầu
                  cúp thì mắt phải nhảy qua lại mới ghép được ai đứng thứ mấy.
                */}
                <View style={[styles.zone, slot.medal]}>
                  <Text
                    style={[
                      styles.medalRank,
                      { color, fontSize: rankSize, lineHeight: rankSize * 1.1 },
                    ]}
                    numberOfLines={1}
                  >
                    {i + 1}
                  </Text>
                  {/* Tên dài ngắn tuỳ người nên vẫn cho co lại, nhưng co từ cỡ đã hợp ô. */}
                  <Text
                    style={[
                      styles.medalName,
                      { fontSize: nameSize, lineHeight: nameSize * 1.2 },
                      isMe && styles.slotMine,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {row.PlayerName}
                  </Text>
                </View>

                {/* Biển chữ nhật: ĐIỂM, số to nhất trên cúp. */}
                <View style={[styles.zone, slot.plate]}>
                  <Text
                    style={[
                      styles.plateScore,
                      { color, fontSize: scoreSize, lineHeight: scoreSize },
                    ]}
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
  medalRank: { fontWeight: '900', textAlign: 'center', includeFontPadding: false },
  medalName: { fontWeight: '800', color: '#fff', textAlign: 'center', includeFontPadding: false },
  plateScore: { fontWeight: '900', textAlign: 'center', includeFontPadding: false },
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
