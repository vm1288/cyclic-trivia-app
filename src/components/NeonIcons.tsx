import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Icon của các nút màn hình chính, vẽ tay bằng SVG thay vì lấy từ bộ icon có
 * sẵn (Ionicons...).
 *
 * Lý do: mockup dùng nét mảnh đều 1.8px và các hình dạng cụ thể (ổ khoá có lỗ
 * khoá, mũi tên trong vòng tròn, sách MỞ chứ không phải sách đóng). Bộ icon
 * dựng sẵn không có đúng các biến thể đó, và phần lớn là icon đặc - đặt cạnh
 * viền neon mảnh sẽ nặng nề, lệch hệ.
 *
 * Tất cả nhận `color` để tô cùng màu neon của nút chứa nó.
 */

type IconProps = { color: string; size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const LockIcon = ({ color, size = 26 }: IconProps) => (
  <Svg {...base(size)} stroke={color}>
    <Rect x={4} y={10} width={16} height={11} rx={2.5} />
    <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
    <Circle cx={12} cy={15} r={1.6} />
    <Path d="M12 16.6V18" />
  </Svg>
);

export const JoinIcon = ({ color, size = 26 }: IconProps) => (
  <Svg {...base(size)} stroke={color}>
    <Circle cx={12} cy={12} r={8.5} />
    <Path d="M8.5 12h7M12.5 8.8 15.8 12l-3.3 3.2" />
  </Svg>
);

export const CartIcon = ({ color, size = 26 }: IconProps) => (
  <Svg {...base(size)} stroke={color}>
    <Path d="M2.5 4h2.6l2.4 10h9.6l2.1-7.2H6.4" />
    <Circle cx={9} cy={18.2} r={1.6} />
    <Circle cx={16} cy={18.2} r={1.6} />
  </Svg>
);

export const BookIcon = ({ color, size = 26 }: IconProps) => (
  <Svg {...base(size)} stroke={color}>
    <Path d="M12 6.6C10.4 5.3 8.3 4.8 4.5 4.9v12.6c3.8-.1 5.9.4 7.5 1.7 1.6-1.3 3.7-1.8 7.5-1.7V4.9c-3.8-.1-5.9.4-7.5 1.7Z" />
    <Path d="M12 6.6v12.6" />
  </Svg>
);

/** Nút NEW GAME - thay chỗ REGISTER GAME khi máy đã kích hoạt license. */
export const NewGameIcon = ({ color, size = 26 }: IconProps) => (
  <Svg {...base(size)} stroke={color}>
    <Circle cx={12} cy={12} r={8.5} />
    <Path d="M12 8.2v7.6M8.2 12h7.6" />
  </Svg>
);

/**
 * Mũi tên quay lại.
 *
 * Vẽ bằng SVG chứ KHÔNG dùng ký tự "←": glyph mũi tên có metric riêng theo
 * từng font, nằm lệch khỏi tâm ô chữ, nên đặt trong vòng tròn thì luôn trông
 * lệch dù đã căn giữa. SVG thì tâm hình đúng là tâm viewBox.
 */
export const ArrowLeftIcon = ({ color, size = 18 }: IconProps) => (
  <Svg {...base(size)} stroke={color} strokeWidth={2.2}>
    {/*
      Đỉnh ở x=9, hai cánh tới x=16 -> tâm khối hình đúng bằng 12.5, hơi lệch
      phải tâm viewBox một chút. Cố ý: chevron mở về bên phải nên mắt luôn đọc
      nó lệch trái; đặt đúng tâm hình học thì trông vẫn lệch.
    */}
    <Path d="M16 5 9 12l7 7" />
  </Svg>
);

/** Mốc thời lượng tính theo phút. */
export const ClockIcon = ({ color, size = 26 }: IconProps) => (
  <Svg {...base(size)} stroke={color}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7v5.2l3.4 2" />
  </Svg>
);

/** Thể thức Leaderboard Challenge - tính theo lượt tung xúc xắc, không theo phút. */
export const TrophyIcon = ({ color, size = 26 }: IconProps) => (
  <Svg {...base(size)} stroke={color}>
    <Path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
    <Path d="M8 5.5H5.6v1.6A3 3 0 0 0 8.6 10M16 5.5h2.4v1.6A3 3 0 0 1 15.4 10" />
    <Path d="M12 13v3.6M8.6 20h6.8M9.8 20l.6-3.4h3.2l.6 3.4" />
  </Svg>
);

/** Gỡ license khỏi máy. */
export const TrashIcon = ({ color, size = 20 }: IconProps) => (
  <Svg {...base(size)} stroke={color}>
    <Path d="M4 6.5h16M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
    <Path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" />
    <Path d="M10.4 10v6.5M13.6 10v6.5" />
  </Svg>
);

export type NeonIcon = (props: IconProps) => React.ReactElement;
