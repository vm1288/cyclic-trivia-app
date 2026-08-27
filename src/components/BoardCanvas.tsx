import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, G, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';

import {
  assetUrl,
  boardImageUrl,
  characterImageUrl,
  type GameBoard,
  type GameCharacter,
  type GamePlayer,
} from '../api/game';
import { useT } from '../i18n/I18nProvider';

/**
 * Bàn cờ trong ván. HAI loại, và chúng lấy toạ độ từ hai nguồn khác hẳn nhau:
 *
 * | `BoardType` | Nguồn toạ độ |
 * |---|---|
 * | `oval` | `board.Geometry` - 40 polygon **trace tay** đè lên ảnh nền, server đọc từ `wwwroot/board-geometry/oval-{Ver_step}-{BoardGameId}.json` |
 * | `rectangle` | **sinh procedural** từ `Hoz_step` × `Ver_step`, không có ảnh nền - port `renderSteps()` trong `wwwroot/js/board.js` |
 *
 * `Geometry` NULL với `rectangle` là **đúng**, không phải lỗi dữ liệu. Chọn loại
 * nào là do `BoardGameGroup.BoardType` của sponsor gắn với license quyết định.
 *
 * Loại nào không dựng được thì hiện thông báo, KHÔNG `return null`. Bàn cờ
 * trắng trơn không lỗi không log là thứ rất dễ đổ oan cho mạng hoặc dữ liệu -
 * đã mất một vòng vì đúng chuyện đó.
 *
 * ─── Ô màu được TÔ từ dữ liệu, ảnh nền chỉ là sân ────────────────────────────
 *
 * ⚠️ Ảnh nền KHÔNG chứa sẵn các ô. Đây là chỗ đã sai một lần và phải viết lại
 * cả file. Bản web (`bindSquaresToPolygons` / `create2DStep` trong
 * `wwwroot/js/board.js`) tô từng ô:
 *
 * | Thuộc tính | Lấy từ |
 * |---|---|
 * | `fill` | gradient dựng từ `SquareColor` - một chuỗi CSS `linear-gradient(...)` |
 * | viền sáng | `TileBaseBoxShadow` |
 * | mặt bên / viền ngoài | `TileBaseBackground` - tạo khối 3D |
 * | icon bên trong | `Background` (+ `X/Y/Width/Height/Angle` với oval) |
 *
 * Dữ liệu này không nằm ở bảng `Square` (bảng đó chỉ có `Id`,
 * `QuestionCategoryId`) mà ở `SquareTranslation` (theo ngôn ngữ) + `BoardGame`
 * (toạ độ icon). `GameStateApiController` đã ghép sẵn, app không phải làm gì.
 *
 * Ô `StepIndex = -1` là ô Start: **không nằm trong vòng** và các trường màu đều
 * rỗng. Đừng đi tìm hình cho nó ở cả hai loại bàn.
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
 * ngoài đã khoá đúng tỉ lệ của ViewBox.
 */

type Props = {
  board: GameBoard;
  players: GamePlayer[];
  /** Quân của người đang tới lượt vẽ to hơn. */
  currentTurnPlayerId: string;
  /**
   * CHẾ ĐỘ THỬ: cho nhân vật của người tới lượt tự nhảy vòng quanh bàn cờ.
   *
   * Chỉ để xem hiệu ứng nhảy và kiểm toạ độ từng ô - nước đi THẬT đi qua packet
   * `Pub` của SignalR mà app chưa nối. Nối xong thì bỏ cờ này và để
   * `CurrentStepIndex` tự lái.
   */
  demoJump?: boolean;
};

export const BoardCanvas = memo((props: Props) => {
  const type = (props.board.BoardType || '').trim().toLowerCase();

  if (type === 'rectangle') return <RectangleBoard {...props} />;
  if (type === 'oval' && props.board.Geometry) return <OvalBoard {...props} />;

  /*
   * Còn lại là: loại bàn mới chưa có nhánh vẽ, hoặc `oval` mà server không tìm
   * thấy file geometry (tên file ghép từ `Ver_step` + `BoardGameId`, sai một
   * trong hai là `Geometry` về null).
   */
  return <UnsupportedBoard />;
});

BoardCanvas.displayName = 'BoardCanvas';

/* ── dùng chung ───────────────────────────────────────────────────────────── */

type Point = { x: number; y: number };

/** "0 0 1536 1024" → [1536, 1024]. */
function parseViewBox(viewBox: string): [number, number] {
  const parts = viewBox.trim().split(/\s+/).map(Number);
  const ok = parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0;
  return ok ? [parts[2], parts[3]] : [1536, 1024];
}

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

/**
 * Đo chỗ trống THẬT SỰ còn lại cho bàn cờ.
 *
 * ⚠️ Cả hai loại bàn đều phải đi qua đây, không chỉ `rectangle`.
 *
 * Trước đây bàn `oval` dùng `width: '100%'` + `aspectRatio`, nghĩa là chiều cao
 * của nó = bề ngang / tỉ lệ và **không bị chiều cao khả dụng chặn**. Khung cha
 * (`boardCol`) lại căn giữa, nên khi bàn cờ cao hơn chỗ trống thì phần dư tràn
 * ĐỀU cả trên lẫn dưới - và phần tràn phía trên chui vào dải người chơi.
 *
 * Triệu chứng: "dải nhân vật đè nhẹ lên bàn cờ". Rất dễ đổ oan cho dải nhân
 * vật và đi chỉnh chiều cao của nó, trong khi thủ phạm là bàn cờ.
 *
 * Đo rồi lấy `min(theo bề ngang, theo chiều cao)` thì bàn cờ KHÔNG BAO GIỜ
 * tràn ra khỏi khung cha, dải người chơi to nhỏ thế nào cũng không đè được.
 *
 * `height` bằng 0 khi khung cha không có chiều cao xác định (ví dụ nằm trong
 * `ScrollView` - `app/game.tsx`). Lúc đó chỉ dựa vào bề ngang: vẫn đúng tỉ lệ,
 * chỉ là không tự thu lại cho vừa chiều cao.
 */
function useMeasuredBox() {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((current) =>
      current && Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
        ? current
        : { width, height },
    );
  };

  return [box, onLayout] as const;
}

/* ── nhân vật đứng trên bàn cờ ────────────────────────────────────────────── */

/**
 * Ảnh nhân vật cao 754px, bề ngang mỗi con một khác (430..659, tức tỉ lệ
 * 0.57..0.87). Nên khung phải tính theo CHIỀU CAO rồi `resizeMode="contain"`,
 * đừng khoá bề ngang - khoá là con rộng nhất bị bóp méo.
 */
const CHAR_BOX_RATIO = 0.92;

/** Độ cao cú nhảy, tính theo chiều cao nhân vật. */
const HOP_RISE = 0.55;

/** Thời gian nhảy QUA MỘT ô. */
const HOP_MS = 320;

/**
 * Nháy mắt: đảo giữa khung `-0` (mắt mở) và `-1` (mắt nhắm).
 *
 * Hai file đó chỉ khác nhau đúng đôi mắt - server đã có sẵn cả bộ, không phải
 * dựng sprite. Bản web ghép 12 khung bằng CSS sprite; ở đây hai khung là đủ cho
 * cái nháy mắt, và rẻ hơn nhiều.
 *
 * ⚠️ Vẽ CHỒNG hai ảnh rồi đổi `opacity`, KHÔNG đổi `source` của một `<Image>`.
 * Đổi `source` là Fresco nạp lại ảnh và nhân vật chớp mất một nhịp - đúng lỗi
 * đã làm cả bàn cờ chớp hồi trước.
 */
const BLINK_SHUT_MS = 70;

/** Khoảng cách giữa hai lần nháy, ms. Ngẫu nhiên để mấy con không nháy đồng loạt. */
const BLINK_GAP_MS = { min: 2200, max: 5200 };

/**
 * Một nhân vật trên bàn cờ, tự nhảy sang ô mới khi `targetIndex` đổi.
 *
 * ⚠️ Ảnh KHÔNG nằm trong `<Svg>` (xem cảnh báo đầu file), nên đây là `<Image>`
 * của React Native định vị tuyệt đối trong khung bàn cờ. Khung giờ có kích
 * thước px tường minh (`useMeasuredBox`), nên đổi từ đơn vị ViewBox sang px chỉ
 * là một phép nhân - không cần phần trăm như lớp icon.
 *
 * ⚠️ Chạy bằng Reanimated trên UI THREAD, đúng theo AGENTS.md: JS thread sẽ bận
 * vì packet SignalR, animation chạy ở đó sẽ giật.
 *
 * ⚠️ Sửa xong PHẢI force-stop app rồi mở lại. Fast refresh dựng lại component
 * nhưng KHÔNG nạp lại `useSharedValue` và vòng `withTiming` đang chạy, nên đo
 * lại ngay sau fast refresh sẽ ra kết quả sai (SETUP_NOTES đã ghi).
 */
function BoardCharacter({
  player,
  path,
  targetIndex,
  charHeight,
  scale,
  isTurn,
  lane,
  laneCount,
  aspect,
  footRatio,
  hasBlink,
}: {
  player: GamePlayer;
  /** Toạ độ tâm từng ô theo ĐÚNG thứ tự đi vòng, đơn vị px của khung. */
  path: Point[];
  /** Vị trí trong `path` mà nhân vật phải tới. */
  targetIndex: number;
  /** Chiều cao nhân vật, px. */
  charHeight: number;
  /** px trên một đơn vị ViewBox - dùng để giãn cách khi nhiều người cùng ô. */
  scale: number;
  isTurn: boolean;
  /** Thứ tự trong nhóm cùng đứng một ô, để xoè ngang. */
  lane: number;
  /** Tổng số người cùng đứng ô đó. */
  laneCount: number;
  /** Bề ngang / chiều cao của ảnh con này. */
  aspect: number;
  /** Chân nằm ở đâu theo chiều cao ảnh. */
  footRatio: number;
  /** `{id}-1.png` có phải khung mắt nhắm THẬT không. False thì đừng tải. */
  hasBlink: boolean;
}) {
  const progress = useSharedValue(targetIndex);
  const previous = useRef(targetIndex);

  useEffect(() => {
    const from = previous.current;
    const to = targetIndex;
    previous.current = to;

    if (from === to) return;

    /*
     * Đi VÒNG chứ không cắt ngang: luôn tiến theo chiều tăng, quá cuối thì cộng
     * thêm cả vòng rồi mới chuẩn hoá lại. Nhảy thẳng từ ô cuối về ô đầu là nhân
     * vật bay ngang qua giữa bàn cờ.
     */
    const n = path.length;
    const forward = ((to - from) % n + n) % n;

    progress.value = from;
    progress.value = withTiming(from + forward, {
      duration: HOP_MS * Math.max(1, forward),
      easing: Easing.linear,
    });
  }, [targetIndex, path.length, progress]);

  /*
   * Nháy mắt, chạy mãi và ĐỘC LẬP với nước đi.
   *
   * Pha ban đầu ngẫu nhiên (giữ trong `useRef` để fast refresh không dựng lại
   * số mới mỗi lần), nếu không thì mấy nhân vật nháy đồng loạt trông như lỗi
   * render chứ không như đang thở.
   */
  const shut = useSharedValue(0);
  const gap = useRef(
    BLINK_GAP_MS.min + Math.random() * (BLINK_GAP_MS.max - BLINK_GAP_MS.min),
  ).current;

  useEffect(() => {
    shut.value = withDelay(
      Math.random() * gap,
      withRepeat(
        withSequence(
          withTiming(1, { duration: BLINK_SHUT_MS }),
          withTiming(0, { duration: BLINK_SHUT_MS }),
          withDelay(gap, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );
  }, [shut, gap]);

  const blink = useAnimatedStyle(() => ({ opacity: shut.value }));

  /*
   * Khung khớp ĐÚNG tỉ lệ của chính con đó, không phải một khung đoán sẵn.
   *
   * ⚠️ Bộ 12 con của CricTriv có nhiều con vẽ NẰM NGANG (komodo 1.58, hippo
   * 1.29, rhino 1.28) trong khi 6 con cũ đều đứng dọc (0.57..0.87). Dùng chung
   * một khung rồi `contain` thì con nằm ngang bị co lại và CĂN GIỮA khung -
   * chân nó lơ lửng phía trên ô. Khớp khung đúng tỉ lệ thì mép dưới khung
   * chính là chân, và `footRatio` đặt nó lên mặt ô.
   *
   * Vẫn chặn theo BỀ NGANG: cao 120 mà tỉ lệ 1.58 là rộng 190 đơn vị, gần hai ô
   * của bàn rectangle.
   */
  const maxWidth = charHeight * CHAR_BOX_RATIO * 1.35;
  const boxHeight = Math.min(charHeight, maxWidth / aspect);
  const charWidth = boxHeight * aspect;
  const rise = boxHeight * HOP_RISE;

  /*
   * Nhiều người cùng một ô thì XOÈ ĐỀU hai bên quanh tâm ô, không dồn một phía.
   *
   * Nghĩa là con đang đứng sẵn cũng **nhích ra** khi có con khác nhảy vào -
   * giống hệt lớp quân cờ cũ. Cho lệch một phía thì cả nhóm trôi dần sang phải
   * và con đầu tiên luôn che mất tâm ô.
   *
   * Đứng chung ô là chuyện thường - đó chính là điều kiện nổ battle
   * (GAME_RULES mục 7).
   */
  const spread = (lane - (laneCount - 1) / 2) * scale * 22;

  const style = useAnimatedStyle(() => {
    'worklet';
    const n = path.length;
    if (n === 0) return { opacity: 0 };

    const p = progress.value;
    const i = Math.floor(p);
    const f = p - i;

    const a = path[((i % n) + n) % n];
    const b = path[(((i + 1) % n) + n) % n];

    const x = a.x + (b.x - a.x) * f;
    const y = a.y + (b.y - a.y) * f - Math.sin(Math.PI * f) * rise;

    return {
      opacity: 1,
      transform: [
        { translateX: x - charWidth / 2 + spread },
        { translateY: y - boxHeight * footRatio },
        // Người tới lượt to hơn một chút cho dễ nhận ra.
        { scale: isTurn ? 1.12 : 1 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0, width: charWidth, height: boxHeight }, style]}
    >
      {/* Bóng dưới chân, mang màu người chơi để phân biệt khi nhiều người cùng ô. */}
      <View
        style={{
          position: 'absolute',
          left: charWidth * 0.18,
          bottom: boxHeight * (1 - footRatio) - boxHeight * 0.03,
          width: charWidth * 0.64,
          height: boxHeight * 0.11,
          borderRadius: boxHeight * 0.06,
          backgroundColor: player.PlayerColor || '#2EE85F',
          opacity: 0.55,
        }}
      />
      {/* Mắt mở - luôn hiện, nằm dưới. */}
      <Image
        source={{ uri: characterImageUrl(player.CharacterId) }}
        style={styles.charFrame}
        resizeMode="contain"
      />
      {/*
        Mắt nhắm - chồng lên, chỉ hiện đúng lúc nháy.

        ⚠️ Chỉ vẽ khi bộ nhân vật CÓ khung mắt nhắm thật. Bộ 12 con mới không
        có; `{id}-1.png` của chúng là bản sao của `-0` (để web/app không 404),
        nên vẽ ra là tải thừa ~450KB mỗi người chơi mà nhìn không khác gì.
      */}
      {hasBlink ? (
        <Animated.Image
          source={{ uri: characterImageUrl(player.CharacterId, 1) }}
          style={[styles.charFrame, blink]}
          resizeMode="contain"
        />
      ) : null}
    </Animated.View>
  );
}

/**
 * Lớp nhân vật: đổi `centres` (đơn vị ViewBox) sang px rồi vẽ từng người.
 *
 * `order` là danh sách `StepIndex` theo ĐÚNG chiều đi vòng. Cả hai loại bàn đều
 * là `StepIndex` tăng dần - với `oval` thì hiển nhiên, còn `rectangle` đã kiểm
 * lại: mọi `StepIndex` liền nhau đều nằm cạnh nhau trên lưới, kể cả 24 → 1.
 */
function Characters({
  players,
  currentTurnPlayerId,
  characterInfo,
  centres,
  vx,
  vy,
  vw,
  frameWidth,
  charHeight,
  demoFrom,
}: {
  players: GamePlayer[];
  currentTurnPlayerId: string;
  /**
   * Bộ nhân vật của board này (`Board.Characters`), để tra tỉ lệ ảnh.
   *
   * ⚠️ Không tra được thì rơi về 0.8 / 0.88 - đúng dáng 6 con cũ. Con nằm ngang
   * mà rơi vào nhánh đó sẽ đứng sai, nên nếu thấy nhân vật lơ lửng thì kiểm
   * `Board.Characters` có xuống tới đây không, đừng chỉnh số ở đây.
   */
  characterInfo: Map<string, GameCharacter>;
  centres: Map<number, Point>;
  /**
   * GỐC toạ độ của ViewBox.
   *
   * ⚠️ KHÔNG phải lúc nào cũng `0 0`. Bàn oval bị CẮT quanh vùng có ô nên
   * viewBox của nó là `"124.2 225.3 1271.7 627.7"`, trong khi `centres` lại
   * nằm trong hệ toạ độ GỐC của ảnh (0..1536). Quên trừ phần này là nhân vật
   * lệch xuống dưới - sang phải đúng bằng (vx, vy) - đã dính một lần, nhân vật
   * rơi vào giữa sân thay vì đứng trên ô.
   *
   * Bàn rectangle sinh viewBox từ `0 0` nên truyền 0.
   */
  vx: number;
  vy: number;
  vw: number;
  frameWidth: number;
  /** Chiều cao nhân vật, đơn vị ViewBox. */
  charHeight: number;
  /**
   * CHẾ ĐỘ THỬ: ô xuất phát của vòng nhảy demo. `null` = tắt, nhân vật đứng
   * đúng ô mà server báo.
   */
  demoFrom: number | null;
}) {
  const scale = frameWidth / vw;

  const order = useMemo(
    () => [...centres.keys()].filter((i) => i > 0).sort((a, b) => a - b),
    [centres],
  );

  const path = useMemo(
    () =>
      order.map((stepIndex) => {
        const c = centres.get(stepIndex) as Point;
        return { x: (c.x - vx) * scale, y: (c.y - vy) * scale };
      }),
    [order, centres, scale, vx, vy],
  );

  /*
   * Vòng nhảy thử: cứ HOP_MS một nhịp thì tiến một ô, chạy mãi.
   *
   * Đây là đường DUY NHẤT hiện có để thấy nhân vật di chuyển - nước đi thật đi
   * qua packet `Pub` của SignalR mà app chưa nối. Khi nối xong thì bỏ nó đi và
   * để `CurrentStepIndex` tự lái.
   */
  const [demoStep, setDemoStep] = useState(0);
  useEffect(() => {
    if (demoFrom === null || order.length === 0) return;
    const timer = setInterval(() => setDemoStep((s) => s + 1), HOP_MS + 260);
    return () => clearInterval(timer);
  }, [demoFrom, order.length]);

  if (order.length === 0) return null;

  /*
   * Ai là người nhảy trong chế độ thử: người tới lượt, hoặc người đầu tiên khi
   * chưa xác định được lượt (`CurrentTurnPlayerId` là `Guid.Empty` lúc vòng đua
   * "ai đi trước" chưa có kết quả, và cả khi ván đã kết thúc). Không có nhánh
   * dự phòng này thì bật demo lên mà chẳng ai nhúc nhích.
   */
  const demoPlayerId =
    players.find((p) => p.Id === currentTurnPlayerId)?.Id ?? players[0]?.Id ?? '';

  /*
   * HAI LƯỢT: đếm xong mới gán chỗ.
   *
   * Muốn xoè đều quanh tâm ô thì phải biết TỔNG số người trên ô đó trước khi
   * tính độ lệch của từng con - một lượt duy nhất chỉ biết "đã gặp mấy con",
   * chưa biết còn bao nhiêu con nữa.
   */
  const targets = players.map((player) => {
    const isDemo = demoFrom !== null && player.Id === demoPlayerId;
    const home = order.indexOf(player.CurrentStepIndex);
    const base = home >= 0 ? home : 0;
    return isDemo ? base + demoStep : base;
  });

  const counts = new Map<number, number>();
  for (const t of targets) {
    const key = ((t % order.length) + order.length) % order.length;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const seen = new Map<number, number>();

  return (
    <>
      {players.map((player, i) => {
        const targetIndex = targets[i];
        const key = ((targetIndex % order.length) + order.length) % order.length;

        const lane = seen.get(key) ?? 0;
        seen.set(key, lane + 1);

        return (
          <BoardCharacter
            key={player.Id}
            player={player}
            path={path}
            targetIndex={targetIndex}
            charHeight={charHeight * scale}
            scale={scale}
            isTurn={player.Id === currentTurnPlayerId}
            lane={lane}
            laneCount={counts.get(key) ?? 1}
            aspect={characterInfo.get(player.CharacterId)?.Aspect ?? 0.8}
            footRatio={characterInfo.get(player.CharacterId)?.FootRatio ?? 0.88}
            hasBlink={characterInfo.get(player.CharacterId)?.HasBlink ?? true}
          />
        );
      })}
    </>
  );
}

/* ── oval ─────────────────────────────────────────────────────────────────── */

/**
 * Cắt ảnh bàn cờ lại quanh vùng CÓ Ô, tính theo tỉ lệ của chính vùng đó.
 *
 * Ảnh gốc 1536×1024 nhưng các ô chỉ chiếm **55% chiều cao** - phần còn lại là
 * trời và cỏ. Vẽ nguyên khung thì vòng bàn cờ trông bé tí trên điện thoại.
 * Cắt sát giúp vòng rộng thêm ~17% mà khung lại THẤP hơn, nhường chỗ cho phần
 * dưới màn hình.
 *
 * Chừa trên nhiều hơn dưới vì **quân cờ vẽ nhô lên trên tâm ô** - chừa đều là
 * quân ở hàng trên bị cắt đầu.
 *
 * ⚠️ `top` KHÔNG được nhỏ hơn ~0.08. Quân cờ cao ~34 đơn vị tính từ tâm ô, và
 * quân của người đang tới lượt còn phóng 1.3 lần (~44 đơn vị). Vùng ô cao 563
 * đơn vị, nên 0.08 mới đủ 45 đơn vị headroom; thấp hơn là cụt đầu quân ở hàng
 * trên cùng.
 */
const CROP = { left: 0.012, right: 0.012, top: 0.09, bottom: 0.025 };

function OvalBoard({ board, players, currentTurnPlayerId, demoJump }: Props) {
  // Tra cứu nhanh theo `CharacterId`; `Board.Characters` do server cấp.
  const characterInfo = useMemo(
    () => new Map((board.Characters ?? []).map((c) => [c.Id, c])),
    [board.Characters],
  );
  const geometry = board.Geometry;
  const [box, onLayout] = useMeasuredBox();

  /*
   * ⚠️ MỌI THỨ TĨNH PHẢI NẰM TRONG `useMemo`, và `BoardCanvas` phải bọc `memo`.
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

    return { viewBox, vx, vy, vw, aspect: vw / vh, background, centres, defs, tiles, icons };
  }, [board, geometry]);

  if (!geometry || !layers) return <UnsupportedBoard />;

  const { viewBox, vx: vx0, vy: vy0, vw, aspect, background, centres, defs, tiles, icons } = layers;

  /*
   * Vừa theo BỀ NGANG vừa theo CHIỀU CAO - xem `useMeasuredBox`.
   *
   * Làm tròn XUỐNG số nguyên dp để lần đo lại sau đó cho đúng cùng một kết
   * quả; để số lẻ thì khung và phép đo đuổi nhau thêm một, hai vòng render.
   */
  const height = box
    ? Math.floor(box.height > 1 ? Math.min(box.width / aspect, box.height) : box.width / aspect)
    : 0;
  const width = Math.floor(height * aspect);

  if (height <= 0) return <View style={styles.fit} onLayout={onLayout} />;

  return (
    <View style={styles.fit} onLayout={onLayout}>
      <View style={styles.glow}>
      <View style={[styles.frame, styles.ovalFrame, { width, height }]}>
        {/*
          Lớp 1: ảnh nền sân.

          `resizeMode="stretch"` chứ không phải `cover`: khung đã được tính đúng
          tỉ lệ của ViewBox, nên kéo căng là ánh xạ 1:1 với hệ toạ độ SVG.
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

        </View>

        {/*
          Lớp 4: nhân vật.

          ⚠️ Nằm NGOÀI `frame`, không nằm trong. `frame` có `overflow: 'hidden'`
          (bắt buộc, để bo góc ảnh nền vốn được phóng to và đẩy lệch) - để nhân
          vật bên trong thì con nào đứng ở HÀNG TRÊN sẽ bị **cắt mất đầu**.

          Ô oval cao ~80-99 đơn vị trong ViewBox cao 627, nên nhân vật 120 đơn
          vị là cao hơn ô một chút - đúng như bản web (`boardCharHeight =
          stepHeight + 30`).
        */}
        <View pointerEvents="none" style={[styles.charLayer, { width, height }]}>
          <Characters
            players={players}
            currentTurnPlayerId={currentTurnPlayerId}
            characterInfo={characterInfo}
            centres={centres}
            vx={vx0}
            vy={vy0}
            vw={vw}
            frameWidth={width}
            charHeight={120}
            demoFrom={demoJump ? 0 : null}
          />
        </View>
      </View>
    </View>
  );
}

/* ── rectangle ────────────────────────────────────────────────────────────── */

/**
 * Một ô rộng đúng `CELL` đơn vị ViewBox.
 *
 * Con số tuỳ ý, nhưng đổi thì nhớ đổi cả `charHeight` truyền cho `Characters` -
 * nhân vật phải cao hơn ô một chút, giống bản web (`stepHeight + 30`).
 */
const CELL = 100;

/**
 * Ba lớp của mặt ô, chép theo `.showFrontOuter` / `.showFrontBorder` /
 * `.showFrontBackground` trong `board.css`:
 *
 *   ngoài cùng `TileBaseBackground` -> viền `TileBaseBoxShadow` -> mặt gradient
 *
 * Bản web dùng 2px và 4px trên ô cỡ ~100px. Ở đây nới lên 4+4 đơn vị: trên điện
 * thoại một ô chỉ còn ~50dp, mà 2 đơn vị = 1dp thì viền sáng gần như biến mất.
 */
const OUTER_BAND = 4;
const RIM_BAND = 4;

/** Bề dày khối 3D, vẽ thò xuống dưới mặt ô. */
const DEPTH = 12;

/**
 * Icon chiếm 90% ô, đúng `max-width/max-height: 90%` của `.tile-icon`.
 *
 * `X/Y/Width/Height` trong `BoardGame` **bị bỏ qua ở loại này** - bản web cũng
 * vậy (`create2DStep` đặt icon bằng CSS, không đọc toạ độ). Dữ liệu thật hiện
 * có cũng để cả bốn trường bằng 0.
 */
const ICON_RATIO = 0.9;

type RectSlot = { col: number; row: number };

/**
 * Thứ tự đi vòng của bàn `rectangle`, dựng lại đúng như bản web đặt các `div`.
 *
 * Bản web không có toạ độ vẽ sẵn: `renderSteps()` trong `board.js` chia
 * `squareList` (đã sắp theo `StepNumber`) thành bốn đoạn rồi thả vào bốn
 * container. Hàm này trả về đúng vị trí ô thứ `i` của `squareList`, nên chỉ cần
 * ghép 1-1 theo thứ tự là ra bàn cờ giống hệt.
 *
 * Lưới rộng `Hoz_step` cột × `Ver_step + 2` hàng; chỉ có viền ngoài là ô, ruột
 * để trống (bản web nhét khung câu hỏi vào đó, app thì để trống vì xúc xắc và
 * câu hỏi nằm ở cột phải).
 *
 * ⚠️ `HORIZONTAL_STEPS` của board.js là `Hoz_step - 2`, tức **số ô GIỮA** của
 * hàng ngang, chưa tính hai ô góc. Đọc nhầm nó thành số cột là lệch cả vòng.
 *
 * Chiều đi: từ hàng dưới chạy sang TRÁI -> ngược lên cạnh trái -> sang phải
 * theo hàng trên -> xuống cạnh phải -> ô góc dưới-phải, rồi vòng lại đầu. Nhờ
 * vậy `StepIndex` liền nhau thì ô cũng nằm cạnh nhau, và quân cờ đi đúng vòng.
 */
function rectangleRing(hozStep: number, verStep: number): RectSlot[] {
  const cols = hozStep;
  const lastRow = verStep + 1;
  const middle = hozStep - 2; // HORIZONTAL_STEPS
  const side = verStep; // VERTICAL_STEPS

  const slots: RectSlot[] = [];

  // hàng dưới, các ô giữa: phải -> trái (`calculateBottomSteps` đi lùi chỉ số)
  for (let k = 0; k < middle; k++) slots.push({ col: middle - k, row: lastRow });
  slots.push({ col: 0, row: lastRow }); // góc dưới-trái
  // cạnh trái: dưới -> trên (`renderLeftSteps` cũng đi lùi chỉ số)
  for (let j = 0; j < side; j++) slots.push({ col: 0, row: side - j });
  slots.push({ col: 0, row: 0 }); // góc trên-trái
  // hàng trên, các ô giữa: trái -> phải
  for (let k = 0; k < middle; k++) slots.push({ col: 1 + k, row: 0 });
  slots.push({ col: cols - 1, row: 0 }); // góc trên-phải
  // cạnh phải: trên -> dưới
  for (let j = 0; j < side; j++) slots.push({ col: cols - 1, row: 1 + j });
  slots.push({ col: cols - 1, row: lastRow }); // góc dưới-phải

  return slots;
}

function RectangleBoard({ board, players, currentTurnPlayerId, demoJump }: Props) {
  // Tra cứu nhanh theo `CharacterId`; `Board.Characters` do server cấp.
  const characterInfo = useMemo(
    () => new Map((board.Characters ?? []).map((c) => [c.Id, c])),
    [board.Characters],
  );
  /*
   * Bàn này KHÔNG có ảnh nền để suy ra tỉ lệ, và ô phải VUÔNG - nên ngoài việc
   * vừa khung (xem `useMeasuredBox`), cạnh ô còn phải là số nguyên.
   *
   * Tỉ lệ của nó (8×6 ≈ 1.31) gần vuông hơn oval (≈2.03) rất nhiều, nên nó là
   * loại bàn chạm trần chiều cao trước.
   */
  const [box, onLayout] = useMeasuredBox();

  // Xem ghi chú `useMemo` ở `OvalBoard` - cùng lý do, cùng hậu quả nếu bỏ.
  const layers = useMemo(() => {
    const cols = board.Hoz_step ?? 0;
    const verStep = board.Ver_step ?? 0;
    // Nhỏ hơn thì không thành vòng: cần ít nhất hai ô góc + một ô giữa mỗi cạnh.
    if (cols < 3 || verStep < 1) return null;

    const rows = verStep + 2;

    /*
     * ⚠️ Ghép theo `StepNumber`, KHÔNG theo `StepIndex`.
     *
     * Hai cột đó LỆCH NHAU ở bàn rectangle: `StepNumber` 1..24 ứng với
     * `StepIndex` 2..24 rồi 1 (ô góc dưới-phải là StepNumber 24 nhưng
     * StepIndex 1). `squareList` của bản web sắp theo `StepNumber`, còn
     * `CurrentStepIndex` của người chơi thì trỏ theo `StepIndex` - lấy nhầm một
     * cái là cả bàn cờ xoay đi một ô.
     *
     * Cũng đừng suy số ô từ `Hoz_step`/`Ver_step` để cắt bớt: luôn đọc từ
     * `Squares`.
     */
    const ring = board.Squares.filter((s) => s.StepIndex !== -1)
      .slice()
      .sort((a, b) => a.StepNumber - b.StepNumber);

    const slots = rectangleRing(cols, verStep);
    const cells = slots.slice(0, ring.length).map((slot, i) => ({
      ...slot,
      square: ring[i],
      x: slot.col * CELL,
      y: slot.row * CELL,
    }));
    if (cells.length === 0) return null;

    const vw = cols * CELL;
    const vh = rows * CELL + DEPTH; // + DEPTH: khối 3D của hàng dưới thò ra ngoài lưới
    const viewBox = `0 0 ${vw} ${vh}`;

    const centres = new Map<number, Point>();
    for (const cell of cells) {
      centres.set(cell.square.StepIndex, { x: cell.x + CELL / 2, y: cell.y + CELL / 2 });
    }

    const defs = (
      <Defs>
        {cells.map(({ square }) => {
          if (!square.SquareColor) return null;
          const { angle, stops } = parseCssGradient(square.SquareColor);
          if (stops.length === 0) return null;
          const pos = degToSvg(angle);

          return (
            <LinearGradient
              key={`g-${square.StepNumber}`}
              id={gradId(square.StepIndex)}
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
     * ⚠️ Vẽ theo HÀNG TỪ TRÊN XUỐNG.
     *
     * Khối 3D của mỗi ô thò xuống `DEPTH` đơn vị, tức đè vào ô ngay bên dưới
     * (cạnh trái và cạnh phải có ô xếp chồng theo chiều dọc). Vẽ hàng dưới sau
     * thì nó che phần thò ra đó, đúng như một chồng khối nhìn từ trên xuống.
     * Vẽ sai thứ tự là mặt ô bị một vệt tối cắt ngang.
     */
    const tiles = (
      <>
        {cells
          .slice()
          .sort((a, b) => a.row - b.row)
          .map(({ square, x, y }) => {
            const base = square.TileBaseBackground || '#1B2340';
            const face = square.SquareColor ? `url(#${gradId(square.StepIndex)})` : '#232B4C';

            return (
              <G key={`tile-${square.StepNumber}`}>
                {/* Mặt bên: bắt đầu từ giữa ô nên không để lại đường nối với mặt trên. */}
                <Rect
                  x={x}
                  y={y + CELL / 2}
                  width={CELL}
                  height={CELL / 2 + DEPTH}
                  rx={9}
                  fill={base}
                />
                <Rect x={x} y={y} width={CELL} height={CELL} rx={9} fill={base} />
                <Rect
                  x={x + OUTER_BAND}
                  y={y + OUTER_BAND}
                  width={CELL - OUTER_BAND * 2}
                  height={CELL - OUTER_BAND * 2}
                  rx={7}
                  fill={square.TileBaseBoxShadow || '#FFFFFF'}
                />
                <Rect
                  x={x + OUTER_BAND + RIM_BAND}
                  y={y + OUTER_BAND + RIM_BAND}
                  width={CELL - (OUTER_BAND + RIM_BAND) * 2}
                  height={CELL - (OUTER_BAND + RIM_BAND) * 2}
                  rx={6}
                  fill={face}
                />
              </G>
            );
          })}
      </>
    );

    /* Icon: `<Image>` của React Native, KHÔNG nằm trong SVG - xem đầu file. */
    const margin = (CELL * (1 - ICON_RATIO)) / 2;
    const icons = cells.flatMap(({ square, x, y }) =>
      square.Background
        ? [
            {
              key: `icon-${square.StepNumber}`,
              uri: assetUrl(square.Background),
              style: {
                position: 'absolute' as const,
                left: `${((x + margin) / vw) * 100}%` as const,
                top: `${((y + margin) / vh) * 100}%` as const,
                width: `${((CELL * ICON_RATIO) / vw) * 100}%` as const,
                height: `${((CELL * ICON_RATIO) / vh) * 100}%` as const,
              },
            },
          ]
        : [],
    );

    return { viewBox, vw, vh, centres, defs, tiles, icons };
  }, [board]);

  if (!layers) return <UnsupportedBoard />;

  /*
   * Ô phải VUÔNG, nên kích thước đi từ cạnh ô rồi mới ra khung - không phải
   * ngược lại. Làm tròn XUỐNG số nguyên dp để lần đo lại sau đó cho đúng cùng
   * một kết quả; để số lẻ thì khung và phép đo đuổi nhau thêm một, hai vòng
   * render.
   */
  const cell = box
    ? Math.floor(
        Math.min(
          box.width / (layers.vw / CELL),
          box.height > 1 ? box.height / (layers.vh / CELL) : Number.POSITIVE_INFINITY,
        ),
      )
    : 0;

  const width = (cell * layers.vw) / CELL;
  const height = (cell * layers.vh) / CELL;

  return (
    <View style={styles.fit} onLayout={onLayout}>
      {cell > 0 ? (
        <View style={styles.glow}>
          <View style={[styles.frame, styles.rectFrame, { width, height }]}>
            {/* Lớp 1: ô màu + khối 3D. Chỉ hình khối, không ảnh. */}
            <Svg style={styles.overlay} width="100%" height="100%" viewBox={layers.viewBox}>
              {layers.defs}
              {layers.tiles}
            </Svg>

            {/* Lớp 2: icon từng ô. */}
            {layers.icons.map((icon) => (
              <Image
                key={icon.key}
                source={{ uri: icon.uri }}
                style={icon.style}
                resizeMode="contain"
              />
            ))}

          </View>

          {/*
            Lớp 3: nhân vật.

            ⚠️ Nằm NGOÀI `frame` - xem ghi chú ở `OvalBoard`: `overflow: 'hidden'`
            của khung sẽ cắt mất đầu con nào đứng ở hàng trên.

            Ô vuông cạnh 100 nên nhân vật 120 đơn vị cao hơn ô một chút, cùng
            tỉ lệ với bàn oval.
          */}
          <View pointerEvents="none" style={[styles.charLayer, { width, height }]}>
            <Characters
              players={players}
              currentTurnPlayerId={currentTurnPlayerId}
              characterInfo={characterInfo}
              centres={layers.centres}
              /* viewBox của bàn rectangle luôn bắt đầu ở `0 0`. */
              vx={0}
              vy={0}
              vw={layers.vw}
              frameWidth={width}
              charHeight={120}
              demoFrom={demoJump ? 0 : null}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ── loại bàn chưa hỗ trợ ─────────────────────────────────────────────────── */

/**
 * Thay cho `return null`.
 *
 * ⚠️ Bàn cờ trắng trơn, không lỗi, không log là triệu chứng cực dễ đi tìm nhầm
 * sang mạng hoặc dữ liệu - đã mất một vòng debug vì đúng chuyện đó khi bàn
 * `rectangle` chưa có nhánh vẽ. Giữ thông báo này kể cả khi mọi loại bàn trong
 * DB đều đã vẽ được.
 */
function UnsupportedBoard() {
  const t = useT();

  return (
    <View style={styles.glow}>
      <View style={[styles.frame, styles.unsupportedFrame]}>
        <Text style={styles.unsupportedText}>{t('game.boardUnsupported')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * Quầng sáng mảnh cho bàn cờ tách hẳn khỏi nền.
   *
   * ⚠️ Phải là lớp RIÊNG bọc ngoài `frame`, không gộp vào `frame` được:
   * `frame` có `overflow: 'hidden'` và nó cắt luôn `boxShadow` của chính nó.
   */
  glow: {
    borderRadius: 16,
    boxShadow: '0 0 14px rgba(120,170,255,0.35), 0 0 34px rgba(120,170,255,0.15)',
  },

  frame: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(110,140,210,0.26)',
    position: 'relative',
  },

  /*
   * Khoá theo `aspectRatio` của ViewBox, KHÔNG đặt chiều cao cứng.
   *
   * Polygon nằm trong hệ toạ độ của ViewBox, nên chỉ cần khung bị méo tỉ lệ là
   * quân cờ rơi sang ô khác. Thà bàn cờ thấp hơn ô chứa nó còn hơn lệch ô.
   */
  /* Khung bàn oval nhận width/height tính sẵn - xem `OvalBoard`. */
  ovalFrame: { backgroundColor: '#07160D' },

  /* Khung của bàn rectangle nhận width/height tính sẵn - xem `RectangleBoard`. */
  rectFrame: { backgroundColor: '#070B1C' },

  /*
   * Ô đo chỗ trống, dùng cho CẢ HAI loại bàn.
   *
   * `flexGrow` + `flexShrink` để nó lấy hết chiều cao khi khung cha CÓ chiều
   * cao xác định (màn ngang), và co lại theo nội dung khi không (ScrollView).
   */
  fit: { width: '100%', flexGrow: 1, flexShrink: 1, alignItems: 'center', justifyContent: 'center' },

  unsupportedFrame: {
    width: '100%',
    aspectRatio: 2,
    backgroundColor: '#0A0E22',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  unsupportedText: {
    color: 'rgba(198,212,240,0.72)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },

  /*
   * Lớp nhân vật: phủ đúng lên khung bàn cờ nhưng KHÔNG nằm trong nó.
   *
   * ⚠️ `overflow: 'visible'` là điểm chính. Nhân vật cao hơn ô, nên con đứng ở
   * hàng trên nhô lên khỏi mép bàn cờ - nằm trong `frame` (có
   * `overflow: 'hidden'`) là bị cắt mất đầu.
   */
  charLayer: { position: 'absolute', left: 0, top: 0, overflow: 'visible' },

  /* Hai khung mắt mở / mắt nhắm chồng khít lên nhau. */
  charFrame: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },

  background: { position: 'absolute' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
