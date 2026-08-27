import { useEffect, useRef, useState } from 'react';

import {
  createGameConnection,
  type ConnectionState,
  type GameConnection,
  type Packet,
} from './gameConnection';

/**
 * Giữ MỘT kết nối SignalR sống theo vòng đời màn hình.
 *
 * ⚠️ `onPacket` được giữ trong `ref`, nên truyền hàm inline vào cũng KHÔNG làm
 * nối lại. Nếu để nó vào mảng phụ thuộc của `useEffect` thì mỗi lần màn render
 * là một hàm mới -> ngắt rồi nối lại kết nối. Giữa ván, mỗi lần nối lại là một
 * lần server thấy người chơi rớt ra rồi vào lại.
 *
 * Trả về `connection` qua ref chứ không phải state: gửi gói tin không cần render
 * lại màn hình, còn `state` thì cần (để hiện "đang kết nối lại...").
 */
export function useGameConnection(options: {
  /** Token NGƯỜI CHƠI. `null` = chưa có ghế, chưa nối. */
  token: string | null;
  /** Xem ghi chú `asBoard` trong `gameConnection.ts`. */
  asBoard?: boolean;
  onPacket: (packet: Packet) => void;
}) {
  const { token, asBoard, onPacket } = options;

  const [state, setState] = useState<ConnectionState>('idle');
  const connection = useRef<GameConnection | null>(null);

  const handler = useRef(onPacket);
  handler.current = onPacket;

  useEffect(() => {
    if (!token) return;

    let alive = true;

    const conn = createGameConnection({
      token,
      asBoard,
      onPacket: (packet) => handler.current(packet),
      onState: (next) => {
        if (alive) setState(next);
      },
    });

    connection.current = conn;

    void conn.start().catch(() => {
      /*
       * Nối hụt lần đầu thì thôi - `withAutomaticReconnect` chỉ chạy sau khi ĐÃ
       * nối được một lần, nên ở đây phải tự chịu. Màn hình vẫn dùng được vì dữ
       * liệu ban đầu lấy từ `/api/game/{id}/state`.
       */
      if (alive) setState('closed');
    });

    return () => {
      alive = false;
      connection.current = null;
      void conn.stop();
    };
    // `onPacket` CỐ Ý không nằm ở đây - xem ghi chú đầu hàm.
  }, [token, asBoard]);

  return { state, connection };
}
