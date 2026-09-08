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
/** Nhịp thử nối lại khi kết nối đã đóng hẳn. Xem ghi chú ở effect dùng nó. */
const RECONNECT_RETRY_MS = 5000;

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

  /**
   * Hook còn sống hay đã unmount.
   *
   * ⚠️ Phải TÁCH khỏi cờ `alive` cục bộ của effect nối lại. Cờ kia bị dọn mỗi
   * lần `state` đổi, mà bản thân việc thử nối lại LÀM `state` đổi - dùng nhầm
   * nó trong `catch` là tự bịt đường re-arm. Đã dính đúng vậy.
   */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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

  /*
   * Nối lại KHÔNG GIỚI HẠN khi kết nối đã đóng hẳn.
   *
   * ⚠️ ĐỪNG BỎ. `withAutomaticReconnect` chỉ thử 5 lần trong ~37 giây rồi bỏ
   * cuộc vĩnh viễn, và nó cũng KHÔNG chạy nếu lần nối đầu tiên đã hụt. Sau đó
   * không còn gì khởi động lại: `useEffect` phía trên chỉ chạy lại khi `token`
   * hoặc `asBoard` đổi, mà giữa ván thì cả hai đứng yên.
   *
   * Hậu quả đã đo trên máy thật (2026-09-08): tắt server 65 giây rồi bật lại ->
   * không client nào nối lại, và cú bấm ROLL DICE sau đó server KHÔNG hề nhận
   * được. Người chơi nhìn thấy bàn cờ vẫn đúng (lưới an toàn 20 giây của
   * `useGameState` vẫn nạp được qua HTTP) nên tưởng app còn sống, nhưng thực ra
   * đã CÂM hẳn - không tung xúc xắc, không trả lời được nữa.
   *
   * Nhịp 5 giây là cố ý chậm: đây là đường cứu cho sự cố dài (server restart,
   * ra khỏi vùng sóng), không phải để tranh với `withAutomaticReconnect` vốn đã
   * lo phần rớt ngắn. `start()` tự bỏ qua nếu kết nối không ở trạng thái
   * `Disconnected`, nên gọi thừa cũng vô hại.
   *
   * Nối lại được thì mọi thứ tự đúng lại: `useGameState` nạp state ngay khi
   * `connState` thành `connected`, và các màn trong ván gửi lại `HostResume` để
   * server phát lại flow đang treo.
   */
  useEffect(() => {
    if (state !== 'closed') return;

    let alive = true;
    const retry = setInterval(() => {
      if (!alive) return;
      void connection.current?.restart().catch(() => {
        /*
         * ⚠️ PHẢI đưa state về `closed` khi thử hụt, đừng nuốt lặng.
         *
         * `start()` báo `connecting` NGAY TRƯỚC khi gọi xuống SignalR, nên khi
         * lời gọi đó ném lỗi thì state đã rời khỏi `closed` - effect này thấy
         * điều kiện không còn đúng, dọn `setInterval`, và KHÔNG CÒN NHỊP NÀO
         * thử lại. Đúng bẫy đã dính ở lần vá đầu: chấm kết nối chuyển vàng
         * (đang thử) rồi đứng đó vĩnh viễn.
         *
         * ⚠️ Và phải là `mounted.current`, KHÔNG phải cờ `alive` của effect:
         * `restart()` báo `connecting` NGAY, effect thấy state đổi nên dọn mình
         * và đặt `alive = false` TRƯỚC khi lời gọi kịp ném lỗi. Dùng `alive` ở
         * đây là `catch` không bao giờ chạy được - kẹt y hệt lỗi đang vá.
         */
        if (mounted.current) setState('closed');
      });
    }, RECONNECT_RETRY_MS);

    return () => {
      alive = false;
      clearInterval(retry);
    };
  }, [state]);

  return { state, connection };
}
