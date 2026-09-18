import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../i18n/I18nProvider';
import { text } from '../theme/colors';

/**
 * "No Games Found." (K106): máy chưa mua game nào mà bấm SET UP A MATCH hoặc My Games.
 * Chép ảnh mẫu của Tony: tiêu đề, một đoạn với "Explore Games" in đậm, nút EXPLORE GAMES
 * viền xanh. Chạm ngoài để đóng.
 */
export function NoGamesDialog({ visible, onExplore, onClose }: { visible: boolean; onExplore: () => void; onClose: () => void }) {
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button">
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{t('games.noneTitle')}</Text>
          <Text style={styles.body}>
            {t('games.noneBody1')}
            <Text style={styles.bold}>{t('games.noneBodyStrong')}</Text>
            {t('games.noneBody2')}
          </Text>
          <Pressable onPress={onExplore} accessibilityRole="button" style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
            <Text style={styles.btnText}>{t('games.explore')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,3,14,0.78)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 16,
    backgroundColor: '#121233',
    borderWidth: 1,
    borderColor: 'rgba(148,163,255,0.35)',
    paddingHorizontal: 24,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 14,
  },
  title: { fontSize: 20, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  body: { fontSize: 17, lineHeight: 25, color: text.primary, textAlign: 'center' },
  bold: { fontWeight: '800', color: '#FFFFFF' },
  btn: {
    marginTop: 4,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#3B6CE6',
    backgroundColor: '#0E1030',
  },
  pressed: { opacity: 0.75 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.6 },
});
