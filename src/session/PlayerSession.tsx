import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Ghế của MÁY NÀY trong một ván, và id máy dùng để xin ghế.
 *
 * Vì sao tách khỏi [LicenseSession]: hai thứ hoàn toàn khác nhau.
 * `LicenseSession` là THIẾT BỊ GIỮ LICENSE - chỉ máy của người tổ chức mới có,
 * và token của nó là loại "authcode". Còn đây là GHẾ TRONG VÁN - ai cũng có,
 * kể cả người chỉ gõ mã phòng rồi chơi, và token là loại "player".
 *
 * Người tạo phòng có CẢ HAI: license để mở phòng, cộng một ghế lấy qua
 * `/public/game/{id}/host-seat`. Nên kho này dùng chung cho cả hai đường vào,
 * đừng nhân đôi nó ra thành "ghế của host" và "ghế của khách".
 *
 * Lưu trong SecureStore như license, vì token người chơi cũng là JWT.
 */

const KEY = 'cyclic.player.session';

export type PlayerSeat = {
  gameId: string;
  /** Giữ lại để hiện trên màn chờ và để vào lại phòng cũ. */
  roomCode: string | null;
  playerId: string;
  /** JWT loại "player". Đây là thứ gọi được /public/submitNickname. */
  token: string;
  /** Có giá trị sau khi đã nhận ghế xong. Rỗng = còn nợ bước nhập tên. */
  nickname?: string | null;
  characterId?: string | null;
};

type Stored = {
  /**
   * Id máy, sinh MỘT LẦN rồi giữ mãi.
   *
   * Đây là thứ duy nhất giúp server nhận ra "vẫn là máy này" khi vào lại phòng
   * sau lúc rớt mạng - luồng web dùng cookie cho đúng việc này, app không có
   * cookie jar nên phải tự mang theo.
   *
   * KHÔNG dùng `deviceId` của license: người vào phòng bằng mã thì không có
   * license nào cả.
   */
  deviceId: string;
  seat: PlayerSeat | null;
};

export type PlayerState =
  /** Chưa đọc xong SecureStore */
  | { status: 'loading' }
  | { status: 'ready'; deviceId: string; seat: PlayerSeat | null };

type PlayerContextValue = PlayerState & {
  saveSeat: (seat: PlayerSeat) => Promise<void>;
  clearSeat: () => Promise<void>;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

/**
 * Id ngẫu nhiên dạng UUID v4.
 *
 * Tự viết chứ không cài `expo-crypto` hay `uuid`: cả hai đều là module native
 * hoặc kéo thêm phụ thuộc, mà thêm native module thì phải prebuild + build lại
 * APK (xem SETUP_NOTES.md). Giá trị này KHÔNG phải bí mật - nó chỉ để nhận ra
 * cùng một máy; thứ có thẩm quyền là token server cấp.
 */
function makeDeviceId(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.floor(Math.random() * 4) + 8)];
    else out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlayerState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;

    (async () => {
      let stored: Stored | null = null;
      try {
        const raw = await SecureStore.getItemAsync(KEY);
        if (raw) stored = JSON.parse(raw) as Stored;
      } catch {
        // Đọc hỏng thì coi như máy mới. Mất ghế cũ còn hơn kẹt ở màn loading.
      }

      if (!alive) return;

      if (stored?.deviceId) {
        setState({ status: 'ready', deviceId: stored.deviceId, seat: stored.seat ?? null });
        return;
      }

      const deviceId = makeDeviceId();
      await write({ deviceId, seat: null });
      if (alive) setState({ status: 'ready', deviceId, seat: null });
    })();

    return () => {
      alive = false;
    };
  }, []);

  const saveSeat = useCallback(
    async (seat: PlayerSeat) => {
      if (state.status !== 'ready') return;
      await write({ deviceId: state.deviceId, seat });
      setState({ status: 'ready', deviceId: state.deviceId, seat });
    },
    [state],
  );

  const clearSeat = useCallback(async () => {
    if (state.status !== 'ready') return;
    await write({ deviceId: state.deviceId, seat: null });
    setState({ status: 'ready', deviceId: state.deviceId, seat: null });
  }, [state]);

  const value = useMemo<PlayerContextValue>(
    () => ({ ...state, saveSeat, clearSeat }),
    [state, saveSeat, clearSeat],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

async function write(stored: Stored) {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(stored));
  } catch {
    // Ghi hỏng thì phiên chỉ sống trong bộ nhớ. Vẫn chơi được hết ván này,
    // chỉ mất đường vào lại nếu app bị tắt.
  }
}

export function usePlayer(): PlayerContextValue {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('usePlayer phải nằm trong <PlayerProvider>');
  return value;
}
