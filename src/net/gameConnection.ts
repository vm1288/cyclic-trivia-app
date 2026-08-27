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
  RollDice: 14,
  /** Xúc xắc của vòng đua "ai đi trước" - KHÁC `RollDice`. */
  RollDiceForTurnClient: 41,
  GameStart: 38,
  GameOver: 39,
  PlayerStart: 50,
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
      await connection.invoke('Pub', {
        typeID,
        payload: payload === undefined ? '' : JSON.stringify(payload),
      });
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
