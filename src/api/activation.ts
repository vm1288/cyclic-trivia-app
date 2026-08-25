import { postJson, type ApiResult } from './client';

/**
 * Luồng kích hoạt license, ánh xạ 1-1 với
 * CyclicTrivia/Controllers/PublicController.Activation.cs.
 *
 *   1. checkActivationCode  - luôn gọi trước; server tạo Host và cấp token
 *   2. nếu `isActivated === false` (license chưa gắn email):
 *        submitActivationInfo   - gửi tên + email, server mail về mã OTP 6 ký tự
 *        confirmActivationCode  - nhập OTP, license chuyển sang đã kích hoạt
 *
 * LƯU Ý VỀ TÊN FIELD: server dùng Newtonsoft với `DefaultContractResolver` nên
 * giữ NGUYÊN tên viết trong C#. Vì thế `HostId` viết hoa chữ H trong khi
 * `isSuccess`/`deviceId` lại viết thường - không phải nhầm, đừng "sửa" lại.
 */

export type ActivationCheckResult = {
  /** false = license chưa gắn email, phải đi tiếp bước nhập tên/email + OTP */
  isActivated: boolean;
  /** JWT, đính vào header Authorization cho mọi lời gọi sau */
  data: string;
  /**
   * DeviceId do SERVER sinh (Guid), không phải client. Phải lưu lại và gửi kèm
   * ở những lần kiểm tra sau - nếu không, mỗi lần nhập lại cùng một license sẽ
   * bị tính là một thiết bị mới và ăn hết hạn mức `MaxDevices`.
   */
  deviceId: string;
  HostId: string;
  /**
   * Ngôn ngữ chính của sponsor gắn với license này (vd "en-GB").
   *
   * Có thể null với server bản cũ hoặc khi không tra được sponsor - app rơi về
   * ngôn ngữ của máy. Đây là phần vùng miền ĐẦY ĐỦ; app tự cắt lấy phần gốc.
   */
  languageCode?: string | null;
  /**
   * URL TUYỆT ĐỐI tới logo của sponsor (vd
   * `https://.../sponsors/{guid}crictriv.png`). App tải file này về máy rồi
   * dùng thay logo Cyclic mặc định - xem `session/sponsorLogo.ts`.
   *
   * Có thể null khi sponsor chưa có logo.
   */
  sponsorLogoUrl?: string | null;
};

export function checkActivationCode(
  code: string,
  deviceId: string | null,
  token?: string | null,
): Promise<ApiResult<ActivationCheckResult>> {
  return postJson<ActivationCheckResult>(
    '/public/ActivationCodeCheck',
    { Code: code, DeviceId: deviceId },
    token,
  );
}

export function submitActivationInfo(
  name: string,
  email: string,
  licenseCode: string,
  token: string,
): Promise<ApiResult<Record<string, never>>> {
  return postJson('/public/SubmitActivationInfo', { Name: name, Email: email, LicenseCode: licenseCode }, token);
}

export function confirmActivationCode(
  otp: string,
  token: string,
): Promise<ApiResult<{ HostId: string }>> {
  return postJson<{ HostId: string }>('/public/SubmitActivationConfirmCode', { OTPCode: otp }, token);
}

/** Server trả mã này khi license đã dùng hết số thiết bị cho phép. */
export const ERR_MAX_DEVICES = 'max_devices';
