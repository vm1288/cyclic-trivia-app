import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Vạch ngăn phát sáng: một sợi mảnh tắt dần về hai đầu, chói nhất ở giữa, có
 * quầng loang rất mờ phía sau.
 *
 * Dùng để tách các NHÓM nút trên màn hình chính. Vạch phẳng một màu bị nuốt mất
 * giữa nền sân khấu và các viền neon xung quanh; vạch này tự sáng nên đọc được
 * mà không cần thêm khung hay tiêu đề.
 *
 *   <GlowDivider />
 *   <GlowDivider color="#4B2FD6" accent="#D9C2FF" hazeRgb="120,80,255" height={2} />
 */

type Props = {
  /** Màu của sợi chính */
  color?: string;
  /** Màu điểm sáng ở giữa */
  accent?: string;
  /** Độ dày sợi */
  height?: number;
  /** Bề ngang của vệt sáng giữa */
  flareWidth?: number;
  /**
   * "r,g,b" của quầng loang phía sau.
   *
   * Tách riêng khỏi `color` vì quầng cần rgba (có alpha) trong khi sợi chính
   * dùng màu đặc. Đổi `color` mà quên đổi cái này thì quầng vẫn xanh - đó là lý
   * do nó là tham số chứ không phải hằng số chôn trong component.
   */
  hazeRgb?: string;
  style?: StyleProp<ViewStyle>;
};

export function GlowDivider({
  color = '#1F6FD6',
  accent = '#C2E6FF',
  height = 1.5,
  flareWidth = 130,
  hazeRgb = '80,160,255',
  style,
}: Props) {
  return (
    <View style={[styles.root, style]} pointerEvents="none">
      {/* Quầng loang rất mờ, nằm sau tất cả */}
      <LinearGradient
        colors={[
          'transparent',
          `rgba(${hazeRgb},0.22)`,
          `rgba(${hazeRgb},0.38)`,
          `rgba(${hazeRgb},0.22)`,
          'transparent',
        ]}
        locations={[0, 0.3, 0.5, 0.7, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.haze, { height: height * 12 }]}
      />

      {/* Sợi chính, tắt dần về hai đầu */}
      <LinearGradient
        colors={['transparent', color, accent, color, 'transparent']}
        locations={[0, 0.18, 0.5, 0.82, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ height, borderRadius: height }}
      />

      {/* Vệt sáng ở giữa */}
      <View style={[styles.flareWrap, { width: flareWidth }]}>
        <LinearGradient
          colors={['transparent', accent, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: '100%', height: height * 2, borderRadius: height }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', justifyContent: 'center' },
  haze: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignSelf: 'center',
    opacity: 0.55,
  },
  flareWrap: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
