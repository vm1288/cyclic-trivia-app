/**
 * Địa chỉ server CyclicTrivia.
 *
 * Khi chạy dev trên máy thật cắm USB, forward cổng rồi để nguyên `localhost` -
 * máy sẽ đi ngược qua cáp về server trên PC:
 *
 *   adb -s <serial> reverse tcp:7025 tcp:7025
 *
 * Trên emulator thì đổi thành `https://10.0.2.2:7025`, NHƯNG chứng chỉ dev có
 * SAN là `localhost` nên hostname sẽ không khớp - trên emulator phải dùng
 * `adb reverse` hoặc quay về HTTP.
 *
 * VỀ HTTPS: chứng chỉ do `dotnet dev-certs` sinh ra là self-signed, Android
 * từ chối theo mặc định. Bản debug tin được nó nhờ `plugins/withDevHttps.js`
 * nhúng chính chứng chỉ đó làm trust anchor riêng của app. Nếu đổi/làm mới
 * chứng chỉ thì phải xuất lại và prebuild + build lại - đọc phần đầu file
 * plugin đó.
 *
 * Cổng lấy từ CyclicTrivia/Properties/launchSettings.json: profile `https` mở
 * 7025 (HTTPS) và 5276 (HTTP).
 */
export const API_BASE_URL = 'https://localhost:7025';

/** Bỏ cuộc sau ngần này ms - tránh nút kẹt ở trạng thái quay vòng vô hạn. */
export const API_TIMEOUT_MS = 15000;
