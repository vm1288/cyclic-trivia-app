import { API_BASE_URL, API_TIMEOUT_MS } from './config';

/**
 * K145 — xin danh sách `iceServers` cho WebRTC.
 *
 * ⚠️ **Lấy từ server, KHÔNG nhúng trong app.** Thông tin đăng nhập TURN là tạm thời (hết hạn sau
 * vài tiếng) nên vốn dĩ không nhúng được; và nhờ vậy sau này thêm/đổi máy chủ TURN chỉ là sửa cấu
 * hình rồi restart site, **không phải ra bản app mới rồi chờ người chơi cập nhật**.
 *
 * ⚠️ Server thiếu `Turn:Secret` thì trả về **chỉ STUN** — cuộc gọi vẫn chạy giữa những máy nối
 * thẳng được với nhau, chỉ mất đường relay. Ở đây không coi đó là lỗi; đường relay có hay không
 * là chuyện của cấu hình máy chủ.
 */
export type IceServer = { urls: string[]; username?: string | null; credential?: string | null };

export async function getIceServers(token: string): Promise<IceServer[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/public/call/ice-servers`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { isSuccess?: boolean; iceServers?: IceServer[] };
    if (!data.isSuccess || !Array.isArray(data.iceServers)) return [];
    return data.iceServers.map(clean);
  } catch {
    /*
     * Hỏng mạng thì trả mảng rỗng chứ không ném: WebRTC vẫn thử nối thẳng được trong cùng mạng
     * LAN. Cuộc gọi kém đi vẫn hơn là màn ván nổ vì một lời hứa bị từ chối.
     */
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ⚠️ BỎcT KHOÁ `username` / `credential` KHI RỖNG — không được để `null` đi tiếp.
 *
 * Mục STUN không có đăng nhập, nhưng WebRTC bên Android cứ thấy **có khoá** là lấy giá trị ra,
 * gặp `null` thì ném `IllegalArgumentException: username == null`. Cái này làm NỔ nguyên
 * `new RTCPeerConnection`, tức là **mất sạch cuộc gọi**, chứ không phải chỉ mất một máy chủ ICE
 * (đã dính thật trên máy ngày 24/9).
 *
 * Server đã sửa để không gửi `null` nữa, nhưng vẫn lọc ở đây: app phát hành rồi còn sống rất
 * lâu sau một bản server, và cái giá của một dòng lọc rẻ hơn cái giá của một cuộc gọi chết.
 */
function clean(server: IceServer): IceServer {
  const out: IceServer = { urls: server.urls };
  if (server.username) out.username = server.username;
  if (server.credential) out.credential = server.credential;
  return out;
}
