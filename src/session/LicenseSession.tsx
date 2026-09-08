import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { clearSponsorLogos, deleteSponsorLogo } from './sponsorLogo';
import { checkActivationCode } from '../api/activation';
import { setTokenRefresher } from '../api/client';

/**
 * Các license đã kích hoạt trên MÁY NÀY, và license đang dùng.
 *
 * Một máy giữ được NHIỀU license vì mỗi lần kích hoạt tạo một `Host` riêng ở
 * server, có token và deviceId riêng, và `MaxDevices` đếm theo từng license -
 * nên hai license không đụng nhau. Đổi license = đổi sản phẩm: logo, ngôn ngữ
 * mặc định, bàn cờ và bộ câu hỏi đều đổi theo.
 *
 * Lưu trong SecureStore (Keystore của Android) chứ không phải AsyncStorage: ở
 * đây có JWT và mã license đã mua - AsyncStorage là file thường, máy đã root
 * hoặc bản backup đọc được hết.
 *
 * Gói tất cả vào MỘT khoá dưới dạng JSON thay vì mỗi license một khoá: danh
 * sách và con trỏ "đang dùng cái nào" phải luôn khớp nhau, tách ra thì có lúc
 * ghi được nửa chừng rồi hỏng.
 */

const KEY = 'cyclic.license.session';

/**
 * Còn dưới ngần này là làm mới token ngay lúc mở app.
 *
 * 3 ngày, trong khi token sống tối đa 14 - tức là app có tới ba ngày và nhiều
 * lần mở để làm mới thành công. Người dùng đi chơi xa không mạng vài hôm về vẫn
 * còn token dùng được.
 */
const REFRESH_BEFORE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Những `errorCode` nghĩa là license ĐÃ CHẾT - gỡ phiên khỏi máy.
 *
 * ⚠️ Danh sách này phải khớp `PublicController.Activation.cs`. Đừng thêm mã lỗi
 * tạm thời (vd `max_devices`) vào đây: chúng không có nghĩa là license hỏng, và
 * đăng xuất vì chúng là xoá nhầm license của người dùng.
 */
const DEAD_LICENSE_CODES = ['license_not_found', 'license_inactive', 'license_expired'];

export type LicenseSession = {
  token: string;
  /**
   * Thời điểm `token` hết hạn (ISO 8601 UTC), do server trả về.
   *
   * ⚠️ KHÔNG cố định. Server tính `min(License.ExpiredTime + 12h, now + 14 ngày)`
   * nên license gia hạn thì lần refresh sau dài ra. Dùng để refresh CHỦ ĐỘNG -
   * xem `REFRESH_BEFORE_MS`.
   *
   * Thiếu (server bản cũ, hoặc phiên lưu từ bản app trước) thì coi như "không
   * biết" và refresh ngay lần mở app kế tiếp.
   */
  expiresAt?: string | null;
  /** Do server sinh - xem ghi chú trong api/activation.ts */
  deviceId: string;
  /** Khoá chính để phân biệt các license trên máy: mỗi license một host. */
  hostId: string;
  licenseCode: string;
  /**
   * true khi license đã kích hoạt xong (đã gắn email + xác nhận OTP).
   * false = mới qua bước kiểm mã, còn nợ bước nhập tên/email + OTP.
   */
  activated: boolean;
  /**
   * Ngôn ngữ chính của sponsor gắn với license (vd "en-GB"), do server trả về.
   * Đây là ngôn ngữ MẶC ĐỊNH của app - xem I18nProvider.
   */
  languageCode?: string | null;
  /** Tên sponsor (CricTriv, FootieTriv...) để dán nhãn trong danh sách. */
  sponsorName?: string | null;
  /**
   * Đường dẫn file logo sponsor ĐÃ TẢI VỀ MÁY (file:// ...), không phải URL
   * trên server. Xem `sponsorLogo.ts` để biết vì sao tải về.
   */
  sponsorLogoUri?: string | null;
  /**
   * Ván mà license NÀY vừa tạo và chưa rời khỏi.
   *
   * Phải nằm trong từng license, không phải một trường dùng chung: đổi sang
   * license khác mà vẫn thấy RESUME GAME của ván thuộc license cũ thì bấm vào
   * sẽ mở nhầm phòng.
   *
   * Server có `Hosts.CurrentGameSessionId` nhưng nó **chỉ được ghi, không bao
   * giờ được xoá**, nên đây chỉ là con trỏ; trạng thái thật hỏi
   * `/public/host/current-game`.
   */
  currentGameId?: string | null;
};

type Stored = { sessions: LicenseSession[]; activeHostId: string | null };

export type LicenseState =
  /** Chưa đọc xong SecureStore - đừng vẽ gì phụ thuộc vào license lúc này */
  | { status: 'loading' }
  /** Máy này chưa đăng ký license nào */
  | { status: 'none' }
  /** Đã nhập mã hợp lệ nhưng chưa kích hoạt xong */
  | { status: 'pending'; session: LicenseSession }
  /** Kích hoạt hoàn tất */
  | { status: 'active'; session: LicenseSession };

type LicenseContextValue = LicenseState & {
  /** Mọi license trên máy, kể cả cái chưa kích hoạt xong. */
  all: LicenseSession[];
  /** Thêm mới hoặc cập nhật một license, rồi chuyển sang dùng nó. */
  save: (session: LicenseSession) => Promise<void>;
  /** Đổi sang license khác theo hostId. */
  switchTo: (hostId: string) => Promise<void>;
  /** Gỡ một license khỏi máy. */
  remove: (hostId: string) => Promise<void>;
  markActivated: () => Promise<void>;
  /** Ghi/xoá ván đang mở CỦA LICENSE ĐANG DÙNG. */
  setCurrentGame: (gameId: string | null) => void;
  /** Xoá sạch mọi license khỏi máy. */
  clear: () => Promise<void>;
};

const LicenseContext = createContext<LicenseContextValue | null>(null);

/**
 * Đọc dữ liệu đã lưu, chấp nhận cả DẠNG CŨ (một license duy nhất).
 *
 * Bản trước lưu thẳng một object `{token, deviceId, ...}`. Máy đã cài bản đó
 * mà nâng cấp sẽ đọc phải dạng cũ - không chuyển đổi thì người dùng mất
 * license và phải nhập lại mã.
 */
function parseStored(raw: string | null): Stored {
  const empty: Stored = { sessions: [], activeHostId: null };
  if (!raw) return empty;

  try {
    const parsed = JSON.parse(raw) as Partial<Stored> & Partial<LicenseSession>;

    if (Array.isArray(parsed.sessions)) {
      const sessions = parsed.sessions.filter((s) => s?.token && s?.hostId);
      const activeHostId =
        parsed.activeHostId && sessions.some((s) => s.hostId === parsed.activeHostId)
          ? parsed.activeHostId
          : (sessions[0]?.hostId ?? null);
      return { sessions, activeHostId };
    }

    // Dạng cũ: một license nằm thẳng ở gốc.
    if (parsed.token && parsed.deviceId) {
      const legacy = parsed as LicenseSession;
      // Bản cũ chưa chắc có hostId; thiếu thì lấy deviceId làm khoá thay thế
      // để không mất license.
      const hostId = legacy.hostId || legacy.deviceId;
      return { sessions: [{ ...legacy, hostId }], activeHostId: hostId };
    }
  } catch {
    /* dữ liệu hỏng thì coi như chưa có, đừng để app chết ở màn đầu tiên */
  }

  return empty;
}

function toState(store: Stored): LicenseState {
  const active = store.sessions.find((s) => s.hostId === store.activeHostId);
  if (!active) return { status: 'none' };
  return active.activated ? { status: 'active', session: active } : { status: 'pending', session: active };
}

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Stored | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(KEY);
        if (alive) setStore(parseStored(raw));
      } catch {
        if (alive) setStore({ sessions: [], activeHostId: null });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /*
   * Bản sao `store` đọc được từ callback mà không cần đưa nó vào dependency.
   *
   * Cần vì `refreshToken` được lớp API giữ lại lâu dài (`setTokenRefresher`):
   * nếu nó đóng gói (closure) `store` thì sẽ đọc phải bản chụp cũ, và ghi đè
   * mất những thay đổi xảy ra sau đó.
   */
  const storeRef = useRef<Stored | null>(null);
  storeRef.current = store;

  const persist = useCallback((next: Stored) => {
    storeRef.current = next;
    setStore(next);
    // Ghi xuống đĩa là việc phụ, không chặn UI; state đã đúng ngay lập tức.
    void SecureStore.setItemAsync(KEY, JSON.stringify(next));
  }, []);

  const save = useCallback(
    async (session: LicenseSession) => {
      const current = store ?? { sessions: [], activeHostId: null };
      // Kích hoạt lại cùng một license thì THAY THẾ chứ không thêm bản trùng.
      const others = current.sessions.filter((s) => s.hostId !== session.hostId);
      persist({ sessions: [...others, session], activeHostId: session.hostId });
    },
    [store, persist],
  );

  const switchTo = useCallback(
    async (hostId: string) => {
      if (!store || !store.sessions.some((s) => s.hostId === hostId)) return;
      persist({ ...store, activeHostId: hostId });
    },
    [store, persist],
  );

  const remove = useCallback(
    async (hostId: string) => {
      if (!store) return;

      const target = store.sessions.find((s) => s.hostId === hostId);
      if (!target) return;

      const rest = store.sessions.filter((s) => s.hostId !== hostId);

      /*
       * Gỡ license đang dùng thì phải chọn cái khác thay, không để con trỏ trỏ
       * vào chỗ trống - lúc đó `toState` trả 'none' và app tưởng máy chưa đăng
       * ký gì, dù vẫn còn license khác.
       */
      const activeHostId =
        store.activeHostId === hostId ? (rest[0]?.hostId ?? null) : store.activeHostId;

      persist({ sessions: rest, activeHostId });

      // Xoá file logo, nhưng chỉ khi không license nào còn dùng nó: hai license
      // cùng sponsor dùng chung một file.
      await deleteSponsorLogo(
        target.sponsorLogoUri,
        rest.map((s) => s.sponsorLogoUri),
      );
    },
    [store, persist],
  );

  const markActivated = useCallback(async () => {
    if (!store) return;
    persist({
      ...store,
      sessions: store.sessions.map((s) =>
        s.hostId === store.activeHostId ? { ...s, activated: true } : s,
      ),
    });
  }, [store, persist]);

  const setCurrentGame = useCallback(
    (gameId: string | null) => {
      if (!store) return;
      const active = store.sessions.find((s) => s.hostId === store.activeHostId);
      if (!active || active.currentGameId === gameId) return;

      persist({
        ...store,
        sessions: store.sessions.map((s) =>
          s.hostId === store.activeHostId ? { ...s, currentGameId: gameId } : s,
        ),
      });
    },
    [store, persist],
  );

  const clear = useCallback(async () => {
    await SecureStore.deleteItemAsync(KEY);
    // Xoá luôn logo đã tải: license mới có thể thuộc sponsor khác, để lại logo
    // cũ thì màn hình chính hiện sai thương hiệu.
    await clearSponsorLogos();
    setStore({ sessions: [], activeHostId: null });
  }, []);

  /*
   * ─── Làm mới token ────────────────────────────────────────────────────────
   *
   * Token license sống tối đa 14 ngày (server cắt theo hạn license, xem
   * `AuthHelper.LicenseTokenExpiry`). Hết hạn mà không làm mới thì MỌI lời gọi
   * cần token đều 401 và app không có đường nào tự gỡ - đúng lỗi đã gặp
   * 2026-09-08.
   *
   * Đường làm mới chính là `checkActivationCode` với `deviceId` đã lưu: server
   * thấy host cũ thì cấp token mới cho đúng host đó, không tốn thêm suất
   * `MaxDevices` nào, và tính lại hạn theo `License.ExpiredTime` hiện tại - nên
   * gia hạn gói là token sau tự dài ra.
   */
  const refreshToken = useCallback(
    async (hostId: string): Promise<string | null> => {
      const current = storeRef.current;
      const target = current?.sessions.find((s) => s.hostId === hostId);
      if (!target) return null;

      const result = await checkActivationCode(target.licenseCode, target.deviceId);

      if (result.isSuccess) {
        const next: Stored = {
          ...current!,
          sessions: current!.sessions.map((s) =>
            s.hostId === hostId
              ? {
                  ...s,
                  token: result.data,
                  expiresAt: result.expiresAt ?? null,
                  activated: result.isActivated,
                }
              : s,
          ),
        };
        persist(next);
        return result.data;
      }

      /*
       * ⚠️ CHỈ đăng xuất khi server PHÁN QUYẾT RÕ RÀNG.
       *
       * `kind === 'rejected'` nghĩa là server đã trả lời và từ chối. Mất mạng
       * hay timeout thì `kind` là 'network'/'timeout' - lúc đó giữ nguyên token,
       * vì xoá license của người dùng chỉ vì họ đi qua chỗ mất sóng là hỏng.
       */
      if (result.kind === 'rejected' && result.errorCode && DEAD_LICENSE_CODES.includes(result.errorCode)) {
        await remove(hostId);
      }

      return null;
    },
    [persist, remove],
  );

  /*
   * Cho lớp API đổi token khi ăn 401 giữa chừng.
   *
   * Nhận `staleToken` chứ không nhận hostId: lúc 401 xảy ra, lớp API chỉ biết
   * cái token nó vừa gửi. Tra ngược ra phiên nào đang giữ token đó.
   */
  useEffect(() => {
    setTokenRefresher(async (staleToken) => {
      const owner = storeRef.current?.sessions.find((s) => s.token === staleToken);
      if (!owner) return null;
      return refreshToken(owner.hostId);
    });
    return () => setTokenRefresher(null);
  }, [refreshToken]);

  /*
   * Làm mới CHỦ ĐỘNG lúc mở app, khi token sắp hết hoặc không rõ hạn.
   *
   * Chạy trước để người dùng không bao giờ ăn 401 giữa ván - lưới an toàn ở
   * `client.ts` chỉ để đỡ những trường hợp lọt lưới này.
   */
  useEffect(() => {
    const active = store?.sessions.find((s) => s.hostId === store.activeHostId);
    if (!active) return;

    const due =
      !active.expiresAt ||
      Number.isNaN(Date.parse(active.expiresAt)) ||
      Date.parse(active.expiresAt) - Date.now() < REFRESH_BEFORE_MS;

    if (due) void refreshToken(active.hostId);
    // Chỉ theo dõi phiên ĐANG DÙNG: đổi license thì kiểm lại, còn `store` đổi vì
    // lý do khác (ghi currentGameId chẳng hạn) thì không gọi lại server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.activeHostId, store?.sessions.find((s) => s.hostId === store?.activeHostId)?.expiresAt]);

  const value = useMemo<LicenseContextValue>(() => {
    const state: LicenseState = store === null ? { status: 'loading' } : toState(store);
    return {
      ...state,
      all: store?.sessions ?? [],
      save,
      switchTo,
      remove,
      markActivated,
      setCurrentGame,
      clear,
    };
  }, [store, save, switchTo, remove, markActivated, setCurrentGame, clear]);

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense(): LicenseContextValue {
  const value = useContext(LicenseContext);
  if (!value) throw new Error('useLicense phải nằm trong <LicenseProvider>');
  return value;
}
