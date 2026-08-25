/**
 * Bảng màu và công thức phát sáng của màn hình chính.
 *
 * Số liệu lấy đúng theo bản thiết kế `designs/Cyclic Home (standalone).html`.
 * Đừng chỉnh lẻ từng chỗ trong component - sửa ở đây để bốn nút luôn cùng hệ.
 */

export const bg = {
  /** Nền tối nhất, ở đáy màn hình */
  deep: '#04061A',
  /** Nền chủ đạo */
  base: '#070B1F',
  /** Sáng hơn, dùng cho vùng giữa nơi có chùm sáng */
  raised: '#0E1338',
  /** Tím ở hai mép trái/phải */
  edge: '#1B0E3A',
} as const;

export const text = {
  primary: '#FFFFFF',
  muted: 'rgba(255,255,255,0.55)',
} as const;

/** Ba màu của tagline PLAY • THINK • WIN */
export const tagline = {
  play: '#17C964',
  think: '#FFC61E',
  win: '#FF3B52',
} as const;

/** Ba lớp nền tối bên trong nút, tối nhất ở giữa để chữ nổi lên. */
export const buttonBody = ['#14101A', '#07060C', '#100C16'] as const;

export type NeonColor = {
  /** Màu nét chính: viền, icon, chevron */
  stroke: string;
  /**
   * Sắc nhạt hơn của `stroke`. Viền nút là gradient dọc `mid → stroke → mid`,
   * bắt chước cách ống neon thật sáng hơn ở mép trên/dưới do cong.
   */
  mid: string;
  /** "r,g,b" của `stroke` - để ghép chuỗi rgba() cho các lớp bóng đổ. */
  rgb: string;
};

const mk = (stroke: string, mid: string, rgb: string): NeonColor => ({ stroke, mid, rgb });

export const neon = {
  orange: mk('#FF6A12', '#FFD24A', '255,106,18'),
  purple: mk('#C56BFF', '#E9B6FF', '197,107,255'),
  blue: mk('#3AA5FF', '#9FD8FF', '58,165,255'),
  green: mk('#25D366', '#A6F7C6', '37,211,102'),
} as const satisfies Record<string, NeonColor>;

/*
 * ── Cường độ phát sáng ────────────────────────────────────────────────────
 *
 * Bản thiết kế HTML đẩy glow rất mạnh vì nó là ảnh trình bày, xem một lần.
 * Trong app thì đây là màn hình mở lên mỗi lần dùng, và bốn nút sáng cùng lúc
 * cộng dồn lại thành chói, tràn cả ra nền. Nên các số dưới đây đã hạ xuống so
 * với thiết kế; giá trị gốc ghi ngay cạnh để dễ chỉnh lại nếu muốn.
 *
 * Dùng `boxShadow` (RN 0.76+) chứ không phải bộ `shadowColor/shadowRadius` cũ -
 * bộ cũ chỉ nhận MỘT lớp, và trên Android nó rơi về `elevation`, vốn không đổi
 * được màu.
 */

/**
 * Quầng sáng ngoài nút: hai lớp - lõi gắt sát viền + một vầng loang vừa phải.
 *
 * Thiết kế gốc có ba lớp `18px .75 / 46px .45 / 90px .25`. Lớp 90px là thứ làm
 * ánh sáng tràn ra tận nền và các nút liếm vào nhau, nên bỏ hẳn; hai lớp còn
 * lại giảm cả bán kính lẫn độ đục.
 */
export const outerGlow = (c: NeonColor) =>
  `0 0 10px rgba(${c.rgb},0.40), 0 0 26px rgba(${c.rgb},0.16)`;

/**
 * Ánh sáng màu neon hắt từ viền vào trong thân nút, loang đều bốn phía.
 *
 * Gốc: `inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 34px rgba(c,.28)`.
 * Đã BỎ lớp `inset 0 1px 0` (gờ trắng sát cạnh trên): nó vẽ ra một vệt ngang
 * thấy rõ ở đỉnh mỗi nút. Trong CSS gờ đó là mép vát bắt sáng, nhưng ở đây
 * cạnh trên đã có viền gradient sáng sẵn nên nó chỉ thành vạch thừa.
 */
export const innerGlow = (c: NeonColor) => `inset 0 0 22px rgba(${c.rgb},0.14)`;

/**
 * Glow quanh nét icon. Gốc là hai lớp `10px + 22px`; một lớp mảnh là đủ để icon
 * trông có phát sáng mà không biến thành vệt nhoè.
 */
export const iconGlow = (c: NeonColor) => `drop-shadow(0 0 6px rgba(${c.rgb},0.55))`;

/*
 * ── Ô chọn được (thẻ thời lượng, ô số người chơi) ─────────────────────────
 *
 * Khác NeonColor ở chỗ có HAI trạng thái. Chỉ ô đang chọn mới phát sáng và đổi
 * màu chữ; các ô còn lại giữ nguyên một màu xanh trầm. Cho tất cả cùng sáng thì
 * không còn phân biệt được cái nào đang chọn.
 *
 * Số liệu theo `designs/NewGameScreen.tsx`.
 */
export type CellVariant = {
  line: string;
  label: string;
  /** Gradient nền bên trong ô */
  fill: readonly [string, string];
  rgb: string;
  glowOpacity: number;
};

export const cell = {
  idle: {
    line: '#2F8FFF',
    label: '#EEF4FF',
    fill: ['rgba(9,14,32,0.82)', 'rgba(4,6,18,0.9)'],
    rgb: '47,143,255',
    glowOpacity: 0,
  },
  /** Ô thời lượng đang chọn */
  purple: {
    line: '#C86BFF',
    label: '#C86BFF',
    fill: ['rgba(58,16,92,0.78)', 'rgba(22,8,44,0.88)'],
    rgb: '200,107,255',
    glowOpacity: 0.5,
  },
  /** Ô số người chơi đang chọn */
  orange: {
    line: '#FF8A1E',
    label: '#FF8A1E',
    fill: ['rgba(74,32,4,0.82)', 'rgba(26,12,2,0.9)'],
    rgb: '255,138,30',
    glowOpacity: 0.5,
  },
} as const satisfies Record<string, CellVariant>;

/** Quầng sáng của ô đang chọn. Ô không chọn trả chuỗi rỗng = không có bóng. */
export const cellGlow = (v: CellVariant) =>
  v.glowOpacity > 0
    ? `0 0 10px rgba(${v.rgb},${v.glowOpacity}), 0 0 24px rgba(${v.rgb},${v.glowOpacity * 0.4})`
    : 'none';

/** Màu của tiêu đề nhóm (`◇ GAME LENGTH ───`). */
export const section = {
  diamond: '#3AA5FF',
  title: '#3FE0FF',
  rule: ['rgba(150,190,235,0.55)', 'rgba(150,190,235,0.18)'] as const,
} as const;

/** Nút hành động chính ở cuối màn hình. */
export const cta = {
  line: '#2EE85F',
  label: '#EAFFF0',
  fill: ['rgba(10,30,16,0.85)', 'rgba(4,12,7,0.92)'] as const,
  rgb: '46,232,95',
} as const;
