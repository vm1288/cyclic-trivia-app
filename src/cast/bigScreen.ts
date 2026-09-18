import { useEffect, useState } from 'react';

/**
 * "Play on the Big screen" (K107, Tony 18/9): quét thiết bị Google Cast trong mạng, gửi cho
 * nó link `/cast/{ticket}` của server; receiver tuỳ chỉnh (`wwwroot/cast-receiver.html`
 * bên server) nạp link đó vào iframe → bàn cờ web chạy trên TV, điện thoại vẫn là ghế.
 *
 * VÌ SAO GOOGLE CAST: Chromecast / Android TV / TV có Cast là thứ duy nhất phổ biến nhận
 * được "mở URL này" từ điện thoại mà không cần cài gì thêm. DLNA chỉ phát media, DIAL chỉ
 * mở app có sẵn (YouTube, Netflix). PC / tablet không nhận cast - hộp "Go big!" có thêm
 * đường SHARE LINK cho họ.
 *
 * ⚠️ Cần một RECEIVER APP ID đăng ký ở https://cast.google.com/publish (Custom Receiver,
 * URL `https://<server>/cast-receiver.html`), dán vào `app.json` → plugin
 * `react-native-google-cast` → `receiverAppId`, rồi build lại APK (native). Chưa có ID thật
 * thì danh sách quét CÓ THỂ trống dù TV đang bật (thiết bị chỉ báo về khi nhận app đó).
 *
 * Native module nạp LƯỜI qua `require` trong try/catch: APK cũ (chưa có module) mở màn
 * lobby vẫn không vỡ - chỉ thấy "không quét được".
 */
export const BIG_SCREEN_NAMESPACE = 'urn:x-cast:com.cyclictrivia.board';

export type BigScreenDevice = { deviceId: string; friendlyName: string; modelName: string };

type CastLib = typeof import('react-native-google-cast');

let lib: CastLib | null | undefined;
function cast(): CastLib | null {
  if (lib !== undefined) return lib;
  try {
    lib = require('react-native-google-cast') as CastLib;
  } catch (e) {
    console.warn('[bigScreen] react-native-google-cast not available', e);
    lib = null;
  }
  return lib;
}

/** Native module có trong APK này không. */
export function bigScreenAvailable(): boolean {
  return cast() !== null;
}

/** Danh sách thiết bị Cast đang thấy trong mạng - tự cập nhật khi TV bật/tắt. */
export function useBigScreenDevices(active: boolean): { devices: BigScreenDevice[]; available: boolean } {
  const [devices, setDevices] = useState<BigScreenDevice[]>([]);
  const available = bigScreenAvailable();

  useEffect(() => {
    const c = cast();
    if (!active || !c) return;
    const dm = c.CastContext.getDiscoveryManager();
    let alive = true;
    const push = (list: { deviceId: string; friendlyName: string; modelName: string }[]) => {
      if (!alive) return;
      setDevices(list.map((d) => ({ deviceId: d.deviceId, friendlyName: d.friendlyName, modelName: d.modelName })));
    };
    void dm.startDiscovery().catch(() => {});
    void dm.getDevices().then(push).catch(() => {});
    const sub = dm.onDevicesUpdated(push);
    return () => {
      alive = false;
      sub.remove();
      void dm.stopDiscovery().catch(() => {});
    };
  }, [active]);

  return { devices, available };
}

/**
 * Nối với thiết bị rồi gửi link bàn cờ. Trả về lỗi dạng chữ (đã là câu người đọc được)
 * hoặc null khi xong.
 *
 * `startSession` chỉ hứa "đang nối"; phiên thật sự sẵn sàng ở `onSessionStarted`. Chờ tối
 * đa 20 s - TV lạnh mở receiver mất ~5-10 s.
 */
export async function sendToBigScreen(deviceId: string, url: string): Promise<string | null> {
  const c = cast();
  if (!c) return 'Casting is not available in this build.';
  const sm = c.CastContext.getSessionManager();

  // Phiên cũ (TV khác, hay lần cast trước) thì dứt trước - một bàn cờ một TV.
  const current = await sm.getCurrentCastSession().catch(() => null);
  if (current) await sm.endCurrentSession(true).catch(() => {});

  const session = await new Promise<InstanceType<CastLib['CastSession']> | null>((resolve) => {
    let done = false;
    const finish = (s: InstanceType<CastLib['CastSession']> | null) => {
      if (done) return;
      done = true;
      started.remove();
      failed.remove();
      clearTimeout(timer);
      resolve(s);
    };
    const started = sm.onSessionStarted((s) => finish(s));
    const failed = sm.onSessionStartFailed(() => finish(null));
    const timer = setTimeout(() => finish(null), 20000);
    sm.startSession(deviceId).then((ok) => {
      if (!ok) finish(null);
    }, () => finish(null));
  });
  if (!session) return 'Could not connect to that device.';

  try {
    const channel = await session.addChannel(BIG_SCREEN_NAMESPACE);
    await channel.sendMessage({ url });
    return null;
  } catch (e) {
    console.warn('[bigScreen] send failed', e);
    return 'Connected, but the board link could not be sent.';
  }
}
