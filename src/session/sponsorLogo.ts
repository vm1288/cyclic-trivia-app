import { Directory, File, Paths } from 'expo-file-system';

/**
 * Tải logo sponsor về máy và giữ lại ở đó.
 *
 * VÌ SAO TẢI VỀ chứ không dùng thẳng URL trong `<Image source={{uri}}>`:
 *   - Logo là thứ đầu tiên nhìn thấy khi mở app. Dùng URL thì mỗi lần mở đều
 *     phụ thuộc mạng, và lần đầu sẽ chớp một khoảng trống.
 *   - Máy chủ nhà (bàn chơi tại chỗ) có thể không có internet lúc chơi.
 *   - Cache ảnh của RN không có gì bảo đảm về thời hạn; file tự quản thì chắc.
 *
 * File nằm trong thư mục document của app nên KHÔNG bị hệ thống dọn như cache,
 * và biến mất cùng app khi gỡ - đúng vòng đời của phiên license.
 */

const DIR_NAME = 'sponsor';

function directory() {
  return new Directory(Paths.document, DIR_NAME);
}

/**
 * Tải logo về, trả lại URI local để đưa thẳng vào `<Image source={{uri}}>`.
 * Trả null nếu tải hỏng - chỗ gọi phải rơi về logo Cyclic mặc định.
 */
export async function downloadSponsorLogo(url: string): Promise<string | null> {
  try {
    const dir = directory();
    if (!dir.exists) dir.create({ intermediates: true });

    /*
     * Tên file lấy từ URL: tên trên server đã có GUID ở đầu nên đổi logo là đổi
     * tên file, không sợ đụng bản cũ đang nằm sẵn. Vẫn lọc ký tự lạ phòng khi
     * quy ước đặt tên phía server thay đổi.
     */
    const raw = url.split('/').pop() ?? 'logo.png';
    const safe = decodeURIComponent(raw).replace(/[^a-zA-Z0-9._-]/g, '_');

    const target = new File(dir, safe);
    if (target.exists) return target.uri;

    const downloaded = await File.downloadFileAsync(url, target);
    return downloaded.uri;
  } catch {
    return null;
  }
}

/**
 * Xoá logo đã tải. Gọi khi bỏ license khỏi máy, để lần đăng ký sau bằng
 * license của sponsor khác không còn dấu vết thương hiệu cũ.
 */
export async function clearSponsorLogos(): Promise<void> {
  try {
    const dir = directory();
    if (dir.exists) dir.delete();
  } catch {
    /* không xoá được thì cũng không có gì để làm thêm */
  }
}
