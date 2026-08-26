import { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Polygon, Stop } from 'react-native-svg';

import { assetUrl, boardImageUrl, type GameBoard, type GamePlayer } from '../api/game';

/**
 * Bàn cờ: ảnh nền là SÂN, còn 21 ô màu được **TÔ** từ dữ liệu ô.
 *
 * ⚠️ Ảnh nền KHÔNG chứa sẵn các ô. Đây là chỗ đã sai một lần và phải viết lại
 * cả file. Bản web (`bindSquaresToPolygons` trong `wwwroot/js/board.js`) tô
 * từng polygon:
 *
 * | Thuộc tính | Lấy từ |
 * |---|---|
 * | `fill` | gradient dựng từ `SquareColor` - một chuỗi CSS `linear-gradient(...)` |
 * | `stroke` | `TileBaseBoxShadow`, rộng 2 |
 * | icon bên trong | `Background` + `X/Y/Width/Height/Angle`, cắt theo chính polygon đó |
 * | polygon con (`Index` có `-`) | tô ĐẶC bằng `TileBaseBackground` - mặt bên tạo khối 3D |
 *
 * Dữ liệu này không nằm ở bảng `Square` (bảng đó chỉ có `Id`,
 * `QuestionCategoryId`) mà ở `SquareTranslation` (theo ngôn ngữ) + `BoardGame`
 * (toạ độ icon). `GameStateApiController` đã ghép sẵn, app không phải làm gì.
 *
 * Dữ liệu thật của `crictriv`: 21 ô (`StepIndex` = -1 và 1..20) và 40 polygon
 * (20 mặt trên + 20 mặt bên). Ô `-1` là ô Start, **không có polygon** - nó chỉ
 * là một mục dữ liệu, đừng đi tìm hình cho nó.
 *
 * ⚠️⚠️ **KHÔNG ảnh nào nằm trong `<Svg>`** - không nền, không icon. Đây là kết
 * luận sau một chuỗi lỗi rất mất thời gian, đừng "dọn dẹp" bằng cách gộp lại:
 *
 *   - Để cả 21 ảnh trong SVG -> bàn cờ **chớp luân phiên**: khung này có nền
 *     nhưng mất icon, khung kia đủ icon nhưng mất nền.
 *   - Đưa nền ra ngoài (còn 20 ảnh) -> hết chớp, nhưng **vẫn mất 1-2 icon**, và
 *     ô bị mất ĐỔI mỗi lần chạy. Đã loại trừ dữ liệu: ảnh tải được (HTTP 200),
 *     và nét logo của ô bị mất nằm trọn trong hình ô (đã đo bằng toạ độ).
 *
 * Ô bị mất đổi ngẫu nhiên = `react-native-svg` không giữ nổi ngần ấy `<Image>`
 * trong một `<Svg>`, chứ không phải lỗi của ô nào. Nên: SVG chỉ vẽ **hình khối**
 * (polygon + gradient + quân cờ), còn mọi ảnh dùng `<Image>` của React Native
 * (Fresco lo phần giải mã) và định vị tuyệt đối theo phần trăm.
 *
 * Định vị theo phần trăm ánh xạ CHÍNH XÁC sang hệ toạ độ ViewBox, vì khung
 * ngoài đã khoá đúng `aspectRatio` của ViewBox.
 */

type Props = {
  board: GameBoard;
  players: GamePlayer[];
  /** Quân của người đang tới lượt vẽ to hơn. */
  currentTurnPlayerId: string;
};

/**
 * Cắt ảnh bàn cờ lại quanh vùng CÓ Ô, tính theo tỉ lệ của chính vùng đó.
 *
 * Ảnh gốc 1536×1024 nhưng các ô chỉ chiếm **55% chiều cao** - phần còn lại là
 * trời và cỏ. Vẽ nguyên khung thì vòng bàn cờ trông bé tí trên điện thoại dọc.
 * Cắt sát giúp vòng rộng thêm ~17% mà khung lại THẤP hơn, nhường chỗ cho phần
 * dưới màn hình.
 *
 * Chừa trên nhiều hơn dưới vì **quân cờ vẽ nhô lên trên tâm ô** - chừa đều là
 * quân ở hàng trên bị cắt đầu.
 */
const CROP = { left: 0.04, right: 0.04, top: 0.14, bottom: 0.06 };

/** "0 0 1536 1024" → [1536, 1024]. */
function parseViewBox(viewBox: string): [number, number] {
  const parts = viewBox.trim().split(/\s+/).map(Number);
  const ok = parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0;
  return ok ? [parts[2], parts[3]] : [1536, 1024];
}

type Point = { x: number; y: number };

function parsePoints(points: string): Point[] {
  const out: Point[] = [];
  for (const pair of points.trim().split(/\s+/)) {
    const [x, y] = pair.split(',').map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
  }
  return out;
}

/**
 * Tâm ô, tính bằng trung bình các đỉnh.
 *
 * Đủ dùng vì các ô đều lồi và khá đều; không cần trọng tâm đa giác thật. Sai
 * vài pixel trên khung rộng 1536 thì không thấy được.
 */
function centroid(pts: Point[]): Point | null {
  if (pts.length === 0) return null;
  const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / pts.length, y: sum.y / pts.length };
}

function bbox(pts: Point[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * Đọc chuỗi CSS `linear-gradient(135deg, #cde578 0%, #abcf2e 50%, ...)`.
 *
 * Port thẳng từ `parseCssGradient` trong board.js, giữ nguyên cả cách chuẩn hoá
 * `rgb(157 183 243)` (cú pháp cách nhau bằng khoảng trắng) về dạng có dấu phẩy -
 * `react-native-svg` không đọc được cú pháp mới.
 */
function parseCssGradient(raw: string): { angle: number; stops: { color: string; offset: string }[] } {
  const angle = Number(raw.match(/linear-gradient\(\s*([0-9.]+)deg/i)?.[1] ?? 0);

  const stops: { color: string; offset: string }[] = [];
  const regex = /(#[0-9a-fA-F]{3,6}|rgb\([^)]+\))\s*([0-9.]+)%/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    let color = match[1];
    if (color.startsWith('rgb(')) color = color.replace(/\s+/g, ',').replace(/,+/g, ',');
    stops.push({ color, offset: `${match[2]}%` });
  }

  return { angle, stops };
}

/**
 * Góc CSS → hai đầu mút của gradient trong hệ `objectBoundingBox`.
 *
 * Port thẳng từ `degToSVG`. CSS tính góc từ hướng 12 giờ và quay theo chiều kim
 * đồng hồ, nên phải trừ 90° trước khi đổi sang lượng giác.
 */
function degToSvg(deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return {
    x1: 0.5 - Math.cos(rad) / 2,
    y1: 0.5 - Math.sin(rad) / 2,
    x2: 0.5 + Math.cos(rad) / 2,
    y2: 0.5 + Math.sin(rad) / 2,
  };
}

/**
 * Id gradient, ĐỆM 2 CHỮ SỐ.
 *
 * ⚠️ Đệm là bắt buộc, không phải cho gọn mắt. Dùng id thô (`g1`, `g2`...) thì
 * `g1` là tiền tố của `g10..g19` và `g2` là tiền tố của `g20`, và
 * `react-native-svg` phân giải nhầm - đúng hai ô đầu bị hỏng, 18 ô còn lại vẫn
 * đúng. Triệu chứng đó cực dễ đổ oan cho dữ liệu của riêng hai ô đó.
 */
const gradId = (stepIndex: number) => `sqgrad${String(stepIndex).padStart(2, '0')}`;

/** Quân cờ, vẽ trong hệ toạ độ ViewBox nên phải to theo khung ảnh. */
const Pawn = ({ x, y, color, scale }: { x: number; y: number; color: string; scale: number }) => (
  <G x={x} y={y} scale={scale}>
    {/* Bóng dưới chân để quân không trông như đang lơ lửng. */}
    <Path d="M-14 18 a14 6 0 1 0 28 0 a14 6 0 1 0 -28 0" fill="rgba(0,0,0,0.45)" />
    <Path
      d="M0-26a11 11 0 0 1 6.8 19.7c5.2 3.2 8.4 8.4 8.4 13.9H-15.2c0-5.5 3.2-10.7 8.4-13.9A11 11 0 0 1 0-26z"
      fill={color}
      stroke="#FFFFFF"
      strokeWidth={2.5}
    />
    <Path d="M-18 9.5h36l4.5 14.8H-22.5z" fill={color} stroke="#FFFFFF" strokeWidth={2.5} />
  </G>
);

export const BoardCanvas = memo(({ board, players, currentTurnPlayerId }: Props) => {
  const geometry = board.Geometry;

  /*
   * ⚠️ MỌI THỨ TĨNH PHẢI NẰM TRONG `useMemo`, và cả component phải bọc `memo`.
   *
   * Không có hai thứ đó thì **bàn cờ nháy liên tục**: mỗi nhịp poll 3 giây tạo
   * ra một mảng `Players` mới, React coi là props đổi, và cả cây SVG bị dựng
   * lại - kể cả `<Defs>`, gradient, clip-path và toàn bộ `<Image>`. Dựng lại
   * `<Image>` nghĩa là **nạp lại ảnh**, nên nền sân và 20 icon chớp một cái ở
   * mỗi vòng poll.
   *
   * Phần phụ thuộc lượt chơi chỉ có QUÂN CỜ, nên chỉ nó được vẽ lại mỗi lần.
   */
  const layers = useMemo(() => {
    if (!geometry) return null;

    const [artWidth, artHeight] = parseViewBox(geometry.ViewBox);
    const squares = new Map(board.Squares.map((s) => [s.StepIndex, s]));

    const shapes = geometry.Polygons.map((polygon) => {
      const pts = parsePoints(polygon.Points);
      return { polygon, pts, box: bbox(pts), square: squares.get(polygon.StepIndex) };
    }).filter((s) => s.pts.length > 0);

    // Tâm MẶT TRÊN của mỗi ô. Mặt bên mang cùng StepIndex, lấy nhầm là quân cờ
    // đứng ở sườn khối.
    const centres = new Map<number, Point>();
    for (const shape of shapes) {
      if (shape.polygon.IsTileBase || centres.has(shape.polygon.StepIndex)) continue;
      const point = centroid(shape.pts);
      if (point) centres.set(shape.polygon.StepIndex, point);
    }

    const bases = shapes.filter((s) => s.polygon.IsTileBase);
    const tops = shapes.filter((s) => !s.polygon.IsTileBase);

    // Khung cắt: bao quanh mọi polygon rồi nới ra theo CROP.
    const allX = shapes.flatMap((s) => s.pts.map((q) => q.x));
    const allY = shapes.flatMap((s) => s.pts.map((q) => q.y));
    const cx1 = Math.min(...allX);
    const cy1 = Math.min(...allY);
    const cw0 = Math.max(...allX) - cx1;
    const ch0 = Math.max(...allY) - cy1;

    const vx = Math.max(0, cx1 - cw0 * CROP.left);
    const vy = Math.max(0, cy1 - ch0 * CROP.top);
    const vw = Math.min(artWidth - vx, cw0 * (1 + CROP.left + CROP.right));
    const vh = Math.min(artHeight - vy, ch0 * (1 + CROP.top + CROP.bottom));
    const viewBox = `${vx} ${vy} ${vw} ${vh}`;

    /*
     * Dựng luôn JSX ở đây, KHÔNG chỉ trả về dữ liệu rồi map lại ở thân render.
     *
     * `href` của `<Image>` là một OBJECT (`{uri}`). Map lại mỗi lần render sẽ
     * tạo object mới, `react-native-svg` coi là ảnh khác và **nạp lại ảnh** -
     * đúng cái làm bàn cờ chớp. Giữ nguyên phần tử JSX thì React bỏ qua hẳn
     * nhánh này khi so sánh.
     */
    const defs = (
      <Defs>
        {tops.map(({ polygon, square }) => {
          if (!square?.SquareColor) return null;
          const { angle, stops } = parseCssGradient(square.SquareColor);
          if (stops.length === 0) return null;
          const pos = degToSvg(angle);

          return (
            <LinearGradient
              key={`g-${polygon.Index}`}
              id={gradId(polygon.StepIndex)}
              x1={pos.x1}
              y1={pos.y1}
              x2={pos.x2}
              y2={pos.y2}
            >
              {stops.map((stop, i) => (
                <Stop key={i} offset={stop.offset} stopColor={stop.color} />
              ))}
            </LinearGradient>
          );
        })}
      </Defs>
    );

    /*
     * Ba lượt vẽ, đúng thứ tự này:
     *   1. mặt bên  -> khối 3D nằm dưới
     *   2. mặt trên -> ô màu
     *   3. icon     -> cắt theo ô, nằm trên cùng
     * Gộp icon vào lượt 2 thì một ô vẽ sau có thể đè lên icon của ô trước.
     */
    /** Chỉ HÌNH KHỐI nằm trong SVG - xem cảnh báo ở đầu file. */
    const tiles = (
      <>
        {bases.map(({ polygon, square }) => (
          <Polygon
            key={`base-${polygon.Index}`}
            points={polygon.Points}
            fill={square?.TileBaseBackground || '#1B2340'}
          />
        ))}

        {tops.map(({ polygon, square }) => (
          <Polygon
            key={`top-${polygon.Index}`}
            points={polygon.Points}
            fill={square?.SquareColor ? `url(#${gradId(polygon.StepIndex)})` : '#232B4C'}
            stroke={square?.TileBaseBoxShadow || '#FFFFFF'}
            strokeWidth={2}
          />
        ))}
      </>
    );

    /*
     * Icon từng ô, mô tả bằng PHẦN TRĂM để dựng `<Image>` của React Native.
     *
     * ⚠️ KHÔNG cắt theo hình ô, dù bản web có làm (`applyIconWithClip`). Cả hai
     * cách cắt của react-native-svg đều làm mất hẳn icon của vài ô. Bỏ cắt là
     * an toàn với dữ liệu hiện có: đã đo phần nhìn thấy được của cả 20 icon,
     * 17 ô tràn ra ngoài **0%**, cao nhất 3% (một mẩu nhỏ của Sheffield
     * Shield) - ảnh icon gần như trong suốt hoàn toàn và nét logo vốn đã được
     * căn nằm gọn trong ô.
     *
     * Nếu sau này có bộ bàn cờ mà icon tràn thấy rõ, đừng vội tìm cách cắt lại -
     * hãy sửa `X/Y/Width/Height` của ô đó trong trang quản trị.
     */
    const icons = tops.flatMap(({ polygon, square, box }) => {
      if (!square?.Background) return [];

      /*
       * Hai cách đặt icon, chép theo `applyIconWithClip`:
       *   X = 0  -> chưa ai chỉnh tay, tự căn giữa trong bbox của ô
       *   X != 0 -> dùng đúng toạ độ + góc quay quản trị viên đã đặt
       */
      const manual = square.X !== 0;
      const size = Math.min(box.width, box.height);

      const frame = manual
        ? { x: square.X, y: square.Y, width: square.Width, height: square.Height }
        : {
            x: box.x + (box.width - size) / 2,
            y: box.y + (box.height - size) / 2,
            width: size,
            height: size,
          };

      return [
        {
          key: `icon-${polygon.Index}`,
          uri: assetUrl(square.Background),
          style: {
            position: 'absolute' as const,
            left: `${((frame.x - vx) / vw) * 100}%` as const,
            top: `${((frame.y - vy) / vh) * 100}%` as const,
            width: `${(frame.width / vw) * 100}%` as const,
            height: `${(frame.height / vh) * 100}%` as const,
            transform: manual && square.Angle ? [{ rotate: `${square.Angle}deg` }] : undefined,
          },
        },
      ];
    });

    /*
     * Ảnh nền phải được CẮT y hệt: phóng nó lên theo tỉ lệ khung gốc / khung
     * cắt, rồi đẩy lệch đi phần bị cắt. Lệch một chút là quân cờ lệch ô.
     */
    const background = {
      left: `${(-vx / vw) * 100}%` as const,
      top: `${(-vy / vh) * 100}%` as const,
      width: `${(artWidth / vw) * 100}%` as const,
      height: `${(artHeight / vh) * 100}%` as const,
    };

    return { viewBox, aspect: vw / vh, background, centres, defs, tiles, icons };
  }, [board, geometry]);

  /*
   * ⚠️ CHƯA HỖ TRỢ `BoardType = 'rectangle'` - bàn đó sẽ ra TRẮNG TRƠN.
   *
   * `BoardGeometryService.Get` ở server chỉ sinh `Geometry` cho `oval`; với
   * `rectangle` nó trả `null` một cách hợp lệ, vì loại đó bản web KHÔNG dùng
   * polygon vẽ tay mà sinh toạ độ procedural từ `Hoz_step` × `Ver_step`
   * (`renderSteps()` trong `wwwroot/js/board.js`).
   *
   * Trong DB đang có ba nhóm: `crictriv` và `footietriv` là oval, còn một nhóm
   * `rectangle` (8 × 4, 25 ô). Chọn nhóm nào là do sponsor gắn với license, nên
   * chỉ cần một license trỏ vào nhóm đó là gặp ngay.
   *
   * Việc phải làm: thêm nhánh sinh polygon cho `rectangle` rồi rẽ theo
   * `board.BoardType`. Mọi thứ khác của màn (dải người chơi, quân cờ, bài, xúc
   * xắc) không phụ thuộc loại board.
   */
  if (!geometry || !layers) return null;

  const { viewBox, aspect, background, centres, defs, tiles, icons } = layers;

  // Nhiều người cùng một ô là chuyện thường - đứng chung ô chính là điều kiện
  // nổ battle (GAME_RULES mục 7). Xoè ngang để không chồng lên nhau.
  const perSquare = new Map<number, GamePlayer[]>();
  for (const player of players) {
    const list = perSquare.get(player.CurrentStepIndex);
    if (list) list.push(player);
    else perSquare.set(player.CurrentStepIndex, [player]);
  }

  return (
    <View style={[styles.frame, { aspectRatio: aspect }]}>
      {/*
        Lớp 1: ảnh nền sân.

        `resizeMode="stretch"` chứ không phải `cover`: khung đã khoá đúng
        `aspectRatio` của ViewBox, nên kéo căng là ánh xạ 1:1 với hệ toạ độ SVG.
        `cover` có thể cắt lệch vài pixel và làm quân cờ lệch ô.
      */}
      <Image
        source={{ uri: boardImageUrl(geometry.BackgroundImage) }}
        style={[styles.background, background]}
        resizeMode="stretch"
      />

      {/* Lớp 2: ô màu + mặt bên 3D. Chỉ hình khối, không ảnh. */}
      <Svg style={styles.overlay} width="100%" height="100%" viewBox={viewBox}>
        {defs}
        {tiles}
      </Svg>

      {/* Lớp 3: icon từng ô, `<Image>` của React Native chứ không phải của SVG. */}
      {icons.map((icon) => (
        <Image key={icon.key} source={{ uri: icon.uri }} style={icon.style} resizeMode="contain" />
      ))}

      {/* Lớp 4: quân cờ, nằm trên cùng để không bị icon che. */}
      <Svg style={styles.overlay} width="100%" height="100%" viewBox={viewBox}>
        {[...perSquare.entries()].map(([stepIndex, group]) => {
          const centre = centres.get(stepIndex);
          if (!centre) return null;

          const spread = 34;
          const offset = ((group.length - 1) * spread) / 2;

          return group.map((player, i) => (
            <Pawn
              key={player.Id}
              x={centre.x - offset + i * spread}
              y={centre.y}
              color={player.PlayerColor || '#2EE85F'}
              scale={player.Id === currentTurnPlayerId ? 1.3 : 1}
            />
          ));
        })}
      </Svg>
    </View>
  );
});

BoardCanvas.displayName = 'BoardCanvas';

const styles = StyleSheet.create({
  /*
   * Khoá theo `aspectRatio` của ViewBox, KHÔNG đặt chiều cao cứng.
   *
   * Polygon nằm trong hệ toạ độ của ViewBox, nên chỉ cần khung bị méo tỉ lệ là
   * quân cờ rơi sang ô khác. Thà bàn cờ thấp hơn ô chứa nó còn hơn lệch ô.
   */
  frame: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(110,140,210,0.26)',
    backgroundColor: '#07160D',
    position: 'relative',
  },
  background: { position: 'absolute' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
