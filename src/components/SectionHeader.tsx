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
export function SectionHeader({
  title,
  trailing,
}: {
  title: string;
  /**
   * Chữ nhỏ neo ở GÓC PHẢI của hàng tiêu đề, thay chỗ dấu ◇ cuối.
   *
   * Dùng cho những con số chỉ có nghĩa kèm tiêu đề - vd "1 of 6 joined" bên
   * cạnh PLAYERS ở màn phòng chờ. Đặt ở đây thì nó đọc như một phần của tiêu
   * đề, và không phải cấp cho nó một dòng riêng trong khi bề cao đang khan.
   */
  trailing?: string;
}) {
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
      {trailing ? (
        <Text style={styles.trailing}>{trailing}</Text>
      ) : (
        <Text style={[styles.diamond, styles.diamondTrailing]}>◇</Text>
      )}
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
  // Mờ hơn và nhẹ hơn tiêu đề: đây là số liệu đi kèm, không được tranh chỗ với
  // chính cái tiêu đề nó đứng cạnh.
  trailing: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: 'rgba(198,212,240,0.8)',
  },
});
