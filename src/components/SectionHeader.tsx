import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { section } from '../theme/colors';

/**
 * Tiêu đề nhóm kiểu `◇ GAME LENGTH ─────── ◇`.
 *
 * Dấu ◇ và đường kẻ mờ dần là chi tiết của bản thiết kế - chúng chia màn hình
 * thành từng khối rõ ràng mà không cần thêm khung viền, vốn sẽ đụng với viền
 * neon của các ô bên dưới.
 */
export function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.diamond}>◇</Text>
      <Text style={styles.title}>{title}</Text>
      <LinearGradient
        colors={[...section.rule]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.rule}
      />
      <Text style={[styles.diamond, styles.diamondTrailing]}>◇</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 10 },
  diamond: { color: section.diamond, fontSize: 9 },
  diamondTrailing: { color: 'rgba(150,190,235,0.6)', fontSize: 8 },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2.2,
    color: section.title,
    textShadowColor: 'rgba(63,224,255,0.6)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  rule: { flex: 1, height: 1 },
});
