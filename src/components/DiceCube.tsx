import Svg, { Circle, Polygon, Rect } from 'react-native-svg';

/**
 * Viên xúc xắc: khối lập phương vẽ bằng SVG, chiếu isometric - ba mặt nhìn thấy
 * (trên, trái, phải).
 *
 * Chép hình học từ `designs/RollDiceButton.tsx` (bản cập nhật 2026-08-28, phần
 * `CubeSVG`), giữ nguyên tỉ lệ, màu ba mặt và cách đặt chấm.
 *
 * ### Vì sao SVG chứ không phải transform 3D
 *
 * Bản thiết kế gốc `Roll Dice Button.dc.html` dựng khối bằng
 * `transform-style: preserve-3d` với sáu mặt `translateZ(nửa cạnh)`. React
 * Native **không có `preserve-3d` và không nhận `translateZ`**: mỗi View bị
 * chiếu phẳng riêng nên sáu mặt chỉ chồng lên nhau. Tự chiếu hình rồi tô polygon
 * là cách duy nhất ra được khối thật mà không phải kéo `expo-gl` + `three` về
 * (native module → bắt buộc build lại APK).
 *
 * ⚠️ Chấm vẽ trên **CẢ BA** mặt, không chỉ mặt trên. Bản thiết kế chỉ vẽ mặt
 * trên vì nó đứng yên; ở đây khối XOAY, mà hai mặt bên trống trơn thì lúc quay
 * lộ ngay ra là mấy tấm phẳng ghép lại - nhìn rất kỳ. Đã dính đúng vậy.
 *
 * ⚠️ Toạ độ chấm đi qua phép ánh xạ vào hình bình hành của TỪNG mặt (`onFace`)
 * chứ không đặt thẳng trên màn hình - đặt thẳng thì chấm không nghiêng theo mặt,
 * nhìn như dán sticker.
 */

/** Chấm trên mặt, lưới 3×3 - chép `PIP_PATTERNS` của bản thiết kế. */
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

/**
 * Ba mặt ba sắc: trên sáng nhất, phải tối nhất.
 *
 * Chính chênh lệch sáng-tối này làm hình phẳng đọc ra khối - đừng tô cả ba cùng
 * một màu.
 */
const C = {
  top: '#AD84FF',
  left: '#6A35D9',
  right: '#4A2A94',
  edge: 'rgba(0,0,0,0.28)',
};

/**
 * Mặt nào đi cùng mặt nào.
 *
 * Xúc xắc thật có hai mặt đối nhau cộng lại bằng 7, nên biết mặt TRÊN là biết
 * mặt dưới - còn hai mặt bên thì tuỳ hướng đặt. Bảng này lấy một cách đặt hợp lệ
 * và giữ nguyên cho mọi giá trị, để lúc lăn vẫn luôn là CÙNG một viên xúc xắc
 * chứ không phải mỗi khung hình một kiểu chấm.
 */
const SIDES: Record<number, { left: number; right: number }> = {
  1: { left: 2, right: 3 },
  2: { left: 6, right: 3 },
  3: { left: 2, right: 6 },
  4: { left: 2, right: 1 },
  5: { left: 1, right: 3 },
  6: { left: 5, right: 3 },
};

/**
 * MẶT xúc xắc nhìn TRỰC DIỆN - dùng lúc đã dừng.
 *
 * ⚠️ Vì sao cần cái này bên cạnh `DiceCube`: mặt trên của khối isometric là một
 * HÌNH THOI, nên lưới chấm 3×3 bị xô nghiêng theo. Mặt 6 (hai cột ba chấm) chiếu
 * lên hình thoi thành **hai đường chéo** - đúng về hình học nhưng người chơi
 * không đọc ra là số 6. Đã dính đúng vậy khi server bỏ ép cứng `diceOne = 3`.
 *
 * Nên: LĂN thì hiện khối (mới có cảm giác ba chiều), DỪNG thì lật sang mặt vuông
 * này - chấm thẳng hàng, đọc ra số ngay mà không cần nhìn chữ bên dưới.
 *
 * Dùng chung `PIPS` với khối, nên hai bên không bao giờ lệch cách xếp chấm.
 */
export function DiceFace({ value, size }: { value: number; size: number }) {
  const dot = size * 0.105;

  // Lưới chấm nằm trong khoảng 0.22-0.78 của cạnh, y hệt `facePips` của khối.
  const at = (i: number) => size * (0.22 + 0.28 * i);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect
        x={0}
        y={0}
        width={size}
        height={size}
        rx={size * 0.18}
        fill={C.top}
        stroke={C.edge}
        strokeWidth={1.5}
      />
      {(PIPS[value] ?? PIPS[1]).map(([row, col], i) => (
        <Circle key={i} cx={at(col)} cy={at(row)} r={dot} fill="#3B1E7A" />
      ))}
    </Svg>
  );
}

export function DiceCube({ value, size }: { value: number; size: number }) {
  const S = size / 2;

  /*
   * Khung hình của phép chiếu isometric: rộng bằng √3 nửa cạnh, cao bằng cạnh.
   * Khối cao hơn rộng - đó là hình dáng thật của một khối lập phương nhìn theo
   * kiểu isometric, không phải méo.
   */
  const width = S * 1.732;
  const height = size;
  const cx = width / 2;
  const cy = height / 2;

  /** Bảy đỉnh nhìn thấy được. */
  const T = { x: cx, y: cy - S }; // đỉnh trên cùng
  const R = { x: cx + S * 0.866, y: cy - S * 0.5 };
  const L = { x: cx - S * 0.866, y: cy - S * 0.5 };
  const Bd = { x: cx, y: cy }; // tâm - nơi ba mặt gặp nhau
  const Fb = { x: cx, y: cy + S }; // đáy trước
  const Lb = { x: cx - S * 0.866, y: cy + S * 0.5 };
  const Rb = { x: cx + S * 0.866, y: cy + S * 0.5 };

  const poly = (arr: { x: number; y: number }[]) => arr.map((p) => `${p.x},${p.y}`).join(' ');
  const dot = size * 0.062;

  type P = { x: number; y: number };

  /**
   * Chấm của một mặt.
   *
   * `origin` là góc (0,0) của mặt, `u` là cạnh chạy sang phải, `v` là cạnh chạy
   * xuống dưới - cả hai đều là cạnh ĐÃ CHIẾU, nên chấm tự nghiêng đúng theo mặt.
   */
  const facePips = (origin: P, u: P, v: P, faceValue: number, opacity: number) =>
    (PIPS[faceValue] ?? PIPS[1]).map(([row, col], i) => {
      const a = 0.22 + 0.28 * col;
      const b = 0.22 + 0.28 * row;
      return (
        <Circle
          key={i}
          cx={origin.x + a * u.x + b * v.x}
          cy={origin.y + a * u.y + b * v.y}
          r={dot}
          fill="#FDFAFF"
          opacity={opacity}
        />
      );
    });

  const sub = (p: P, q: P): P => ({ x: p.x - q.x, y: p.y - q.y });

  const sides = SIDES[value] ?? SIDES[1];

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Polygon points={poly([L, Bd, Fb, Lb])} fill={C.left} stroke={C.edge} strokeWidth={1} />
      <Polygon points={poly([Bd, R, Rb, Fb])} fill={C.right} stroke={C.edge} strokeWidth={1} />
      <Polygon points={poly([T, R, Bd, L])} fill={C.top} stroke={C.edge} strokeWidth={1} />

      {/*
        Mặt càng tối thì chấm càng dịu đi một chút - chấm trắng tinh trên mặt tối
        nhất trông như đèn LED, phá mất cảm giác khối.
      */}
      {facePips(T, sub(R, T), sub(L, T), value, 1)}
      {facePips(L, sub(Bd, L), sub(Lb, L), sides.left, 0.92)}
      {facePips(Bd, sub(R, Bd), sub(Fb, Bd), sides.right, 0.82)}
    </Svg>
  );
}
