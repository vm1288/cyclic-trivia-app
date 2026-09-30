import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Halftone } from './Halftone';

import { MODAL_ORIENTATIONS } from '../utils/modalOrientations';
/**
 * Menu ba chấm của màn ván chơi (K74, Tony chốt 2026-09-14).
 *
 * Mở từ nút ba chấm ở cột phải, nằm sát cột đó như một popover chứ không chiếm
 * giữa màn. Hiện chỉ có MỘT mục - "End game" - và CHỈ chủ phòng thấy nút ba chấm
 * (khách muốn đi thì JOIN ván khác bằng mã, không có "Leave game"). Mục nào cũng
 * chỉ đóng menu rồi giao việc cho màn ván (`onEndGame`), nơi hỏi xác nhận bằng
 * `useConfirm` - hai lớp là cố ý: nút ba chấm nằm cạnh chat/pause, dễ chạm nhầm.
 *
 * Kiểu dáng chép từ `ConfirmDialog` (viền gradient, nền tối, chấm halftone) để
 * hai tấm nối nhau không đổi giọng.
 */
export function GameMenuSheet({
  visible,
  onClose,
  onEndGame,
  labels,
}: {
  visible: boolean;
  onClose: () => void;
  onEndGame: () => void;
  labels: { endGame: string; cancel: string };
}) {
  return (
    <Modal supportedOrientations={MODAL_ORIENTATIONS} visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} accessibilityRole="button" />

        <LinearGradient
          colors={['#3AA5FF', '#7B5CFF', '#E05CFF']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.rim}
        >
          <View style={styles.card}>
            <LinearGradient
              colors={['rgba(24,16,56,0.97)', 'rgba(11,7,36,0.98)', 'rgba(7,5,26,1)']}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fill}
            />
            <Halftone color="#7B5CFF" style={styles.dots} opacity={0.14} />

            <Pressable
              onPress={onEndGame}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.stopGlyph} />
              <Text style={[styles.rowLabel, styles.danger]}>{labels.endGame}</Text>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Text style={styles.rowLabel}>{labels.cancel}</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /*
   * Neo về góc phải, NGAY DƯỚI hàng nút (Room · bàn cờ · pause · ba chấm ở ~y 110dp)
   * như một popover rơi ra từ nút - không che hàng nút, không đè thanh trạng thái
   * (bản đầu paddingTop 14 chồng lên cả hai, đo 09-14).
   */
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,3,14,0.55)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 138,
    paddingRight: 40,
  },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  rim: {
    width: 220,
    padding: 2,
    borderRadius: 18,
    boxShadow: '0 0 18px rgba(106,92,255,0.45)',
  },
  card: { borderRadius: 16, paddingVertical: 6, overflow: 'hidden' },
  dots: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 90 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    height: 48,
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  rowLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.6, color: '#E6ECFF' },
  danger: { color: '#FF5C6A' },
  /* Ô vuông đỏ = "stop", cùng ngôn ngữ với hai gạch của nút Pause. */
  stopGlyph: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#FF3B4E',
    boxShadow: '0 0 8px rgba(255,59,78,0.7)',
  },
  divider: { height: 1, marginHorizontal: 14, backgroundColor: 'rgba(190,205,255,0.16)' },
});
