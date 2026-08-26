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
/**
 * Một lá bài trong tay người chơi.
 *
 * `CardId` là chuỗi cố định trong `Helper.AllCards` ở server ("Joker",
 * "Skipper", "Eliminator", "Changer") - KHÔNG phải GUID, và không nằm trong
 * bảng nào cả. Dùng nó để tra hình/màu, đừng dùng `Name` (có thể dịch).
 *
 * `Quantity` là số lá cùng loại đang cầm. Trần: 3 mỗi loại, riêng Joker là 1.
 */
export type GameCard = {
  Id: string;
  CardId: 'Joker' | 'Skipper' | 'Eliminator' | 'Changer';
  Name: string;
  /** 'J' | 'S' | 'E' | 'C' */
  Code: string;
  Quantity: number;
  Ordering: number;
  IsUsed: boolean;
};

export type GamePlayer = {
  Id: string;
  NickName: string;
  Ordering: number;
  CharacterId: string;
  /** 'male' | 'female' - ghép vào tên file ảnh nhân vật. */
  Gender: string;
  PlayerColor: string;
  /** Điểm tích luỹ. Đây là con số to hiện trên ô người chơi. */
  Point: number;
  /** 0-5. Đủ 5 sao đổi được một lá bài mới (GAME_RULES mục 6). */
  Stars: number;
  /** Đang đứng ở ô nào. Khớp với Board.Squares[].StepIndex. */
  CurrentStepIndex: number;
  IsConnected: boolean;
  IsSetupNickName: boolean;
  IsHost: boolean;
  Cards: GameCard[];
};

export type GameSnapshot = {
  Game: {
    Id: string;
    HostId: string;
    NumberOfPlayers: number;
    /** 0 = thể thức Leaderboard Challenge, tính theo lượt tung xúc xắc. */
    DurationMinutes: number;
    IsGameOver: boolean;
    IsGamePause: boolean;
    /**
     * Ai đang tới lượt. `Guid.Empty` khi chưa xác định xong (vòng đua "ai đi
     * trước" chưa có kết quả).
     */
    CurrentTurnPlayerId: string;
    PlayerTurnIndex: number;
    /**
     * 0 = ván chưa thật sự bắt đầu. Bản web dùng đúng biến này để phân biệt
     * "vào ván mới" với "quay lại ván đang dở" (`CurrentCountRollDice == 0`
     * trong mainControl.js).
     */
    CurrentCountRollDice: number;
    TotalRollDice: number;
  };
  /**
   * Server tạo sẵn ĐỦ số ghế ngay lúc tạo ván, với nickname mặc định
   * ("1st player"...). Ghế nào có người nhận là ghế có `IsSetupNickName: true`
   * - đừng đếm theo độ dài mảng, nó luôn bằng NumberOfPlayers.
   */
  Players: GamePlayer[];
  /** Chỉ có khi gọi với `includeBoard`. Xem `getGameState`. */
  Board?: GameBoard | null;
};

/**
 * Hình bàn cờ.
 *
 * `Geometry` là các đa giác VẼ TAY đè lên ảnh nền `BackgroundImage`, cùng hệ
 * toạ độ `ViewBox`. Nghĩa là muốn đặt quân cờ đúng ô thì phải hiển thị đúng ảnh
 * đó với đúng tỉ lệ - co giãn lệch một chút là quân cờ lệch ô.
 *
 * `Geometry` NULL với bàn `rectangle`: loại đó server không vẽ sẵn mà client tự
 * sinh từ `Hoz_step`/`Ver_step` (`renderSteps()` trong board.js của bản web).
 * Dữ liệu thật hiện có: `crictriv` và `footietriv` đều là oval.
 */
export type GameBoard = {
  BoardGameId: string;
  BoardType: string;
  Hoz_step: number | null;
  Ver_step: number | null;
  Squares: { StepIndex: number; StepNumber: number; Title: string; SquareColor: string }[];
  Geometry: {
    ViewBox: string;
    BackgroundImage: string;
    Polygons: {
      Index: string;
      StepIndex: number;
      /**
       * Mặt bên của khối ô, thứ tạo cảm giác nổi 3D. KHÔNG phải mặt trên - đặt
       * quân cờ lên nó là quân đứng ở sườn ô. Lọc bỏ khi tính tâm ô.
       */
      IsTileBase: boolean;
      Points: string;
    }[];
  } | null;
};

/** Ảnh nền bàn cờ. Server trả đường dẫn tương đối. */
export const boardImageUrl = (path: string) => `${API_BASE_URL}${path}`;

/**
 * Ảnh nhân vật, lấy thẳng từ server.
 *
 * Hậu tố `-0` là khung đứng yên - đúng khung mà bản web dùng cho ô người chơi
 * (`SelectPlayersPartialHtml.cshtml`, `PlayerHomeScreen.js`). Các khung `-1`,
 * `-male`, `-female` dành cho animation và màn chọn nhân vật.
 */
export const characterImageUrl = (characterId: string) =>
  `${API_BASE_URL}/images/character/${characterId}-0.png`;

export async function getGameState(
  gameId: string,
  includeBoard = false,
): Promise<ApiResult<GameSnapshot>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/game/${gameId}/state?includeBoard=${includeBoard}`,
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

/**
 * Mã phòng + link QR của một ván.
 *
 * Ván tạo từ app KHÔNG tự có mã phòng: mã vốn chỉ được cấp trong gói SignalR
 * `JoinSession` mà trình duyệt Main Device gửi lên. Endpoint này làm đúng phần
 * việc đó cho app.
 *
 * Idempotent - gọi lại trả về đúng mã cũ, nên mở lại lobby vẫn hiện mã mà
 * người chơi đã chép ra giấy.
 */
export type RoomCode = {
  RoomCode: string;
  SessionId: string;
  /** Gốc URL của server, để ghép link vào ghế. Có dấu / ở cuối. */
  SiteUrl: string;
  /**
   * KHÔNG dùng làm QR cho ván tạo từ app - đây là trang "người quét đầu tiên
   * dựng ván" của luồng web cũ, nó sẽ tạo THÊM một ván nữa. Xem `seatJoinUrl`.
   */
  JoinUrl: string;
};

/**
 * MỘT link dùng chung cho mọi người chơi: server tự phát một ghế trống rồi
 * chuyển tiếp sang `/player/start/{playerId}`.
 *
 * Trước đây phải mỗi ghế một link, vì `/player/start/{playerId}` mang playerId
 * ngay trong URL. Endpoint `/player/join/{sessionId}` sinh ra để có chỗ phát ghế.
 *
 * Là link HTTP chứ KHÔNG phải deep link `cyclic://`: người chơi quét bằng camera
 * điện thoại và chơi trên trình duyệt, phần lớn không cài app.
 *
 * Quét lại từ cùng một trình duyệt sẽ về đúng ghế cũ (server nhớ bằng cookie),
 * không chiếm thêm ghế.
 */
export const roomJoinUrl = (siteUrl: string, sessionId: string) =>
  `${siteUrl}player/join/${sessionId}`;

export function ensureRoomCode(gameId: string, token: string): Promise<ApiResult<RoomCode>> {
  return postForm<RoomCode>(`/public/game/${gameId}/room-code`, {}, token);
}

/**
 * BƯỚC 1 của nút START GAME: đẩy mọi điện thoại sang màn chờ.
 *
 * ĐỪNG gộp hai bước này lại. Giữa chúng là 10 giây đếm ngược "WHO GOES FIRST?"
 * mà bản web cũng có - và khoảng nghỉ đó không phải trang trí: nó là lúc điện
 * thoại người chơi báo đã nhận `PlayerStart`, mà server lại cần cờ đó mới ghi
 * được câu hỏi vòng đua vào flow của họ. Gọi liền tay hai lệnh thì người mất
 * kết nối đúng lúc đó sẽ không lấy lại được câu hỏi.
 */
export function markPlayersReady(gameId: string, token: string): Promise<ApiResult<{}>> {
  return postForm(`/public/game/${gameId}/ready`, {}, token);
}

/**
 * BƯỚC 2: nổ vòng đua "ai đi trước".
 *
 * Từ đây server tự chạy hết ván, không cần bàn cờ - người trả lời đúng đầu tiên
 * làm server sắp lại thứ tự lượt rồi tự phát `GameStart` và `WhosTurn`. App
 * KHÔNG cần gửi hai cái đó (xem GAME_RULES mục 8).
 *
 * `AlreadyRunning: true` = vòng đua đã chạy sẵn, không phải lỗi - coi như thành
 * công và đi tiếp.
 */
export function startGame(
  gameId: string,
  token: string,
): Promise<ApiResult<{ AlreadyRunning?: boolean }>> {
  return postForm(`/public/game/${gameId}/start`, {}, token);
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
