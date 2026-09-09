import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';

import { API_BASE_URL } from '../api/config';

/**
 * Kết nối SignalR tới `GameHub`.
 *
 * Giao thức chỉ có ĐÚNG hai chiều, không có gì khác:
 *
 *   gửi:   connection.invoke('Pub', { typeID, payload })   `payload` là CHUỖI JSON
 *   nhận:  connection.on('ReceiveMessage', message)        `message` là chuỗi, hoặc "pong"
 *
 * ⚠️ `payload` phải là **chuỗi đã JSON.stringify**, không phải object. Server ký
 * `HandlePub(connectionId, string payload, TypeID)` rồi mới tự parse ra kiểu
 * tương ứng. Đưa thẳng object vào là server nhận `[object Object]`.
 *
 * Toàn bộ trạng thái ván vẫn nằm ở server; đây chỉ là đường truyền. Protocol
 * `Pub`/`TypeID` độc lập với SignalR nên sau này đổi tầng vận chuyển vẫn rẻ -
 * đó là lý do NEXT_STEPS chốt không đổi sang thứ khác.
 */

/**
 * `TypeID` ở server (`Hubs/PacketType.cs`). CHỈ khai báo cái app đang dùng -
 * server có 86 giá trị, chép hết vào đây là một bảng nữa phải giữ cho khớp.
 *
 * ⚠️ Giá trị phải khớp TUYỆT ĐỐI với enum bên server. Nó là số thứ tự, nên chèn
 * một giá trị mới vào GIỮA enum kia là mọi số sau đó lệch hết.
 */
export const TYPE_ID = {
  Ping: 0,
  PlayerCheckedIn: 8,
  WhosTurn: 9,
  /**
   * "Tới lượt bạn rồi" - server CHỈ gửi cho đúng người tới lượt
   * (`StartTurnHandler.cs`), nên nhận được gói này nghĩa là lượt của mình.
   *
   * Gói mang `Action` (một `CaseAction`) nói việc kế tiếp phải làm, và
   * `CurrentTurnId` để gắn vào gói trả lời.
   */
  StartTurn: 12,
  RollDice: 14,
  /**
   * "Tôi đã nhận lượt, cho tôi việc kế tiếp."
   *
   * ⚠️ MẮT XÍCH BẮT BUỘC để nút xúc xắc sáng - xem `game-landscape.tsx`.
   * Payload PHẢI có `TurnId`; gửi payload rỗng thì server nổ
   * `NullReferenceException` (`PlayerGetNextActionHandler.cs:176`).
   */
  PlayerGetNextAction: 16,
  /**
   * "Bước vừa rồi xong" - server báo sau khi quân cờ đã đi tới nơi.
   *
   * ⚠️ Nhận gói này thì PHẢI gửi lại `PlayerGetNextAction` (16), nếu không câu
   * hỏi của lượt sẽ không bao giờ tới. Không có lưới an toàn nào ở server cho
   * bước này - `BoardStepWatchdog` chỉ lo phần việc của BÀN CỜ.
   */
  ActionDone: 15,
  /** "Lượt của tôi xong rồi" - gửi lên khi server nhờ qua gói 27. */
  TurnComplete: 13,
  /**
   * "Gọi hộ tôi hàm X" - server nhờ máy khách bấm nút thay nó.
   *
   * ⚠️ Nghe cực dị nhưng đây là XƯƠNG SỐNG của luật chơi, không phải tiện ích:
   * server không tự đẩy ván đi tiếp, nó gửi gói này cho máy khách rồi máy khách
   * gửi ngược lại gói thật (`ActionDone`, `TurnComplete`...). Bản web có một
   * bảng hàm `callFromServer*` trong `playerHandlers.js` làm đúng việc đó.
   *
   * Không xử lý gói này thì mọi nhánh "người tới lượt trả lời sai" đứng im: cả
   * phòng chờ mãi mà không ai được tranh trả lời.
   */
  CallJavascriptFromServer: 27,
  /** Gửi lên: "tôi dùng thẻ này". Nhận về: server xác nhận, kèm số lá còn lại. */
  UseCard: 22,
  /**
   * Server vừa cấp/trả lại một lá bài. `isFromStars: true` = phần thưởng đủ 5 sao.
   */
  EnableCard: 33,
  /**
   * "Câu hỏi khép lại rồi" - CÓ NGƯỜI KHÁC trả lời trước bạn.
   *
   * ⚠️ Nhận gói này thì phải đóng màn câu hỏi VÀ gửi câu trả lời `IsTooLate`.
   * Server đợi đủ câu trả lời của mọi người mới khép vòng; im lặng là lượt treo
   * tới khi watchdog cắt. Bản web làm y hệt (`handleTriggerTimeoutQuestion` gọi
   * `TooLate()`).
   */
  TimeoutQuestion: 45,
  /** Xúc xắc của vòng đua "ai đi trước" - KHÁC `RollDice`. */
  RollDiceForTurnClient: 41,
  /**
   * ============================================================
   * Ô 10-SEC CHALLENGE - ba gói, HAI CHIỀU cả ba
   * ============================================================
   *
   * Luật: người tới lượt rơi vào ô `challenge`, server bốc ngẫu nhiên MỘT người
   * khác làm TRỌNG TÀI (`IsJudge`). Có hai kiểu thử thách:
   *   - kiểu thường: chỉ trọng tài nhận gói 42, `Words` rỗng
   *   - kiểu "B":    mỗi người còn lại nhận một phần `Words` để đọc, kèm
   *                  `ReaderNumber`/`TotalReaders`
   *
   * Nhịp đi (chép theo `playerHandlers.js` của bản web):
   *
   *   42 về  -> hiện lời/vai trò, người chơi bấm xong thì GỬI LẠI 42 (payload rỗng)
   *             = "tôi đọc xong rồi, bắt đầu đếm 10 giây"
   *   43 về  -> hiện hai nút PASS / FAIL cho đúng người vừa gửi 42
   *   gửi 30 -> `{ isPass }` - phán quyết của trọng tài
   *
   * ⚠️ Không gửi lại 42 là **KẸT VÁN**: watchdog
   * `TenSecondsChallengeCountDown` chỉ được arm BÊN TRONG
   * `TenSecondsChallengeStartHandler`, tức chỉ sau khi máy khách gửi 42 về.
   */
  TenSecondsChallenge: 30,
  TenSecondsChallengeStart: 42,
  TenSecondsChallengeCountDown: 43,
  GameStart: 38,
  GameOver: 39,
  /**
   * "Tôi vừa nối xong, còn flow nào đang treo thì phát lại đi."
   *
   * Tên gọi đánh lừa: gói này KHÔNG chỉ dành cho host. `HostResumeHandler` rẽ
   * nhánh theo vai - người chơi gửi thì server tra `player.CurrentFlow` rồi cho
   * đúng resolver ở `PlayerCurrentFlows/` phát lại flow đang treo. Trang người
   * chơi bản web gửi nó ở mỗi lần nối (`playerConnection.js`), và đó là lý do
   * bản web không mất câu hỏi khi đổi màn giữa chừng.
   */
  HostResume: 21,
  PlayerStart: 50,
  /**
   * "Hiệu ứng xúc xắc của tôi chạy xong rồi, đi tiếp đi."
   *
   * ⚠️ Đây là CỔNG sang bước chọn hướng, không phải gói báo cho vui:
   * `HostDoneRollDiceHandler` gỡ watchdog rồi mới gửi `AskMoveDirection` (52).
   *
   * Vốn là việc của BÀN CỜ (`handleRollDice` trong `mainHandlers.js`). Luồng app
   * không có Main Device, nhưng mỗi điện thoại tự vẽ bàn cờ của mình nên máy vừa
   * tung ĐÚNG LÀ bàn cờ của nước đi đó. Không gửi thì watchdog `WaitBoardStep`
   * bắn hộ và gói 52 tới lúc xúc xắc còn đang lăn.
   */
  HostDoneRollDice: 51,
  AskMoveDirection: 52,
  MoveDirectionSelected: 53,
  PlayerBattle: 54,
  PlayerBattleInstruction: 55,
  GameState: 62,
  QuestionForTurn: 66,
  /** Cau hoi vong dua, MANG SAN ca cau hoi lan cac dap an. */
  PlayerInstructionQuestion: 67,
  AnsweredQuestionFornTurn: 68,
  Log: 77,
  CheckPlayerScreen: 79,
  PauseGame: 80,
  /**
   * "Người chơi khác vừa dùng thẻ" - gói RIÊNG cho app, thêm 2026-08-28.
   *
   * Server chỉ gửi `UseCard` (22) cho chính người dùng thẻ và cho bàn cờ, nên
   * trước đây các máy khác không hề biết. Đừng đổi thành broadcast gói 22: trang
   * người chơi bản web trả lời gói đó bằng `ActionDone` - xem ghi chú ở
   * `TypeID.PlayerUsedCard` phía server.
   */
  PlayerUsedCard: 86,
  /**
   * "Vòng đua xong, X đi trước" - gói RIÊNG cho app, thêm 2026-08-28.
   *
   * Bàn cờ web vốn đã hiện câu này giữa màn hình bằng `BoardMessage` (26), nhưng
   * gói đó mang HTML dựng sẵn nên app không dùng được - và những người THUA thì
   * không nhận gì cả. Gói này chỉ mang dữ liệu (ai thắng), mỗi máy tự vẽ.
   */
  RaceWinner: 87,
} as const;

/** Gói tin server đẩy xuống. Luôn có `typeID`; phần còn lại tuỳ loại. */
export type Packet = { typeID: number } & Record<string, unknown>;

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';

type Options = {
  /** Token NGƯỜI CHƠI (`seat.token`), KHÔNG phải token license. */
  token: string;
  /**
   * Nối với vai BÀN CỜ.
   *
   * ⚠️ HIỆN TẠI ĐÂY LÀ NO-OP với app, và như vậy là ĐÚNG - đừng "sửa" cho nó có
   * tác dụng.
   *
   * `GameHub.OnConnectedAsync` đọc `connKind=board` rồi đưa xuống
   * `ConnectionSyncHelper`, nhưng chỗ đó chỉ ghi `IsBoardConnection` lên identity
   * của CHÍNH người vừa nối - với app là `PlayerIdentity-{playerId}`. Còn
   * `BoardStepWatchdog` lại đọc `PlayerIdentity-{hostId}` (THIẾT BỊ giữ license,
   * tức Main Device web). Hai ô cache khác nhau.
   *
   * Nghĩa là app bật cờ này KHÔNG làm watchdog đổi nhịp - nó vẫn thấy "không có
   * bàn cờ" và dùng `BoardlessStepSeconds` = 2s. May, vì app chưa làm việc của
   * bàn cờ (chạy animation rồi báo "xong"); nếu cờ này ăn thật thì mỗi bước sẽ
   * phải chờ `BoardStepFallbackSeconds` = 10s mà chẳng ai báo gì.
   *
   * Giữ lại vì đúng vai: mỗi điện thoại đều vẽ bàn cờ riêng. Khi nào app nhận
   * việc của bàn cờ thì mới nối phần còn lại ở server.
   */
  asBoard?: boolean;
  onPacket: (packet: Packet) => void;
  onState?: (state: ConnectionState) => void;
};

/**
 * ⚠️ Dựng URL hub từ `API_BASE_URL`, KHÔNG lấy `HubUrl` trong
 * `/public/get-config/`.
 *
 * Trường đó server tự ghép từ `Request.Host`, tức là địa chỉ server nghĩ về
 * chính nó. Lúc dev app đi qua `adb reverse` nên hai cái trùng nhau, nhưng có
 * proxy hay tên miền nội bộ là lệch ngay - đúng lý do `assetUrl` phải tồn tại.
 */
const HUB_PATH = '/gamehub';

/** Chép theo `playerConnection.js` của bản web, đừng đổi tuỳ tiện. */
const RETRY_DELAYS_MS = [0, 2000, 5000, 10000, 20000];
const SERVER_TIMEOUT_MS = 240000;
const KEEP_ALIVE_MS = 30000;
const PING_MS = 30000;

export type GameConnection = {
  start: () => Promise<void>;
  /** Xem ghi chú ở chỗ cài đặt. Dùng cho vòng nối lại khi đã đóng hẳn. */
  restart: () => Promise<void>;
  stop: () => Promise<void>;
  send: (typeID: number, payload?: unknown) => Promise<void>;
  state: () => ConnectionState;
};

export function createGameConnection({ token, asBoard, onPacket, onState }: Options): GameConnection {
  /*
   * Token đi qua QUERY STRING, không phải header.
   *
   * `accessTokenFactory` của SignalR gắn nó thành `?access_token=...`, và
   * `Program.cs` có một middleware riêng dịch tham số đó thành header
   * `Authorization` cho đường `/gamehub`. WebSocket không gửi header tuỳ ý được
   * nên đây là cách duy nhất.
   */
  const url = `${API_BASE_URL}${HUB_PATH}${asBoard ? '?connKind=board' : ''}`;

  const connection: HubConnection = new HubConnectionBuilder()
    .withUrl(url, { accessTokenFactory: () => token })
    .withAutomaticReconnect(RETRY_DELAYS_MS)
    .configureLogging(LogLevel.Warning)
    .build();

  connection.serverTimeoutInMilliseconds = SERVER_TIMEOUT_MS;
  connection.keepAliveIntervalInMilliseconds = KEEP_ALIVE_MS;

  let ping: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const report = (state: ConnectionState) => onState?.(state);

  const stopPing = () => {
    if (ping) clearInterval(ping);
    ping = null;
  };

  /*
   * Ping 30 giây một lần.
   *
   * Không thừa dù SignalR đã có keep-alive riêng: `Pub` đi qua đúng đường mà gói
   * tin thật đi, nên nó chứng minh cả đường VÀO server còn sống chứ không chỉ
   * cái socket. Bản web làm y hệt.
   */
  const startPing = () => {
    stopPing();
    ping = setInterval(() => {
      if (connection.state !== HubConnectionState.Connected) return;
      void connection.invoke('Pub', { typeID: TYPE_ID.Ping, payload: '' }).catch(() => {
        /* mất kết nối thì `onreconnecting` lo, ở đây nuốt cho gọn */
      });
    }, PING_MS);
  };

  connection.on('ReceiveMessage', (message: string) => {
    if (message === 'pong') return;
    try {
      const packet = JSON.parse(message) as Packet;
      if (typeof packet?.typeID === 'number') onPacket(packet);
    } catch {
      /*
       * Gói tin không phải JSON thì BỎ QUA, đừng để nó nổ.
       *
       * Bản web cũng nuốt y hệt. Một gói lạ không được phép làm rơi cả kết nối,
       * vì rơi kết nối giữa ván là mất luôn lượt chơi.
       */
    }
  });

  connection.onreconnecting(() => {
    stopPing();
    report('reconnecting');
  });

  connection.onreconnected(() => {
    startPing();
    report('connected');
  });

  connection.onclose(() => {
    stopPing();
    report(stopped ? 'closed' : 'closed');
  });

  return {
    async start() {
      if (connection.state !== HubConnectionState.Disconnected) return;
      report('connecting');
      await connection.start();
      startPing();
      report('connected');
    },

    /*
     * Nối lại sau khi đã đóng hẳn - ÉP DỪNG trước rồi mới nối.
     *
     * ⚠️ Đừng gọi `start()` cho việc này. Chốt đầu `start()` là
     * `if (connection.state !== Disconnected) return;`, mà một lần nối HỤT để
     * SignalR nằm ở trạng thái KHÁC `Disconnected`. Từ đó mọi lời gọi `start()`
     * đều thoát ngay, KHÔNG ném lỗi, nên vòng thử lại tưởng mình đang chạy mà
     * thật ra không làm gì - app kẹt ở `connecting` (chấm vàng) vĩnh viễn.
     * Đã đo đúng vậy trên máy: chấm RGB(254,198,30) đứng im, server sống lại
     * cũng không nối.
     *
     * `stopped = false` vì đây là chủ động nối lại, không phải rời ván.
     */
    async restart() {
      stopped = false;
      try {
        await connection.stop();
      } catch {
        /* đang dở dang thì kệ, cái cần là về Disconnected */
      }
      report('connecting');
      await connection.start();
      startPing();
      report('connected');
    },

    async stop() {
      stopped = true;
      stopPing();
      try {
        await connection.stop();
      } catch {
        /* đóng lúc đang dở kết nối thì kệ */
      }
      report('closed');
    },

    /**
     * ⚠️ `payload` được JSON.stringify ở ĐÂY. Nơi gọi truyền object bình thường,
     * đừng tự stringify trước rồi truyền chuỗi vào - sẽ thành chuỗi lồng chuỗi
     * và server parse ra rỗng.
     */
    async send(typeID: number, payload?: unknown) {
      if (connection.state !== HubConnectionState.Connected) return;

      try {
        await connection.invoke('Pub', {
          typeID,
          payload: payload === undefined ? '' : JSON.stringify(payload),
        });
      } catch {
        /*
         * ⚠️ PHẢI nuốt ở đây. Kết nối đứt trong lúc một gói đang bay thì SignalR
         * huỷ mọi lời gọi đang chờ với "Invocation canceled due to the
         * underlying connection being closed" - và vì mọi nơi gọi đều `void`
         * (không `await`), lời hứa bị từ chối đó nổi lên thành **unhandled
         * rejection**: bản dev hiện màn đỏ, bản release ghi log ầm ĩ. Đã dính
         * thật khi mở lại app vào một ván đã chết.
         *
         * Nuốt là ĐÚNG chứ không phải giấu lỗi: gói tin rơi lúc mất kết nối vốn
         * đã có đường cứu - nối lại xong app gửi `HostResume` và server phát lại
         * flow đang treo.
         */
      }
    },

    state() {
      switch (connection.state) {
        case HubConnectionState.Connected:
          return 'connected';
        case HubConnectionState.Connecting:
          return 'connecting';
        case HubConnectionState.Reconnecting:
          return 'reconnecting';
        default:
          return 'closed';
      }
    },
  };
}
