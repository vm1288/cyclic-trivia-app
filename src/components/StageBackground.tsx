import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';

import { bg } from '../theme/colors';

/**
 * Nền sân khấu của màn hình chính.
 *
 * Trước đây dựng bằng SVG (starfield + chùm sáng + bệ oval sinh theo code) để
 * thích ứng mọi tỉ lệ màn hình. Đã thay bằng ảnh thiết kế thật - tường chấm
 * halftone, tia sáng và bệ phát sáng trong ảnh phong phú hơn nhiều so với mức
 * dựng lại được bằng code.
 *
 * Ảnh tỉ lệ 852x1846 (~9:19.5), đúng tỉ lệ điện thoại dọc hiện đại, nên
 * `cover` gần như không cắt gì trên máy mục tiêu. Trên máy tỉ lệ khác thì cắt
 * đều hai đầu; giữ `backgroundColor` cùng tông ở dưới để mép cắt không lộ.
 */
const STAGE = require('../../assets/brand/main-background.png');

export function StageBackground() {
  return (
    <View style={styles.root} pointerEvents="none">
      <Image source={STAGE} resizeMode="cover" style={styles.image} />

      {/* Làm tối phần đỉnh để logo và thanh trạng thái luôn đủ tương phản, kể
          cả khi ảnh bị cắt lệch trên máy tỉ lệ lạ. */}
      <LinearGradient
        colors={[bg.deep, 'rgba(3,3,15,0.55)', 'transparent']}
        locations={[0, 0.5, 1]}
        style={styles.topFade}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Viết thẳng bốn cạnh thay vì dùng `StyleSheet.absoluteFill*`: RN 0.86 bỏ
  // khai báo kiểu của `absoluteFillObject`, và - quan trọng hơn - truyền thẳng
  // `StyleSheet.absoluteFill` vào <Image> KHÔNG có tác dụng: ảnh rơi về kích
  // thước pixel nội tại (đo được 852x1846 thay vì kích thước màn hình) rồi bị
  // `cover` phóng to lên gấp đôi, cắt mất bệ oval ở đáy.
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: bg.deep },
  image: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: '16%' },
});
