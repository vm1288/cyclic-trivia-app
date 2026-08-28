import { postForm, postJson, type ApiResult } from './client';
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

/*
 * ─── Tạo ván: chuỗi BA BƯỚC ────────────────────────────────────────────────
 *
 * ⚠️ ĐỪNG dùng `createGame` ở trên cho luồng app. Nó thiếu ba thứ, và cả ba đều
 * chỉ lộ ra ở mãi cuối luồng:
 *
 *   1. không gắn `sessionId` vào ván  -> không cấp được mã phòng, không ai vào được
 *   2. không đặt `isHost` cho ghế nào -> `/host-seat` trả "This game has no host seat"
 *   3. không trả `firstPlayerId`
 *
 * `createGameUseSession` làm cả ba. Nhưng nó tra hostId ra từ
 * `GameSetup-{sessionId}` trong cache, nên PHẢI mở phòng trước.
 *
 *   openRoom            -> SessionId + RoomCode
 *   createGameUseSession-> gameId + firstPlayerId (ghế 0, isHost = true)
 *   hostSeat            -> token NGƯỜI CHƠI cho ghế đó
 *
 * `createGame` giữ lại vì bản web cũ còn gọi, đừng xoá.
 */

/**
 * Mở phòng TRƯỚC khi ván tồn tại.
 *
 * Đăng ký `GameSetup-{sessionId}` -> hostId rồi cấp mã phòng. Bỏ trống
 * `sessionId` thì server tự sinh - đó là cách dùng bình thường của app.
 */
export function openRoom(
  token: string,
): Promise<ApiResult<{ SessionId: string; RoomCode: string; SiteUrl: string }>> {
  return postForm('/public/room/open', { sessionId: '' }, token);
}

/**
 * Tạo ván gắn vào phòng vừa mở.
 *
 * Server dựng luôn đủ `numberOfPlayers` ghế kèm bộ thẻ bài cho từng ghế, và
 * đặt `isHost = true` cho ghế `Ordering = 0`. App không phải tạo gì thêm.
 *
 * `data` là gameId ĐÃ GẮN TIỀN TỐ - dùng `stripGamePrefix`.
 */
export function createGameUseSession(
  sessionId: string,
  numberOfPlayers: number,
  durationId: string,
  languageCode: string,
  dice: string,
  token: string,
): Promise<ApiResult<{ data: string; firstPlayerId: string }>> {
  return postForm(
    '/public/createGameUseSession',
    {
      sessionId,
      numberOfPlayers,
      duration: durationId,
      languageLocal: languageCode || 'en-GB',
      dice,
    },
    token,
  );
}

/**
 * Token NGƯỜI CHƠI cho ghế của người tạo phòng.
 *
 * Người tạo phòng giữ HAI token khác nhau và không thay thế cho nhau được:
 *   - token license ("authcode") -> định danh THIẾT BỊ giữ license
 *   - token này ("player")       -> định danh GHẾ trong ván
 *
 * `submitNickname` đọc playerId ra từ token, nên đưa nhầm token license vào là
 * server đi tìm một player không tồn tại.
 *
 * `IsClaimed: true` = ghế đã đặt tên rồi (mở lại lobby), khỏi hỏi lại.
 */
export function hostSeat(
  gameId: string,
  token: string,
): Promise<ApiResult<{ PlayerId: string; Token: string; IsClaimed: boolean }>> {
  return postForm(`/public/game/${gameId}/host-seat`, {}, token);
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
  /**
   * Server đang BẢO người này làm gì (`CaseAction`, xem `CASE_ACTION`).
   *
   * ⚠️ Đây mới là thứ quyết định nút xúc xắc sáng hay xám, KHÔNG phải
   * `CurrentTurnPlayerId`. Tới lượt mình nhưng đang trả lời câu hỏi thì cũng
   * không được tung; server nói `RollDice` thì mới được.
   */
  CurrentAction: number;
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
     * Id của LƯỢT hiện tại. Phải gửi kèm khi tung xúc xắc để server biết gói tin
     * thuộc lượt nào - gửi thiếu là nó bỏ qua.
     */
    CurrentTurnId: string;
    /**
     * 0 = ván chưa thật sự bắt đầu. Bản web dùng đúng biến này để phân biệt
     * "vào ván mới" với "quay lại ván đang dở" (`CurrentCountRollDice == 0`
     * trong mainControl.js).
     */
    CurrentCountRollDice: number;
    TotalRollDice: number;
    /** Xem `GAME_SETUP`. */
    GameSetup: number;
    /** Xem `CASE_ACTION`. */
    CurrentAction: number;
    /**
     * Mặt xúc xắc của cú tung gần nhất.
     *
     * ⚠️ Đây là ĐƯỜNG DUY NHẤT để app biết kết quả tung. Server có gói
     * `RollDice` (14) mang `DiceOne`/`DiceTwo` nhưng dòng gửi cho chính người
     * chơi đã bị comment lại từ lâu (`RollDiceHandler.cs`, "Send result to
     * current player") - chỉ bàn cờ nhận. Nên màn xúc xắc đọc từ state, sau khi
     * gói `AskMoveDirection` (52) về và kéo theo một lượt nạp lại.
     */
    DiceOne: number;
    DiceTwo: number;
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
 * `Geometry` NULL với bàn `rectangle` là **đúng**, không phải lỗi: loại đó
 * client tự sinh toạ độ từ `Hoz_step`/`Ver_step` (`renderSteps()` trong
 * board.js của bản web). `BoardCanvas` đã có nhánh cho cả hai.
 *
 * ⚠️ Ở bàn `rectangle`, `StepNumber` và `StepIndex` **lệch nhau**: thứ tự đặt ô
 * quanh vòng đi theo `StepNumber`, còn `CurrentStepIndex` của người chơi trỏ
 * theo `StepIndex`. Dùng nhầm một cái là cả bàn cờ xoay đi một ô. Bàn `oval`
 * không dính vì polygon đã mang sẵn `StepIndex`.
 */
export type GameCharacter = {
  /** Ghi vào `Players.CharacterId`, và cũng là chỗ ghép đường dẫn ảnh. */
  Id: string;
  Color: string;
  /** "Leo, the Lion". */
  Name: string;
  /** "Leo". */
  ShortName: string;
  /** Đường dẫn tương đối tới khung đứng yên - phải qua `assetUrl`. */
  Image: string;
  /**
   * `false` khi `{id}-1.png` chỉ là bản sao của khung đứng yên chứ không phải
   * khung mắt nhắm thật. Lúc đó ĐỪNG tải nó - phí ~450KB mỗi người chơi.
   */
  HasBlink: boolean;
  /**
   * Bề ngang chia chiều cao của ảnh ĐÃ CẮT VIỀN.
   *
   * ⚠️ Cần thật. Bộ 12 con của CricTriv có nhiều con vẽ NẰM NGANG (komodo 1.58,
   * hippo 1.29, rhino 1.28) trong khi 6 con cũ đều đứng dọc (0.57..0.87). Đoán
   * khung theo chiều cao rồi `contain` là con nằm ngang bị co lại và CĂN GIỮA
   * khung - chân nó lơ lửng phía trên ô.
   */
  Aspect: number;
  /** Chân nằm ở đâu theo chiều cao ảnh: 0.88 với bộ cũ, 1.0 với bộ mới. */
  FootRatio: number;
};

export type GameBoard = {
  BoardGameId: string;
  BoardType: string;
  Hoz_step: number | null;
  Ver_step: number | null;
  /**
   * Một ô, đã ghép sẵn phần hiển thị.
   *
   * `SquareColor` là chuỗi CSS `linear-gradient(...)` chứ không phải mã màu -
   * `BoardCanvas` tự đọc nó ra gradient của SVG.
   *
   * ⚠️ Ô `StepIndex = -1` là ô Start: **không có polygon nào** và các trường
   * màu đều RỖNG. Đừng đi tìm hình cho nó.
   */
  Squares: {
    StepIndex: number;
    StepNumber: number;
    Title: string;
    /** CSS gradient. Rỗng ở ô Start. */
    SquareColor: string;
    /** Màu đặc của mặt bên (khối 3D). */
    TileBaseBackground: string;
    /** Màu viền ô. */
    TileBaseBoxShadow: string;
    /** URL icon, server ghép sẵn với `SiteURL` - phải qua `assetUrl`. */
    Background: string;
    /** `X = 0` nghĩa là chưa chỉnh tay: tự căn giữa icon trong ô. */
    X: number;
    Y: number;
    Width: number;
    Height: number;
    Angle: number;
  }[];
  /**
   * Nhân vật chơi được trên board NÀY, theo thứ tự hiện trong màn chọn.
   *
   * ⚠️ ĐỪNG hardcode danh sách này. Bộ nhân vật phụ thuộc board: CricTriv dùng
   * 12 con thú, Cyclic Trivia và FootieTriv giữ 6 con cũ. `Color` phải đúng cái
   * server ghi vào `PlayerColor` lúc nhận ghế, lệch là ô người chơi một màu còn
   * quân cờ một màu khác.
   */
  Characters: GameCharacter[];
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
 * Đưa một URL tài nguyên của server về đúng origin mà app đang gọi.
 *
 * ⚠️ CẦN, đừng bỏ. `Square.Background` (icon của ô) được server ghép sẵn với
 * `SiteURL` trong appsettings - hiện là `https://localhost:7025/`. Nhưng app
 * lúc dev nói chuyện qua `http://localhost:5276`, nên dùng nguyên URL đó thì
 * icon **không tải được** và bàn cờ hiện ra trống trơn, không báo lỗi gì.
 *
 * Không phải mẹo tạm: `SiteURL` là địa chỉ server tự nghĩ về mình, còn
 * `API_BASE_URL` là địa chỉ client thật sự với tới được. Hai cái đó khác nhau
 * bất cứ khi nào có proxy, port-forward hay tên miền nội bộ - chuẩn hoá về phía
 * client mới đúng.
 */
export function assetUrl(raw: string): string {
  if (!raw) return raw;
  const path = raw.match(/^https?:\/\/[^/]+(\/.*)$/)?.[1];
  return path ? `${API_BASE_URL}${path}` : `${API_BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

/**
 * `GameSessionModel.GameSetup` ở server. Giá trị số, không phải chuỗi.
 *
 * ⚠️ `Started` là **0**, không phải giá trị cuối. Đừng viết `GameSetup > 0` để
 * kiểm tra "đã bắt đầu chưa" - nó cho kết quả ngược.
 *
 * Và `Started` chỉ bật lên khi vòng đua "ai đi trước" đã có NGƯỜI THẮNG, chứ
 * không phải lúc bấm nút START GAME. Muốn biết vòng đua đang chạy thì xem
 * `CurrentAction === CASE_ACTION.QuestionForTurn`.
 */
export const GAME_SETUP = { Started: 0, Instruction: 1, SetNickname: 2 } as const;

/** `CaseAction` ở server (`Hubs/PacketType.cs`). Chỉ khai báo cái app đang dùng. */
export const CASE_ACTION = {
  /** Tới lượt, được tung xúc xắc. */
  RollDice: 1,
  /**
   * "Báo lại đi rồi tôi nói việc kế tiếp."
   *
   * Server đặt giá trị này vào trường `Action` của gói `StartTurn` (12). Máy
   * khách phải gửi `Pub PlayerGetNextAction` thì mới sang được `RollDice`.
   */
  PlayerGetNextAction: 2,
  /** Đang ở màn bắt đầu lượt, CHƯA được tung. */
  Start: 3,
  /**
   * Trước câu hỏi, server mời dùng thẻ bài (Joker / Changer...).
   *
   * App CHƯA có màn dùng bài nên bỏ qua bước này - xem `game-landscape.tsx`.
   */
  ShowCardsBeforeSubCategoryOrQuestion: 5,
  /** Câu hỏi của lượt thường - người tới lượt trả lời. */
  ShowSubCategoriesAndQuestions: 6,
  /** Cùng câu hỏi đó, nhưng gửi cho NHỮNG NGƯỜI CÒN LẠI để tranh trả lời. */
  OtherPlayersAnswering: 11,
  /** Vòng đua "ai đi trước" - cũng tung xúc xắc nhưng gói tin khác. */
  RollDiceForTurn: 13,
  QuestionForTurn: 20,
} as const;

/**
 * Ảnh nhân vật, lấy thẳng từ server.
 *
 * Hậu tố `-0` là khung đứng yên - đúng khung mà bản web dùng cho ô người chơi
 * (`SelectPlayersPartialHtml.cshtml`, `PlayerHomeScreen.js`).
 *
 * `-1` là **cùng nhân vật đó nhưng NHẮM MẮT** - hai file chỉ khác nhau đôi mắt.
 * `BoardCanvas` chồng hai khung rồi đảo `opacity` để nhân vật trên bàn cờ nháy
 * mắt. Các khung `-male`, `-female` dành cho màn chọn nhân vật.
 */
export const characterImageUrl = (characterId: string, frame: 0 | 1 = 0) =>
  `${API_BASE_URL}/images/character/${characterId}-${frame}.png`;

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

/* ─── Ack flow ─────────────────────────────────────────────────────────────── */

/**
 * Báo server "máy này đã nhận flow đó" (`IsClientReceivedFlow = true`).
 *
 * ⚠️ ĐÂY LÀ MẮT XÍCH BẮT BUỘC, không phải tuỳ chọn. `QuestionForTurnHandler`
 * chỉ ghi câu hỏi vòng đua vào flow của người chơi khi
 * `CurrentFlow == PlayerStart && IsClientReceivedFlow`. Bản web đặt cờ đó bằng
 * cách ĐIỀU HƯỚNG TRANG tới `/player/start/{playerId}` - một Razor action đặt cờ
 * như tác dụng phụ. App không có trang đó, nên nếu không gọi hàm này thì cờ mãi
 * là `false` và CÂU HỎI KHÔNG BAO GIỜ TỚI.
 *
 * ⚠️ CHỈ ack `PlayerStart`. Đừng ack `QuestionForTurn`: cờ đó còn là điều kiện
 * để server phát lại câu hỏi cho người vừa nối lại (`HostResume`), và
 * `submitAnswerForTurn` đã tự đặt khi có câu trả lời.
 *
 * Tên flow phải khớp enum `CurrentFlow` của server; server so với
 * `player.CurrentFlow` và bỏ qua nếu lệch (trả `isAcked: false`, không phải lỗi).
 */
export function ackFlow(
  flow: 'PlayerStart',
  token: string,
): Promise<ApiResult<{ isAcked?: boolean; flow?: string }>> {
  return postForm('/public/game/flow-received', { flow }, token);
}

/* ─── Chọn hướng đi ────────────────────────────────────────────────────────── */

/**
 * Payload của gói `AskMoveDirection` (52): tung xúc xắc xong, server hỏi đi
 * hướng nào.
 *
 * ⚠️ Gói này MANG SẴN DỮ LIỆU (chủ đề của ô sẽ tới ở mỗi hướng, và nếu là battle
 * thì cả tên lẫn điểm của người đang đứng đó). Giống gói 67, nó là ngoại lệ của
 * luật "gói tin chỉ là tín hiệu" - state không có mấy thứ này.
 *
 * Trả lời bằng `Pub MoveDirectionSelected` (53) với
 * `{ direction: 'clockwise' | 'anticlockwise' | 'random' }`. Hết giờ thì gửi
 * `random`, đúng như bản web (`AskMoveDirection.cshtml`, hàm `skip`).
 */
export type DirectionPacket = {
  DurationInSeconds: number;
  ClockwiseCategory: string;
  AntiClockwiseCategory: string;
  ClockwiseBattle?: boolean;
  AntiClockwiseBattle?: boolean;
  /** Thể thức Leaderboard Challenge: thắng/thua battle xử lý khác. */
  isLeaderBoard?: boolean;
  /** "crictriv" | "footietriv" | ... - quyết định gọi điểm là "runs" hay "goals". */
  boardGameId?: string;
  WaggerPercent?: number;
  ClockwiseIncumbentNickname?: string;
  ClockwiseIncumbentTotalPoint?: number;
  ClockwiseIncumbentPoint?: number;
  AntiClockwiseIncumbentNickname?: string;
  AntiClockwiseIncumbentTotalPoint?: number;
  AntiClockwiseIncumbentPoint?: number;
};

export type MoveDirection = 'clockwise' | 'anticlockwise' | 'random';

/**
 * Điểm cho một câu trả lời đúng ở lượt thường.
 *
 * ⚠️ Là HẰNG SỐ CỦA SERVER (`Constants.CorrectQuestionPoint = 2`), chép sang đây
 * để hiện lời mời "trả lời đúng được mấy điểm" y như bản web. Server đổi thì
 * phải sửa cả đây - nó không nằm trong gói tin nào.
 */
export const CORRECT_QUESTION_POINT = 2;

/* ─── Câu hỏi ──────────────────────────────────────────────────────────────── */

/**
 * Câu hỏi server đẩy xuống qua gói tin.
 *
 * ⚠️ KHÔNG có trường nào cho biết đáp án đúng - `IsCorrect` và `AnswerExplain`
 * đều `[JsonIgnore]` ở server. Cố ý, và đừng tìm cách lấy: client biết đáp án là
 * gian lận được. Chấm đúng/sai do server làm, kết quả về qua gói tin sau đó.
 */
export type GameQuestion = {
  Id: string;
  Title: string;
  Answers: { Id: string; Content: string }[];
};

/**
 * Chủ đề của câu hỏi: một gốc và một cây con nối bằng `ParentId`.
 *
 * ⚠️ `Subs` CHỨA CẢ CHÍNH GỐC (mục có `ParentId: null`), không phải chỉ các
 * nhánh con. Lọc theo `ParentId` chứ đừng lấy cả mảng.
 */
export type QuestionCategory = {
  Root: { Id: string; QuestionCategoryId: string; Title: string };
  Subs: { Id: string; Title: string; QuestionCategoryId: string; ParentId: string | null }[];
};

/** Payload của gói `PlayerInstructionQuestion` (67) - câu hỏi vòng đua. */
export type QuestionPacket = {
  Question: GameQuestion;
  Category?: QuestionCategory | null;
  DurationInSeconds: number;
};

/**
 * Chuỗi chủ đề từ GỐC đi xuống: `["Cricket", "Women's Cricket", "World Cup"]`.
 *
 * Chép đúng `getFilteredSubs` trong `PlayerQuestionForTurn.cshtml` của bản web:
 * gốc trước, rồi đệ quy theo `ParentId` xuống từng nhánh.
 *
 * Nhiều bộ câu hỏi chỉ có ĐÚNG một cấp - lúc đó chuỗi chỉ có một phần tử, và
 * màn câu hỏi phải chịu được chuyện đó (ẩn bớt ô thay vì hiện ô rỗng).
 */
export function categoryChain(category?: QuestionCategory | null): string[] {
  const root = category?.Root;
  if (!root) return [];

  const subs = category?.Subs ?? [];
  const titles = [root.Title];

  const walk = (parentId: string) => {
    for (const sub of subs) {
      if (sub.ParentId === parentId) {
        titles.push(sub.Title);
        walk(sub.QuestionCategoryId);
      }
    }
  };
  walk(root.QuestionCategoryId);

  return titles.filter(Boolean);
}

/**
 * Trả lời câu hỏi VÒNG ĐUA "ai đi trước".
 *
 * ⚠️ Đây là endpoint riêng của vòng đua. Lượt chơi thường dùng
 * `/public/game/submitAnswer`, battle lại dùng đường khác nữa - đừng gộp.
 *
 * Ba đường gửi, chép đúng theo `PlayerQuestionForTurn.cshtml` của bản web:
 *
 *   chọn đáp án : { answerId, questionId, questionTitle }
 *   hết giờ     : { answerId: GUID rỗng, questionId, IsTimeout: true }
 *   trả lời muộn: { answerId: GUID rỗng, questionId, IsTooLate: true }
 *
 * ⚠️ Hết giờ PHẢI gửi, không được im lặng. Server đang đợi câu trả lời của từng
 * người để biết vòng đua đã xong chưa; không ai báo gì là ván đứng đó.
 */
export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

export function submitAnswerForTurn(
  params: { questionId: string; answerId: string; questionTitle?: string; isTimeout?: boolean; isTooLate?: boolean },
  token: string,
): Promise<ApiResult<AnswerResult>> {
  return postJson(
    '/public/game/submitAnswerForTurn',
    {
      answerId: params.answerId,
      questionId: params.questionId,
      questionTitle: params.questionTitle ?? '',
      IsTimeout: params.isTimeout ?? false,
      IsTooLate: params.isTooLate ?? false,
    },
    token,
  );
}

/**
 * Kết quả của chính lượt trả lời vừa gửi, server trả thẳng trong HTTP response.
 *
 * ⚠️ Đây là ĐƯỜNG DUY NHẤT app biết mình đúng hay sai. Bản web biết nhờ
 * `BoardMessage` mang HTML dựng sẵn - app không hiển thị được HTML đó.
 */
export type AnswerResult = {
  isCorrect: boolean;
  /** Điểm vừa được cộng (2 cho người tới lượt, 1 cho người tranh trả lời). */
  point: number;
  /** Số sao SAU khi cộng. Đủ ngưỡng thì server tự reset về 0 và thưởng bài. */
  stars: number;
  /** Tên lá bài vừa được thưởng, rỗng nếu chưa tới ngưỡng sao. */
  card: string;
};

/**
 * Trả lời câu hỏi của LƯỢT CHƠI THƯỜNG.
 *
 * ⚠️ Khác đường với vòng đua. Ba loại câu hỏi, ba endpoint:
 *   vòng đua "ai đi trước" -> `/public/game/submitAnswerForTurn`
 *   lượt chơi thường       -> `/public/game/submitAnswer`   (đây)
 *   battle                 -> đường khác nữa, chưa tra
 * Gửi nhầm đường thì server tìm không ra lượt và câu trả lời rơi vào hư không.
 *
 * Hình dạng payload thì giống hệt vòng đua - chép theo
 * `ShowSubCategoriesAndQuestions.cshtml` của bản web.
 */
export function submitAnswer(
  params: { questionId: string; answerId: string; questionTitle?: string; isTimeout?: boolean; isTooLate?: boolean },
  token: string,
): Promise<ApiResult<AnswerResult>> {
  return postJson(
    '/public/game/submitAnswer',
    {
      answerId: params.answerId,
      questionId: params.questionId,
      questionTitle: params.questionTitle ?? '',
      IsTimeout: params.isTimeout ?? false,
      IsTooLate: params.isTooLate ?? false,
    },
    token,
  );
}

/**
 * `Payload` của gói `PlayerGetNextAction` (16) khi tới lượt trả lời câu hỏi
 * thường.
 *
 * ⚠️ Tên trường ở đây viết THƯỜNG (`question`, `category`) - khác gói 67 của
 * vòng đua vốn viết hoa (`Question`, `Category`). Server dựng payload này bằng
 * anonymous object nên nó giữ nguyên cách viết trong C#
 * (`ShowCardsBeforeSubCategoryOrQuestion.cs`). Đừng gộp hai kiểu làm một.
 */
export type TurnCard = {
  Id: string;
  CardId: 'Joker' | 'Skipper' | 'Eliminator' | 'Changer';
  Name: string;
  Quantity: number;
  IsUsed: boolean;
};

/**
 * `Payload` của gói 16 khi server mời dùng thẻ bài (`Action = 5`).
 *
 * ⚠️ `cardsToShow` server đã LỌC SẴN: chỉ những thẻ dùng được TRƯỚC câu hỏi
 * (`ShowBeforeQuestion`), tức Joker và Changer. Skipper/Eliminator dùng trong
 * lúc có câu hỏi và đi đường khác (`UseCardInQuestion`).
 */
export type CardStepPayload = {
  cardsToShow: TurnCard[];
  category?: QuestionCategory | null;
};

export type TurnQuestionPayload = {
  question: GameQuestion;
  category?: QuestionCategory | null;
  lastCategoryId?: string;
  /** false = mình chỉ đang tranh trả lời câu của người khác. */
  isQuestionOwner?: boolean;
  isYourChoice?: boolean;
};

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
