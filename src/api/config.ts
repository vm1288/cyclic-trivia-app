/**
 * Địa chỉ server CyclicTrivia lúc dev.
 *
 * **Dev dùng HTTP cổng 5276**, và **mọi thiết bị đều là `localhost`** — kể cả
 * emulator. Đi qua `adb reverse`, nên máy nào cũng gọi đúng một địa chỉ:
 *
 * ```bash
 * adb -s <serial> reverse tcp:5276 tcp:5276   # server
 * adb -s <serial> reverse tcp:8081 tcp:8081   # Metro
 * ```
 *
 * ⚠️ **`adb reverse` CÓ chạy trên emulator.** SETUP_NOTES từng ghi ngược lại;
 * đã đo lại trên emulator 36.6.11 với hai máy ảo cùng lúc và cả hai đều tới
 * được server qua `localhost:5276`. Đừng bỏ công dựng đường `10.0.2.2` nữa.
 *
 * ⚠️ **ĐỪNG tự dò host bằng `Constants.expoConfig.hostUri` hay
 * `NativeModules.SourceCode.scriptURL`.** Đã thử: trong dev-client này **cả hai
 * đều `undefined`**, nên mọi logic dò đều rơi về nhánh mặc định mà vẫn trông
 * như đang hoạt động. Nó chạy đúng trên máy thật hoàn toàn do tình cờ —
 * `localhost` vốn đã là đáp án đúng ở đó.
 *
 * ⚠️ **VÌ SAO KHÔNG DÙNG HTTPS lúc dev:** chứng chỉ `dotnet dev-certs` chỉ có
 * SAN `DNS:localhost`. Đi qua `adb reverse` thì tên vẫn khớp, nên HTTPS *có*
 * chạy được — nhưng bỏ nó đi thì hết một tầng phải bảo trì (chứng chỉ hết hạn,
 * phải xuất lại, phải prebuild). Bản release KHÔNG bị ảnh hưởng: nó trỏ vào
 * server thật với chứng chỉ thật.
 *
 * ⚠️ **Bẫy 401 đi kèm HTTP — đã vá ở server.** `app.UseHttpsRedirection()` từng
 * chạy vô điều kiện: request HTTP kèm `Authorization` bị trả 307 sang HTTPS,
 * client đi theo redirect nhưng đổi origin nên **bỏ header Authorization**, và
 * server trả 401 với một token hoàn toàn hợp lệ. Triệu chứng đánh lừa: endpoint
 * ẩn danh vẫn chạy ngon. `Program.cs` giờ chỉ redirect khi không phải
 * Development.
 *
 * Cổng lấy từ `CyclicTrivia/Properties/launchSettings.json`, profile `https`
 * (mở cả 7025 HTTPS lẫn 5276 HTTP).
 */
export const API_BASE_URL = 'http://localhost:5276';

/** Bỏ cuộc sau ngần này ms - tránh nút kẹt ở trạng thái quay vòng vô hạn. */
export const API_TIMEOUT_MS = 15000;
