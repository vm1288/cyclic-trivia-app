import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  createGuest,
  getMe,
  logoutProfile,
  setAvatar as apiSetAvatar,
  setNickName as apiSetNickName,
  type Profile,
} from '../api/profile';
import { usePlayer } from './PlayerSession';

/**
 * Hồ sơ người chơi của MÁY NÀY (mockup V6, Tony 2/10): một nickname duy nhất dùng xuyên mọi ván
 * và mọi game, để bảng xếp hạng không còn mỗi ván một tên.
 *
 *   - lần đầu mở app: server cấp hồ sơ khách tên ngẫu nhiên ("SwiftTiger27") → `welcome` = true,
 *     Home hiện tấm "Welcome to Cyclic Games!" một lần
 *   - token chết (tài khoản đã đăng nhập máy khác / logout): tự tạo hồ sơ khách mới
 *   - mất mạng: giữ bản đã lưu, thử lại lần mở sau
 *
 * Tách khỏi `LicenseSession` (licence = gói đã mua, gắn máy + tài khoản store) và `PlayerSession`
 * (ghế trong MỘT ván). Cần `PlayerSession` để lấy id máy.
 */

const KEY = 'cyclic.profile.session';

type Stored = { token: string; profile: Profile; welcomed?: boolean };

type ProfileContextValue = {
  /** Null khi chưa tải xong hoặc chưa tạo được (mất mạng lần đầu mở app). */
  profile: Profile | null;
  token: string | null;
  /** Hồ sơ vừa được tạo, chưa chào - Home hiện tấm Welcome. */
  welcome: boolean;
  dismissWelcome: () => void;
  /** Trả null = xong; ngược lại mã lỗi server (`nickname_taken`, `nickname_invalid`…). */
  setNickName: (name: string) => Promise<string | null>;
  setAvatar: (avatarId: string) => Promise<string | null>;
  reload: () => Promise<void>;
  /** Đăng nhập email xong: thay hẳn hồ sơ khách của máy này bằng hồ sơ vừa vào. */
  adopt: (token: string, profile: Profile) => Promise<void>;
  /** Đăng ký email xong: cập nhật hồ sơ (token giữ nguyên). */
  update: (profile: Profile) => Promise<void>;
  /** Logout: token chết trên server, máy nhận hồ sơ khách MỚI (Tony 2/10). */
  logout: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const player = usePlayer();
  const deviceId = player.status === 'ready' ? player.deviceId : null;
  const [stored, setStored] = useState<Stored | null>(null);
  const storedRef = useRef<Stored | null>(null);
  storedRef.current = stored;
  const busy = useRef(false);

  const persist = useCallback(async (next: Stored | null) => {
    setStored(next);
    try {
      if (next) await SecureStore.setItemAsync(KEY, JSON.stringify(next));
      else await SecureStore.deleteItemAsync(KEY);
    } catch {
      /* SecureStore hỏng thì lần sau tạo hồ sơ mới - không làm vỡ app. */
    }
  }, []);

  const freshGuest = useCallback(async () => {
    if (!deviceId) return;
    const r = await createGuest(deviceId);
    if (r.ok) await persist({ token: r.token, profile: r.profile, welcomed: false });
  }, [deviceId, persist]);

  const reload = useCallback(async () => {
    if (!deviceId || busy.current) return;
    busy.current = true;
    try {
      let current = storedRef.current;
      if (!current) {
        const raw = await SecureStore.getItemAsync(KEY).catch(() => null);
        current = raw ? (JSON.parse(raw) as Stored) : null;
        if (current) setStored(current);
      }
      if (!current) {
        await freshGuest();
        return;
      }
      const me = await getMe(current.token);
      if (me.ok) await persist({ ...current, profile: me.profile });
      else if (me.signedOut) await freshGuest();
    } finally {
      busy.current = false;
    }
  }, [deviceId, freshGuest, persist]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile: stored?.profile ?? null,
      token: stored?.token ?? null,
      welcome: !!stored && stored.welcomed === false,
      dismissWelcome: () => {
        if (stored) void persist({ ...stored, welcomed: true });
      },
      setNickName: async (name) => {
        if (!stored) return 'profile_missing';
        const r = await apiSetNickName(stored.token, name);
        if (r.ok) {
          await persist({ ...stored, profile: r.profile });
          return null;
        }
        if (r.signedOut) await freshGuest();
        return r.errorCode ?? (r.network ? 'network' : 'error');
      },
      setAvatar: async (avatarId) => {
        if (!stored) return 'profile_missing';
        const r = await apiSetAvatar(stored.token, avatarId);
        if (r.ok) {
          await persist({ ...stored, profile: r.profile });
          return null;
        }
        if (r.signedOut) await freshGuest();
        return r.errorCode ?? (r.network ? 'network' : 'error');
      },
      reload,
      adopt: async (token, p) => {
        await persist({ token, profile: p, welcomed: true });
      },
      update: async (p) => {
        if (stored) await persist({ ...stored, profile: p });
      },
      logout: async () => {
        if (stored) await logoutProfile(stored.token);
        await persist(null);
        await freshGuest();
      },
    }),
    [stored, persist, freshGuest, reload],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const v = useContext(ProfileContext);
  if (!v) throw new Error('useProfile phải nằm trong <ProfileProvider>');
  return v;
}
