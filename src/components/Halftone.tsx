import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Mask,
  Pattern,
  Rect,
  Stop,
} from 'react-native-svg';

type Props = {
  color: string;
  /** Vùng phủ. Mặc định là dải 118px sát mép phải. */
  style?: StyleProp<ViewStyle>;
  opacity?: number;
};

/**
 * Lưới chấm halftone mờ dần từ phải sang trái - nhắc lại hai bức tường chấm
 * trong ảnh nền, để các khối trông thuộc về khung cảnh chứ không phải dán đè.
 *
 * Dùng <Pattern> thay vì vẽ từng chấm: một pattern lặp tốn ít node hơn ~90
 * <Circle> mỗi khối.
 *
 * Phần tắt dần đi qua <Mask> chứ KHÔNG phải phủ một lớp gradient màu nền lên
 * trên. Đã thử cách phủ và nó để lại một vệt nối dọc thấy rõ, vì hai lý do
 * cộng lại: RN nội suy màu sang `transparent` = rgba(0,0,0,0) nên quãng giữa
 * bị ngả đen, và nền các khối vốn là gradient dọc nên không có màu phẳng nào
 * phủ khớp được.
 */
export function Halftone({ color, style, opacity = 0.22 }: Props) {
  // id phải là DUY NHẤT theo màu: trên web, react-native-svg render ra <svg>
  // thật nên <Defs> nằm chung một namespace toàn trang - nhiều khối cùng id sẽ
  // đều lấy pattern của khối đầu tiên và ra sai màu.
  const key = color.replace('#', '');
  const dots = `dots-${key}`;
  const fade = `fade-${key}`;
  const mask = `mask-${key}`;

  return (
    <View style={[styles.default, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={dots} width={13} height={13} patternUnits="userSpaceOnUse">
            <Circle cx={6.5} cy={6.5} r={1.75} fill={color} />
          </Pattern>
          <SvgGradient id={fade} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#fff" stopOpacity="0" />
            <Stop offset="0.75" stopColor="#fff" stopOpacity="1" />
            <Stop offset="1" stopColor="#fff" stopOpacity="1" />
          </SvgGradient>
          <Mask id={mask}>
            <Rect width="100%" height="100%" fill={`url(#${fade})`} />
          </Mask>
        </Defs>
        <Rect
          width="100%"
          height="100%"
          fill={`url(#${dots})`}
          mask={`url(#${mask})`}
          opacity={opacity}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  default: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 118 },
});
