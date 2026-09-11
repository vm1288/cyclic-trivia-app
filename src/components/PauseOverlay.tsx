import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../i18n/I18nProvider';
import { boardColors, fill } from './GameBoardParts';
import { text } from '../theme/colors';

/**
 * "Game paused" - hiện ĐÈ LÊN VÙNG BÀN CỜ khi ván đã dừng thật (gói 80).
 *
 * Bản web (`playerHandlers.js`, `handlePauseGame`) xoá hết component đang hiện
 * rồi đặt một `PlayerBoardMessage` vào `topArea` với một trong hai câu: chủ
 * phòng được nhắc "bấm nút xanh phía trên", người khác được bảo "chờ chủ
 * phòng". Hai câu chép nguyên văn trong `translations.ts`.
 *
 * ⚠️ Chỉ phủ CỘT BÀN CỜ, không phủ cả màn hình: nút TIẾP TỤC của chủ phòng nằm
 * ở cột phải, đúng như bản web để nút Resume ở thanh trên còn câu nhắc ở dưới.
 * Phủ hết là chủ phòng không còn chỗ bấm.
 *
 * Chặn chạm xuống bàn cờ - trong lúc dừng không có nước đi nào hợp lệ.
 */
export function PauseOverlay({ isHost }: { isHost: boolean }) {
  const t = useT();

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <LinearGradient
          colors={['rgba(8,30,20,0.97)', 'rgba(10,12,34,0.97)']}
          style={[fill, styles.cardFill]}
        />

        {/* Hai gạch đứng - cùng ký hiệu với nút tạm dừng ở cột phải. */}
        <View style={styles.glyph}>
          <View style={styles.bar} />
          <View style={styles.bar} />
        </View>

        <Text style={styles.title}>{t('game.pausedTitle')}</Text>
        <Text style={styles.body}>{isHost ? t('game.pausedHost') : t('game.pausedGuest')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    /* Trên mọi khung khác của cột bàn cờ (câu hỏi 20, thông báo 15). */
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,6,20,0.55)',
  },

  card: {
    maxWidth: '86%',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1.6,
    borderColor: boardColors.green,
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    boxShadow: '0 0 18px rgba(46,232,95,0.55), 0 0 34px rgba(46,232,95,0.2)',
  },
  cardFill: { borderRadius: 16 },

  glyph: { flexDirection: 'row', gap: 5, marginBottom: 2 },
  bar: { width: 6, height: 22, borderRadius: 3, backgroundColor: boardColors.green },

  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: 1,
    color: boardColors.green,
    textAlign: 'center',
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: text.primary,
    textAlign: 'center',
  },
});
