import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CARD_ORDER, CARD_STYLES, type CardKey } from './GameBoardParts';
import { NeonSheet, SheetButton } from './NeonSheet';
import { useT } from '../i18n/I18nProvider';
import { text } from '../theme/colors';

/**
 * TẤM "HELP CARDS" (K140, Tony gửi mockup 24/9 - `Mockup_-_Help_Card_info_V2.pptx`).
 *
 * Yêu cầu trong mockup: *"a small info icon next to the help cards section that triggers a popup
 * explaining their function when tapped"*. Tấm là một BĂNG CHUYỀN: mỗi lần một lá, hai mũi tên
 * trái/phải để lật, dưới lá là "Max limit: N" và câu mô tả, cuối tấm là nút Close.
 *
 * ⚠️ Lá vẽ bằng ICON + MÀU CÓ SẴN của app (`CARD_STYLES`), không dùng ảnh trong mockup: ảnh đó là
 * bản màu pastel của người thiết kế, lệch hẳn với tông neon tối của app. Muốn đổi sang ảnh thật thì
 * thay chỗ `<Icon>` dưới đây - bố cục giữ nguyên.
 */
export function HelpCardsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const [index, setIndex] = useState(0);

  /* Mở lại thì về lá đầu - người dùng không phải nhớ lần trước đang xem lá nào. */
  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const key: CardKey = CARD_ORDER[index] ?? CARD_ORDER[0];
  const style = CARD_STYLES[key];
  const Icon = style.Icon;
  const step = (d: number) => setIndex((i) => (i + d + CARD_ORDER.length) % CARD_ORDER.length);

  return (
    <NeonSheet visible={visible} onClose={onClose} maxWidth={520} style={styles.sheet}>
      <Text style={styles.title}>{t('helpCards.title')}</Text>

      {/* Lá bài + hai mũi tên lật, đúng bố cục mockup (chevron trái | lá | chevron phải). */}
      <View style={styles.row}>
        <Arrow dir="left" onPress={() => step(-1)} label={t('helpCards.prev')} />

        <View style={[styles.card, { borderColor: style.accent, boxShadow: `0 0 26px ${style.glow}` }]}>
          <LinearGradient colors={[style.tint, '#05030F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Icon size={40} />
          <Text style={[styles.cardName, { color: style.accent }]}>
            {t(`game.card.${key}` as 'game.card.Joker').toUpperCase()}
          </Text>
        </View>

        <Arrow dir="right" onPress={() => step(1)} label={t('helpCards.next')} />
      </View>

      {/* Chấm chỉ vị trí - mockup không có, nhưng băng chuyền không có mốc thì không biết còn mấy lá. */}
      <View style={styles.dots}>
        {CARD_ORDER.map((k, i) => (
          <View key={k} style={[styles.dot, i === index && { backgroundColor: style.accent }]} />
        ))}
      </View>

      <Text style={styles.max}>{t('helpCards.max', { n: String(style.max) })}</Text>
      <Text style={styles.body}>{t(`helpCards.body.${key}` as 'helpCards.body.Joker')}</Text>

      <SheetButton label={t('helpCards.close')} onPress={onClose} style={styles.close} />
    </NeonSheet>
  );
}

/** Mũi tên lật lá. Vùng chạm 44dp - ngón tay ở chiều ngang không trúng được hình 14dp. */
function Arrow({ dir, onPress, label }: { dir: 'left' | 'right'; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={10} style={styles.arrow}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={text.primary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
      </Svg>
    </Pressable>
  );
}

/**
 * ⓘ nhỏ đặt cạnh khối thẻ bài ở cột phải bàn cờ - chính là thứ mockup yêu cầu.
 * Để riêng ở đây cho gần tấm nó mở, khỏi phải đi tìm.
 */
export function HelpCardsInfoButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={12} style={styles.info}>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#5FA8FF" strokeWidth={2} strokeLinecap="round">
        <Path d="M12 3a9 9 0 100 18 9 9 0 000-18z" />
        <Path d="M12 11v5.5" />
        <Path d="M12 7.6v.2" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /*
   * ⚠️ CHIỀU CAO LÀ THỨ QUYẾT ĐỊNH Ở ĐÂY. Máy nằm ngang chỉ cao ~393dp, `NeonSheet` không cắt bớt
   * mà cứ nở ra - bản đầu (lá 104×150, gap 8) làm nút Close **rơi khỏi màn hình**, đã dính thật.
   * Tổng chiều cao phải ≤ ~300dp: tiêu đề 20 + lá 112 + chấm 6 + hai dòng chữ ~50 + nút 46 + gap.
   * Đổi bất kỳ số nào dưới đây thì đo lại trên máy thật, đừng tin mắt.
   */
  sheet: { alignItems: 'center', gap: 5 },
  title: { color: text.primary, fontSize: 15, fontWeight: '900', letterSpacing: 2 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  card: {
    width: 84,
    height: 112,
    borderRadius: 12,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  cardName: { fontSize: 11.5, fontWeight: '900', letterSpacing: 1.2 },

  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(198,212,240,0.28)' },

  max: { color: '#FFC61E', fontSize: 12.5, fontWeight: '800' },
  body: { color: text.muted, fontSize: 12.5, lineHeight: 17, textAlign: 'center', paddingHorizontal: 6 },

  close: { marginTop: 2, alignSelf: 'stretch' },

  /*
   * Nút ⓘ đè lên góc trên PHẢI khối thẻ bài (mockup đặt nó cạnh tên các lá). Tuyệt đối để không
   * chiếm dòng - lưới 2×2 vốn đã vừa khít cột phải.
   */
  info: {
    position: 'absolute',
    top: -14,
    right: 0,
    zIndex: 3,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
