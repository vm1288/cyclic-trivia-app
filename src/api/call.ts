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
    return data.isSuccess && Array.isArray(data.iceServers) ? data.iceServers : [];
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
