import { useCallback, useEffect, useRef, useState } from 'react';

import { getGameState, type GameBoard, type GameSnapshot } from '../api/game';
import type { Packet } from './gameConnection';
import { useGameConnection } from './useGameConnection';

/**
 * Trạng thái ván, do SignalR đẩy nhịp thay vì poll đều đặn.
 *
 * ⚠️ GÓI TIN LÀ TÍN HIỆU, KHÔNG PHẢI DỮ LIỆU. Đây là điều quyết định cả thiết
 * kế này: `PlayerCheckedIn_Res` chẳng hạn chỉ mang `{Nickname, PlayerId}` chứ
 * không mang danh sách ghế; `WhosTurn` chỉ nói tới lượt ai. Không gói nào đủ để
 * dựng lại màn hình.
 *
 * Nên: nghe gói tin để biết KHI NÀO có thay đổi, rồi nạp lại
 * `/api/game/{id}/state` - vẫn là nguồn sự thật duy nhất. Đổi lại so với poll 3
 * giây: cập nhật gần như tức thì, và lúc ván đứng yên thì không gọi gì cả.
 *
 * Đừng đi hướng "chép từng payload vào state": phải viết lại toàn bộ luật ghép
 * trạng thái ở client, mà server đã làm sẵn trong `GameStateApiController`.
 */

/**
 * Những gói tin CÓ NGHĨA LÀ trạng thái đã đổi.
 *
 * ⚠️ Cố ý là DANH SÁCH CHO PHÉP, không phải danh sách chặn. Có những gói bắn
 * liên tục - `CountDownTask` (31) và `TenSecondsChallengeCountDown` (43) mỗi
 * giây một lần - và nếu để chúng lọt vào đây thì mỗi giây một lần nạp lại
 * state, tức còn tệ hơn poll 3 giây. Danh sách chặn thì mỗi lần server thêm gói
 * mới là tự động lọt; danh sách cho phép thì cùng lắm là bỏ sót một cập nhật,
 * và lưới an toàn ở dưới sẽ vá.
 *
 * Số phải khớp `Hubs/PacketType.cs`.
 */
const REFRESH_ON = new Set<number>([
  8, // PlayerCheckedIn   - có người nhận ghế
  9, // WhosTurn
  10, // NextTurn
  12, // StartTurn         - tới lượt mình, `CurrentAction` vừa đổi
  13, // TurnComplete
  15, // ActionDone
  16, // PlayerGetNextAction - server vừa đổi việc kế tiếp của mình (vd sang RollDice)
  22, // UseCard            - số lá bài của mình vừa đổi
  24, // PlayerRank
  36, // PlayerStars
  38, // GameStart
  39, // GameOver
  50, // PlayerStart
  52, // AskMoveDirection - vừa tung xong, xúc xắc và lượt đã đổi
  53, // MoveDirectionSelected - quân cờ vừa đi
  58, // PlayerBattleWinner
  62, // GameState
  65, // ShowPlayersAtStart
  71, // EndGame
  80, // PauseGame
  81, // ResumeGameFromPause
  85, // PlayersStatus
  86, // PlayerUsedCard    - người khác vừa dùng thẻ, tay bài của họ đổi
]);

/**
 * Gom nhiều gói tin sát nhau thành MỘT lần nạp lại.
 *
 * Một nước đi bắn ra vài gói liền nhau (`ActionDone`, `MoveDirectionSelected`,
 * `WhosTurn`...). Không gom thì mỗi nước đi là ba, bốn lượt gọi API chồng nhau.
 */
const COALESCE_MS = 150;

/**
 * Lưới an toàn: vẫn nạp lại theo nhịp này kể cả khi không có gói tin nào.
 *
 * ⚠️ ĐỪNG BỎ. Nó bắt hai trường hợp mà SignalR không cứu được: gói tin rơi lúc
 * đang nối lại, và loại gói mới mà `REFRESH_ON` chưa biết. 20 giây là chậm hơn
 * poll cũ gần bảy lần nhưng vẫn đủ để màn hình không kẹt vĩnh viễn ở dữ liệu
 * sai.
 */
const SAFETY_MS = 20000;

export function useGameState(options: {
  gameId: string | null;
  /** Token NGƯỜI CHƠI. `null` = không nối SignalR, chỉ còn lưới an toàn. */
  token: string | null;
  /** Lấy kèm phần bàn cờ ở lần nạp ĐẦU TIÊN. */
  includeBoard?: boolean;
  /** Xem ghi chú `asBoard` trong `gameConnection.ts`. */
  asBoard?: boolean;
  /**
   * Xem thêm gói tin thô, sau khi hook đã tự lo phần nạp lại state.
   *
   * ⚠️ Chỉ dùng cho những gói MANG SẴN DỮ LIỆU mà state không có - hiện chỉ có
   * câu hỏi (`PlayerInstructionQuestion`). Mọi thứ khác cứ để hook nạp lại
   * `/api/game/{id}/state`; tự chép payload vào state là đi lại đường server đã
   * làm sẵn, và sai lệch dần theo thời gian.
   */
  onPacket?: (packet: Packet) => void;
}) {
  const { gameId, token, includeBoard, asBoard, onPacket } = options;

  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [board, setBoard] = useState<GameBoard | null>(null);

  const alive = useRef(true);
  const hasBoard = useRef(false);
  const inFlight = useRef(false);
  const coalesce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!gameId || !alive.current) return;

    // Một lượt gọi đang bay thì thôi - gói tin dồn dập không được phép xếp
    // hàng thành chồng request.
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const wantBoard = !!includeBoard && !hasBoard.current;
      const result = await getGameState(gameId, wantBoard);
      if (!alive.current) return;

      if (result.isSuccess) {
        setSnapshot({ Game: result.Game, Players: result.Players });
        if (wantBoard && result.Board) {
          setBoard(result.Board);
          hasBoard.current = true;
        }
      }
      /*
       * Lỗi mạng thì GIỮ NGUYÊN dữ liệu cũ và đợi nhịp sau. Nhấp nháy giữa "có
       * người" và "trống" khó chịu hơn nhiều so với hiện hơi cũ vài giây.
       */
    } finally {
      inFlight.current = false;
    }
  }, [gameId, includeBoard]);

  const schedule = useCallback(() => {
    if (coalesce.current) return;
    coalesce.current = setTimeout(() => {
      coalesce.current = null;
      void load();
    }, COALESCE_MS);
  }, [load]);

  // Giữ trong ref - xem ghi chú cùng lý do ở `useGameConnection`.
  const extra = useRef(onPacket);
  extra.current = onPacket;

  const { state: connState, connection } = useGameConnection({
    token,
    asBoard,
    onPacket: (packet) => {
      if (REFRESH_ON.has(packet.typeID)) schedule();
      extra.current?.(packet);
    },
  });

  useEffect(() => {
    alive.current = true;
    hasBoard.current = false;

    void load();
    const safety = setInterval(() => void load(), SAFETY_MS);

    return () => {
      alive.current = false;
      clearInterval(safety);
      if (coalesce.current) clearTimeout(coalesce.current);
      coalesce.current = null;
    };
  }, [load]);

  /*
   * Vừa nối lại được thì nạp ngay: trong lúc rớt mạng gần như chắc chắn đã lỡ
   * mất gói tin, và đợi hết 20 giây lưới an toàn thì màn hình đứng hình quá lâu.
   */
  useEffect(() => {
    if (connState === 'connected') void load();
  }, [connState, load]);

  return { snapshot, board, connState, connection, refresh: load };
}
