import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { clearSponsorLogos } from './sponsorLogo';

/**
 * Phiên license của MÁY NÀY.
 *
 * Lưu trong SecureStore (Keystore của Android) chứ không phải AsyncStorage: ở
 * đây có JWT và mã license đã mua - AsyncStorage là file thường, máy đã root
 * hoặc bản backup đọc được hết.
 *
 * Gói tất cả vào MỘT khoá dưới dạng JSON thay vì mỗi trường một khoá: các
 * trường này chỉ có ý nghĩa khi đi cùng nhau (token gắn với deviceId gắn với
 * hostId), tách ra thì có lúc ghi được nửa chừng rồi hỏng, để lại phiên nửa vời.
 */

const KEY = 'cyclic.license.session';

export type LicenseSession = {
  token: string;
  /** Do server sinh - xem ghi chú trong api/activation.ts */
  deviceId: string;
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
   *
   * Có thể null: license cũ lưu trước khi có trường này, hoặc server không tra
   * được sponsor. Lúc đó rơi về ngôn ngữ của máy.
   */
  languageCode?: string | null;
  /**
   * Đường dẫn file logo sponsor ĐÃ TẢI VỀ MÁY (file:// ...), không phải URL trên
   * server. Xem `sponsorLogo.ts` để biết vì sao tải về.
   *
   * null = chưa tải được hoặc sponsor không có logo → dùng logo Cyclic mặc định.
   */
  sponsorLogoUri?: string | null;
  /**
   * Ván mà máy này vừa tạo và chưa rời khỏi.
   *
   * VÌ SAO LƯU Ở CLIENT: server có `Hosts.CurrentGameSessionId` nhưng nó **chỉ
   * được ghi, không bao giờ được xoá** - hỏi server thì ván đã kết thúc từ lâu
   * vẫn trả về như đang mở. Nên client giữ id, rồi mỗi lần mở màn hình chính
   * hỏi `/api/game/{id}/state` để xác nhận ván còn sống; hết ván thì xoá đi.
   *
   * Nằm chung khoá với phần license vì cùng là trạng thái của MÁY này, và ghi
   * chung một lần thì không có cảnh ghi được nửa chừng.
   */
  currentGameId?: string | null;
};

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
  save: (session: LicenseSession) => Promise<void>;
  markActivated: () => Promise<void>;
  clear: () => Promise<void>;
  /** Ghi/xoá ván đang mở. Truyền null khi ván kết thúc hoặc bị bỏ. */
  setCurrentGame: (gameId: string | null) => void;
};

const LicenseContext = createContext<LicenseContextValue | null>(null);

function toState(session: LicenseSession | null): LicenseState {
  if (!session) return { status: 'none' };
  return session.activated ? { status: 'active', session } : { status: 'pending', session };
}

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LicenseState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(KEY);
        const parsed = raw ? (JSON.parse(raw) as LicenseSession) : null;
        // Dữ liệu hỏng (đổi cấu trúc, ghi dở) thì coi như chưa có, đừng để app
        // chết ở màn hình đầu tiên.
        const valid = parsed && parsed.token && parsed.deviceId ? parsed : null;
        if (alive) setState(toState(valid));
      } catch {
        if (alive) setState({ status: 'none' });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback(async (session: LicenseSession) => {
    await SecureStore.setItemAsync(KEY, JSON.stringify(session));
    setState(toState(session));
  }, []);

  const markActivated = useCallback(async () => {
    setState((current) => {
      if (current.status !== 'pending') return current;
      const next = { ...current.session, activated: true };
      // Ghi xuống đĩa là việc phụ, không chặn UI; state đã đúng ngay lập tức.
      void SecureStore.setItemAsync(KEY, JSON.stringify(next));
      return { status: 'active', session: next };
    });
  }, []);

  const clear = useCallback(async () => {
    await SecureStore.deleteItemAsync(KEY);
    // Xoá luôn logo đã tải: license mới có thể thuộc sponsor khác, để lại logo
    // cũ thì màn hình chính hiện sai thương hiệu.
    await clearSponsorLogos();
    setState({ status: 'none' });
  }, []);

  const setCurrentGame = useCallback((gameId: string | null) => {
    setState((current) => {
      if (current.status !== 'active' && current.status !== 'pending') return current;
      if (current.session.currentGameId === gameId) return current;

      const next = { ...current.session, currentGameId: gameId };
      // Ghi xuống đĩa là việc phụ, không chặn UI.
      void SecureStore.setItemAsync(KEY, JSON.stringify(next));
      return { ...current, session: next };
    });
  }, []);

  const value = useMemo<LicenseContextValue>(
    () => ({ ...state, save, markActivated, clear, setCurrentGame }),
    [state, save, markActivated, clear, setCurrentGame],
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense(): LicenseContextValue {
  const value = useContext(LicenseContext);
  if (!value) throw new Error('useLicense phải nằm trong <LicenseProvider>');
  return value;
}
