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

/** Component gắn con vào màn hình phụ; `null` khi bản build không có module. */
export const ExternalDisplay = lib?.default ?? null;

const first = (info: ScreenInfo | null | undefined): Screen | null => {
  if (!info) return null;
  const ids = Object.keys(info);
  if (ids.length === 0) return null;
  const s = info[ids[0]];
  return s && s.width > 0 && s.height > 0 ? { ...s, id: String(s.id ?? ids[0]) } : null;
};

/**
 * Màn hình phụ đầu tiên đang nối (id + kích thước dp), `null` khi chưa có / bản build không có
 * module. Cập nhật theo sự kiện nối / đổi / rút.
 */
export function useTvScreen(): Screen | null {
  const [screen, setScreen] = useState<Screen | null>(() => {
    try {
      return first(lib?.getScreens());
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!lib) return;
    /*
     * `useExternalDisplay` là hook của lib - không gọi có điều kiện được, nên tự đăng ký sự kiện
     * qua chính hook đó trong một component con là rườm rà; đơn giản hơn: đọc lại `getScreens()`
     * mỗi 2 s và khi có sự kiện của lib (DeviceEventEmitter, tên cố định).
     */
    let alive = true;
    const refresh = () => {
      if (!alive) return;
      try {
        const s = first(lib?.getScreens());
        setScreen((prev) => (prev?.id === s?.id && prev?.width === s?.width && prev?.height === s?.height ? prev : s));
      } catch {
        /* bỏ qua */
      }
    };
    const timer = setInterval(refresh, 2000);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DeviceEventEmitter } = require('react-native') as typeof import('react-native');
    const subs = ['@RNExternalDisplay_screenDidConnect', '@RNExternalDisplay_screenDidChange', '@RNExternalDisplay_screenDidDisconnect'].map(
      (name) => DeviceEventEmitter.addListener(name, () => setTimeout(refresh, 50)),
    );
    refresh();
    return () => {
      alive = false;
      clearInterval(timer);
      subs.forEach((s) => s.remove());
    };
  }, []);

  return screen;
}
