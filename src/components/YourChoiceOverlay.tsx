import { useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useT } from '../i18n/I18nProvider';
import { fill } from './GameBoardParts';
import { GlowDivider } from './GlowDivider';

/**
 * Ô **YOUR CHOICE** - người tới lượt tự chọn chủ đề câu hỏi.
 *
 * Bố cục và chữ chép NGUYÊN VĂN từ
 * `Views/Public/Scripts/QuestionCategory/QuestionCategoryPartialHtml.cshtml`
 * và logic từ `QuestionCategory.cshtml`:
 *
 *   - tiêu đề "What question category would you like?"
 *   - dòng phụ "No special card can be played"
 *   - lưới thẻ chủ đề, bấm một cái là **khoá** (`isLocked`) và gửi luôn
 *   - **ô cuối cùng do CHÍNH MÁY KHÁCH chèn thêm**: "Pot Luck (double points)"
 *     với `QuestionCategoryId` là GUID RỖNG (`categoriesWithManual` của bản web)
 *
 * ⚠️ GUID rỗng KHÔNG phải lỗi - `YourChoiceHandler` thấy `Guid.Empty` thì tự bốc
 * chủ đề ngẫu nhiên và bật cờ `potluck-` (ĐIỂM ×2). Đừng lọc nó đi.
 *
 * ⚠️ Bước này KHÔNG có đồng hồ, và cũng **không có watchdog ở server**
 * (`YourChoiceSquareResolver` không arm gì). Không gửi là ván treo vĩnh viễn -
 * nên khoá sau một lần bấm, đừng chặn bằng cách nào khác.
 */

/** GUID rỗng = Pot Luck. Cùng hằng số bản web nhét vào `categoriesWithManual`. */
const POT_LUCK_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Hai cách xếp lưới chủ đề. Vấn đề phải giải: bàn CricTriv có 15 chủ đề + ô Pot
 * Luck = 16 ô, mà màn NẰM NGANG chỉ còn ~330dp bề cao cho lưới.
 *
 *   'flow'  - ô CO THEO CHỮ rồi tự xuống dòng (kiểu masonry một chiều). "ODI"
 *             chiếm một mẩu, "English County Cricket" chiếm rộng hơn. Không ô
 *             nào bị cắt chữ, và xếp khít nên thường gọn hơn lưới đều.
 *   'grid'  - 4 cột đều nhau, ÉP MỖI Ô MỘT DÒNG, và ô Pot Luck GHIM ngoài vùng
 *             cuộn nên không bao giờ khuất.
 *
 * Đổi hằng số này để so hai kiểu.
 */
const LAYOUT: 'flow' | 'grid' = 'flow';

/** Chỉ dùng cho `grid`. */
const GRID_COLS = 4;
const COL_GAP_PCT = 1.4;

export type ChoiceCategory = {
  QuestionCategoryId: string;
  Title: string;
};

export function YourChoiceOverlay({
  categories,
  onPick,
}: {
  categories: ChoiceCategory[];
  onPick: (questionCategoryId: string) => void;
}) {
  const t = useT();

  const [picked, setPicked] = useState<string | null>(null);
  /** Bấm một lần rồi thôi - `isLocked` của bản web. */
  const locked = useRef(false);

  /* Ô Pot Luck do máy khách tự chèn, đúng như `categoriesWithManual`. */
  const cards: ChoiceCategory[] = [
    ...categories,
    { QuestionCategoryId: POT_LUCK_ID, Title: t('yourChoice.potLuck') },
  ];

  const isFlow = LAYOUT === 'flow';

  /*
   * Kiểu `grid`: ô Pot Luck TÁCH RA khỏi danh sách cuộn để ghim dưới đáy.
   * Kiểu `flow`: để nguyên trong dòng chảy, nó tự nằm cuối.
   */
  const gridCards = isFlow ? cards : categories;
  const cardWidth = `${100 / GRID_COLS - COL_GAP_PCT}%` as const;

  const potLuck: ChoiceCategory = {
    QuestionCategoryId: POT_LUCK_ID,
    Title: t('yourChoice.potLuck'),
  };

  const renderCard = (c: ChoiceCategory, pinned = false) => {
    const isPicked = picked === c.QuestionCategoryId;
    const dimmed = picked !== null && !isPicked;
    const isPotLuck = c.QuestionCategoryId === POT_LUCK_ID;

    return (
      <Pressable
        key={c.QuestionCategoryId}
        onPress={() => select(c.QuestionCategoryId)}
        style={({ pressed }) => [
          styles.card,
          isFlow ? styles.cardFlow : { width: cardWidth },
          pinned && styles.cardPinned,
          isPotLuck && styles.cardPotLuck,
          isPicked && styles.cardPicked,
          dimmed && styles.cardDimmed,
          pressed && !dimmed && styles.pressed,
        ]}
      >
        <Text
          style={[styles.cardTitle, isPicked && styles.cardTitlePicked]}
          /* `grid` ép một dòng để ô không cao lên; `flow` thì ô tự rộng ra. */
          numberOfLines={1}
        >
          {c.Title}
        </Text>
      </Pressable>
    );
  };

  const select = (id: string) => {
    if (locked.current) return;
    locked.current = true;
    setPicked(id);
    onPick(id);
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0D2A1C', '#06161A', '#03030C']}
        locations={[0, 0.55, 1]}
        style={fill}
      />

      <View style={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.bannerTag}>
            <Text style={styles.bannerText} numberOfLines={1}>
              {t('yourChoice.title').toUpperCase()}
            </Text>
          </View>
          <GlowDivider color="#22C55E" accent="#5FE6FF" height={1.5} flareWidth={70} style={styles.rule} />
        </View>

        <Text style={styles.noCard}>{t('yourChoice.noCard')}</Text>

        <ScrollView
          contentContainerStyle={[styles.grid, isFlow && styles.gridFlow]}
          showsVerticalScrollIndicator={false}
        >
          {gridCards.map((c) => renderCard(c))}
        </ScrollView>

        {/* Kiểu `grid`: ghim Pot Luck ngoài vùng cuộn - ô ×2 điểm không được khuất. */}
        {!isFlow ? renderCard(potLuck, true) : null}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Phủ kín vùng bàn cờ và chặn chạm xuống dưới - xem `QuestionOverlay`. */
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: 'rgba(34,197,94,0.4)',
    backgroundColor: '#04040E',
    overflow: 'hidden',
    boxShadow: '0 0 20px rgba(34,197,94,0.3)',
  },

  content: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 7 },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerTag: {
    height: 28,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    borderWidth: 1.3,
    borderColor: 'rgba(34,197,94,0.6)',
    backgroundColor: 'rgba(6,34,20,0.9)',
    boxShadow: '0 0 12px rgba(34,197,94,0.28)',
    maxWidth: '78%',
  },
  bannerText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: '#4ADE80' },
  rule: { flex: 1 },

  noCard: { fontSize: 12, color: 'rgba(226,232,255,0.7)', textAlign: 'center' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 2,
  },
  /* Xếp khít từ trái sang, đúng tinh thần masonry một chiều. */
  gridFlow: { justifyContent: 'flex-start' },
  card: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1.3,
    borderColor: 'rgba(95,230,255,0.45)',
    backgroundColor: 'rgba(8,26,34,0.9)',
  },
  /* `flow`: không đặt bề rộng - ô tự co theo chữ. */
  cardFlow: { flexGrow: 0, flexShrink: 0, paddingHorizontal: 12 },
  /* Ô ghim dưới đáy, trải hết bề ngang cho dễ thấy. */
  cardPinned: { width: '100%', marginTop: 2 },
  cardPotLuck: {
    borderColor: 'rgba(255,198,30,0.7)',
    backgroundColor: 'rgba(56,36,4,0.9)',
  },
  cardPicked: {
    borderColor: '#FFC61E',
    borderWidth: 2,
    backgroundColor: 'rgba(84,60,4,0.75)',
  },
  cardDimmed: { opacity: 0.35 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#E2E8FF', textAlign: 'center' },
  cardTitlePicked: { color: '#FFC61E' },

  pressed: { opacity: 0.85 },
});
