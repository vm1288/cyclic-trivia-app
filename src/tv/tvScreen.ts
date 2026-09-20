import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * BÀN CỜ CHÍNH TRÊN TV = MÀN HÌNH PHỤ CỦA PHONE CHỦ PHÒNG (K118, Tony chốt 2026-09-20).
 *
 * Không còn bản web, không Cast receiver: phone chủ phòng vẽ bàn cờ vào một **secondary display**
 * (Android `Presentation` / iOS external `UIScreen`) qua `react-native-external-display`, và hệ điều
 * hành mirror nó lên TV (Android "Cast screen" / Samsung Smart View / iPhone AirPlay). Màn phone
 * vẫn là tay cầm riêng - TV chỉ thấy những gì `TvBoardView` vẽ.
 *
 * ⚠️ Native module: build dev-client mới sau khi thêm lib (`scripts/build-apk.ps1`). Bản APK cũ
 * không có module → `require` ném ngay lúc nạp (lib gọi `getInitialScreens()` ở top-level), nên
 * bọc try/catch: không có module thì app chạy như thường, chỉ không có TV.
 */

type Screen = { id: string; width: number; height: number; mirrored?: boolean };
type ScreenInfo = Record<string, Screen>;

type Lib = {
  default: ComponentType<{
    screen?: string;
    fallbackInMainScreen?: boolean;
    mainScreenStyle?: StyleProp<ViewStyle>;
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
  }>;
  getScreens: () => ScreenInfo;
  useExternalDisplay: (opts?: {
    onScreenConnect?: (s: ScreenInfo) => void;
    onScreenChange?: (s: ScreenInfo) => void;
    onScreenDisconnect?: (s: ScreenInfo) => void;
  }) => ScreenInfo;
};

let lib: Lib | null = null;
let libError = '';
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  lib = require('react-native-external-display') as Lib;
} catch (e) {
  lib = null;
  libError = e instanceof Error ? e.message : String(e);
  console.warn('[tv] react-native-external-display không có trong bản build này:', libError);
}

/** Có native module không (bản build đã kèm lib). */
export const tvAvailable = () => lib !== null;

/**
 * Component gắn con vào màn hình phụ; `null` khi bản build không có module.
 *
 * ⚠️ KHÔNG dùng `lib.default`: wrapper JS của lib chỉ tạo view native khi id nằm trong bảng
 * `getScreens()` của nó - bảng đó chỉ được cập nhật qua sự kiện, mà sự kiện chỉ đăng ký khi đã có
 * view → trả `null` mãi (đo A17 14:51 20/9: màn phụ vẫn là gương của phone). Dùng thẳng component
 * native (codegen `RNExternalDisplay`) với `screen` = id ta tự đọc ở `readNative`; style phải là
 * kích thước màn phụ (dp) vì view này không có bố cục cha.
 */
type NativeView = ComponentType<{ screen?: string; fallbackInMainScreen?: boolean; style?: StyleProp<ViewStyle>; children?: ReactNode }>;
let nativeView: NativeView | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const n = require('react-native-external-display/js/NativeRNExternalDisplay');
  nativeView = (n?.default ?? n) as NativeView;
} catch (e) {
  console.warn('[tv] NativeRNExternalDisplay không nạp được:', e instanceof Error ? e.message : String(e));
  nativeView = null;
}
export const ExternalDisplay: NativeView | null = lib ? nativeView : null;

const first = (info: ScreenInfo | null | undefined): Screen | null => {
  if (!info) return null;
  const ids = Object.keys(info);
  if (ids.length === 0) return null;
  const s = info[ids[0]];
  return s && s.width > 0 && s.height > 0 ? { ...s, id: String(s.id ?? ids[0]) } : null;
};

/**
 * Đọc thẳng native module - KHÔNG qua `getScreens()` của lib.
 *
 * ⚠️ Lib chỉ đăng ký `DisplayListener` khi một view `<ExternalDisplay>` đã được tạo, mà view đó
 * chỉ tạo khi đã có màn phụ → không bao giờ nhận sự kiện "vừa nối" (đo A17 14:47 20/9: bật
 * "Simulate secondary displays" mà hộp Go big! vẫn "Waiting for a screen…"). Native
 * `getInitialScreens()` liệt kê display `FLAG_PRESENTATION` ngay lúc gọi, rẻ, nên hỏi nó theo nhịp.
 * Kích thước px chia cho `scale` của cửa sổ chính - đúng quy ước dp của RN (Yoga dùng density
 * của màn chính cho mọi view, kể cả view trên Presentation).
 */
const readNative = (): Screen | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TurboModuleRegistry, Dimensions, Platform } = require('react-native') as typeof import('react-native');
    type Mod = { getInitialScreens?: () => { SCREEN_INFO?: ScreenInfo }; SCREEN_INFO?: ScreenInfo };
    const mod = TurboModuleRegistry.get('RNExternalDisplayEvent') as unknown as Mod | null;
    if (!mod) return null;
    const raw = Platform.OS === 'android' ? mod.getInitialScreens?.()?.SCREEN_INFO : mod.SCREEN_INFO;
    if (!raw) return null;
    const scale = Platform.OS === 'ios' ? 1 : Dimensions.get('window').scale || 1;
    const info: ScreenInfo = {};
    for (const [id, sc] of Object.entries(raw)) {
      info[id] = { ...sc, id: String(sc.id ?? id), width: sc.width / scale, height: sc.height / scale };
    }
    return first(info);
  } catch {
    return null;
  }
};

/**
 * Màn hình phụ đầu tiên đang nối (id + kích thước dp), `null` khi chưa có / bản build không có
 * module. Hỏi native mỗi 2 s (xem `readNative`).
 */
export function useTvScreen(): Screen | null {
  const [screen, setScreen] = useState<Screen | null>(() => (lib ? readNative() : null));

  useEffect(() => {
    if (!lib) return;
    let alive = true;
    const refresh = () => {
      if (!alive) return;
      const s = readNative();
      setScreen((prev) => (prev?.id === s?.id && prev?.width === s?.width && prev?.height === s?.height ? prev : s));
    };
    const timer = setInterval(refresh, 2000);
    refresh();
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return screen;
}
