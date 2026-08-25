import { postForm, type ApiResult } from './client';
import { API_BASE_URL, API_TIMEOUT_MS } from './config';

/**
 * Cấu hình để dựng màn tạo ván, lấy từ `GET /public/get-config/`.
 *
 * Endpoint này đã có sẵn cho web và trả đúng thứ cần: số người chơi, thời
 * lượng, loại xúc xắc, danh sách ngôn ngữ. KHÔNG hardcode mấy danh sách này
 * trong app - chúng nằm trong DB và quản trị viên đổi được.
 *
 * Gọi được mà không cần token.
 */
export type GameConfig = {
  HubUrl: string;
  Languages: { Id: string; Name: string; Code: string; Icon: string; IsActive: boolean }[];
  Durations: {
    Id: string;
    /** Nhãn hiển thị sẵn, vd "15 minutes" hoặc "Leaderboard Challenge" */
    Time: string;
    /** false = thể thức tính theo lượt tung xúc xắc chứ không theo phút */
    isMinute: boolean;
    Duration: number;
  }[];
  NumberOfPlayers: { Id: string; NumberOfPlayers: number; IsActive: boolean }[];
  DiceOptions: { key: string; value: string }[];
};

export async function getGameConfig(): Promise<ApiResult<{ data: GameConfig }>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/public/get-config/`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return { isSuccess: false, kind: 'http', messageKey: 'error.http', messageVars: { status: response.status } };
    }
    const body = (await response.json()) as { isSuccess: boolean; data: GameConfig; errorMessage?: string };
    if (!body.isSuccess) {
      return { isSuccess: false, kind: 'rejected', message: body.errorMessage };
    }
    return { isSuccess: true, data: body.data };
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
 * Tạo ván mới. Server dựng luôn cả GameSession, đủ số PlayerModel với nickname
 * mặc định, và bộ thẻ bài cho từng người - app không phải làm gì thêm.
 *
 * Trả về `data` là **gameId đã gắn tiền tố** (`gamePrefix` trong appsettings,
 * hiện là "sea-"). Dùng `stripGamePrefix` để lấy id thật.
 *
 * PHẢI gửi FORM chứ không phải JSON - xem ghi chú ở `postForm`.
 */
export function createGame(
  numberOfPlayers: number,
  durationId: string,
  languageCode: string,
  dice: string,
  token: string,
): Promise<ApiResult<{ data: string }>> {
  return postForm<{ data: string }>(
    '/public/createGame',
    {
      numberOfPlayers,
      duration: durationId,
      // Không được để rỗng: server gọi thẳng `.Trim()` lên nó mà không kiểm null.
      languageLocal: languageCode || 'en-GB',
      dice,
    },
    token,
  );
}

/**
 * Số người chơi hợp lệ ứng với một mốc thời lượng.
 *
 * ĐÂY LÀ LUẬT CHƠI, không phải chuyện giao diện - chép đúng theo
 * `getFilteredPlayersByDuration()` trong `wwwroot/js/player.js` của bản web.
 * Server KHÔNG kiểm tra ràng buộc này, nên nếu app cho chọn sai thì ván vẫn
 * được tạo và hỏng ở trong game.
 *
 * Vì vậy trên màn tạo ván, THỜI LƯỢNG phải chọn trước, rồi mới lọc lại danh
 * sách người chơi theo nó.
 */
export function playersForDuration(config: GameConfig, durationId: string | null) {
  const active = config.NumberOfPlayers.filter((p) => p.IsActive);
  const duration = config.Durations.find((d) => d.Id === durationId);
  if (!duration) return active;

  // Duration === 0 là thể thức Leaderboard Challenge (tính theo lượt tung xúc
  // xắc chứ không theo phút), giới hạn 4 người.
  if (duration.Duration === 0) return active.filter((p) => p.NumberOfPlayers <= 4);
  if (duration.Duration === 15 || duration.Duration === 60) {
    return active.filter((p) => p.NumberOfPlayers <= 6);
  }
  return active;
}

/**
 * Ván đang mở của máy này, hỏi thẳng server bằng token.
 *
 * Đây là NGUỒN SỰ THẬT cho việc màn hình chính hiện RESUME GAME hay NEW GAME.
 * Id lưu ở máy chỉ là bản dự phòng khi mất mạng.
 *
 * Cái server biết mà client không biết: ván có thể kết thúc ở NƠI KHÁC (bàn cờ
 * gọi GameOver, hết giờ, host khác cùng license bắt đầu lại). Con trỏ ở máy
 * không hay biết gì và sẽ dẫn vào một ván đã chết.
 *
 * LƯU Ý điều này KHÔNG cứu được trường hợp cài lại app: mất phiên là mất token,
 * mà `ActivationCodeCheck` với `DeviceId` rỗng sẽ tạo HOST MỚI - host mới thì
 * không có ván nào. Muốn lấy lại thật sự thì phải đi qua luồng
 * `/public/device-recovery/*`.
 *
 * `IsOpen: false` = không có ván nào đang mở (chưa từng tạo, hoặc ván đã kết
 * thúc / rơi khỏi cache). Lúc đó các trường còn lại không có mặt.
 *
 * ĐƯỜNG DẪN PHẢI DƯỚI `/public`: middleware biến token thành claims ở server
 * chỉ chạy cho /gamehub, /public, /public-view, /public-view-authorize. Đổi
 * sang `/api/...` thì server trả "Invalid session" dù token hoàn toàn hợp lệ.
 */
export type CurrentGame =
  | { IsOpen: false }
  | {
      IsOpen: true;
      GameId: string;
      NumberOfPlayers: number;
      DurationMinutes: number;
      /** Số người đã nhận chỗ (đặt nickname + chọn nhân vật xong). */
      JoinedPlayers: number;
    };

export async function getCurrentGame(token: string): Promise<ApiResult<CurrentGame>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/public/host/current-game`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        isSuccess: false,
        kind: 'http',
        messageKey: 'error.http',
        messageVars: { status: response.status },
      };
    }
    const data = (await response.json()) as { isSuccess: boolean; errorMessage?: string } & CurrentGame;
    if (!data.isSuccess) {
      return { isSuccess: false, kind: 'rejected', message: data.errorMessage };
    }
    return { ...(data as CurrentGame), isSuccess: true };
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
 * Ván hiện tại còn dùng được không.
 *
 * `GET /api/game/{id}/state` trả snapshot đầy đủ; ở đây chỉ cần vài trường để
 * quyết định có hiện nút RESUME GAME hay không, nên gọi kèm `includeBoard=false`
 * cho nhẹ - phần board là toạ độ 40 polygon, không dùng tới.
 *
 * Tên trường viết HOA chữ đầu: DTO là class C# và server dùng
 * `DefaultContractResolver` nên giữ nguyên tên thuộc tính.
 */
export type GameSnapshot = {
  Game: {
    Id: string;
    NumberOfPlayers: number;
    /** 0 = thể thức Leaderboard Challenge, tính theo lượt tung xúc xắc. */
    DurationMinutes: number;
    IsGameOver: boolean;
  };
};

export async function getGameState(gameId: string): Promise<ApiResult<GameSnapshot>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/game/${gameId}/state?includeBoard=false`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      // 404 = ván không còn trong cache/DB. Chỗ gọi nên coi như hết ván.
      return {
        isSuccess: false,
        kind: 'http',
        messageKey: 'error.http',
        messageVars: { status: response.status },
      };
    }
    const data = (await response.json()) as GameSnapshot;
    return { ...data, isSuccess: true };
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

/** GUID nằm ở CUỐI chuỗi, sau tiền tố. */
const TRAILING_GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bỏ tiền tố mà server gắn vào trước gameId (`gamePrefix` trong appsettings,
 * hiện là "sea-", nhưng đổi được nên đừng so khớp cứng chuỗi đó).
 *
 * Bắt GUID ở cuối chuỗi. ĐỪNG cắt theo dấu gạch cuối cùng: bản thân GUID có
 * bốn dấu gạch, nên `lastIndexOf('-')` rơi vào giữa GUID chứ không phải ranh
 * giới tiền tố (đã dính lỗi này - màn lobby hiện nguyên
 * "sea-aaebb8fe-7e80-...").
 */
export function stripGamePrefix(value: string): string {
  const match = value.match(TRAILING_GUID);
  return match ? match[0] : value;
}
