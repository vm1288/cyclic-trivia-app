import { postJson, type ApiResult } from './client';
import { API_BASE_URL, API_TIMEOUT_MS } from './config';

/**
 * Vào phòng bằng mã, và nhận ghế.
 *
 * Đây là đường vào ván dành cho người KHÔNG có license - họ chỉ có mã phòng ai
 * đó đọc cho, hoặc gửi qua nút INVITE. Người tạo phòng đi đường khác:
 * `/public/game/{id}/host-seat` trong `api/game.ts`.
 */

/** Mã phòng: 6 ký tự, bảng chữ đã bỏ 0/O và 1/I/L vì hay đọc nhầm. */
export const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_ALPHABET = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/;

/**
 * Chuẩn hoá đúng như `RoomCodeService.Normalise` ở server: hoa hết, bỏ khoảng
 * trắng và gạch nối mà người ta hay chèn khi chép lại.
 */
export function normaliseRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isRoomCodeShaped(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && ROOM_CODE_ALPHABET.test(code);
}

/**
 * Tra mã phòng. KHÔNG cần token.
 *
 * ⚠️ Endpoint này trả `IsSuccess` viết HOA chữ đầu (nó là `ControllerBase` với
 * object ẩn danh), khác `isSuccess` thường của các route dưới `/public`. Đừng
 * đưa nó qua `postJson` - lớp đó chỉ hiểu chữ thường.
 */
export type RoomLookup = {
  RoomCode: string;
  SessionId: string;
  GameId: string | null;
  /**
   * false = phòng đã mở nhưng chủ phòng chưa chọn thời lượng/số người, nên
   * chưa có ghế nào tồn tại. Bảo người dùng đợi, đừng báo sai mã.
   */
  IsGameCreated: boolean;
  NumberOfPlayers: number | null;
  IsGameOver: boolean;
};

export async function resolveRoom(code: string): Promise<ApiResult<RoomLookup>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/api/room/${encodeURIComponent(code)}`, {
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => null)) as
      | ({ IsSuccess?: boolean; ErrorMessage?: string } & RoomLookup)
      | null;

    if (!response.ok || !body?.IsSuccess) {
      return {
        isSuccess: false,
        kind: 'rejected',
        message: body?.ErrorMessage,
        messageKey: body?.ErrorMessage ? undefined : 'join.notFound',
      };
    }

    return { ...(body as RoomLookup), isSuccess: true };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      isSuccess: false,
      kind: aborted ? 'timeout' : 'network',
      messageKey: aborted ? 'error.timeout' : 'error.network',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Nhận một ghế trống trong phòng, và lấy token người chơi.
 *
 * Gọi lại với CÙNG `deviceId` sẽ trả về đúng ghế cũ chứ không ăn thêm ghế -
 * đó là đường vào lại sau khi rớt mạng hoặc tắt app. Vì vậy `deviceId` phải là
 * giá trị bền, lấy từ `usePlayer()`, đừng sinh mới mỗi lần gọi.
 *
 * `IsClaimed: true` = ghế này đã đặt nickname xong rồi (máy này vào lại), app
 * nên đi thẳng vào phòng chờ thay vì hỏi lại tên.
 *
 * Các `errorCode` cần phân biệt:
 *   - `game_not_created` : phòng có thật, chủ phòng chưa tạo ván. Đợi.
 *   - `game_full`        : hết ghế.
 *   - `game_over`        : ván đã kết thúc.
 */
export type ClaimedSeat = {
  GameId: string;
  RoomCode: string;
  PlayerId: string;
  Token: string;
  IsClaimed: boolean;
  NickName: string | null;
  CharacterId: string | null;
  NumberOfPlayers: number;
};

export function claimSeat(code: string, deviceId: string): Promise<ApiResult<ClaimedSeat>> {
  return postJson<ClaimedSeat>(`/api/room/${encodeURIComponent(code)}/seat`, { DeviceId: deviceId });
}

/**
 * Nhận ghế: đặt nickname + chọn nhân vật.
 *
 * PHẢI dùng **token người chơi** (từ `claimSeat` hoặc `/host-seat`), không phải
 * token license. Server đọc `_currentPlayer.ObjectId` ra playerId từ chính token
 * này - đưa nhầm token license thì nó đi tìm một player không tồn tại.
 *
 * `deviceId` gửi kèm phải là ĐÚNG cái đã dùng lúc xin ghế: server ghi nó vào
 * `ClientDeviceId` lần đầu, và từ chối nếu lần sau khác đi.
 *
 * `errorCode: "character_taken"` = có người vừa lấy mất nhân vật đó. Không phải
 * lỗi mạng - cho người dùng chọn lại, đừng thử lại y nguyên.
 */
export function submitNickname(
  params: {
    nickname: string;
    gender: string;
    characterId: string;
    deviceId: string;
  },
  token: string,
): Promise<ApiResult<{ data: string }>> {
  return postJson<{ data: string }>(
    '/public/submitNickname',
    {
      Nickname: params.nickname,
      Gender: params.gender,
      characterId: params.characterId,
      deviceId: params.deviceId,
      // Rỗng = lần đặt đầu tiên. Server chỉ dùng trường này để bỏ qua bước
      // kiểm trùng tên khi người chơi ĐỔI tên của chính mình.
      oldNickname: '',
    },
    token,
  );
}
