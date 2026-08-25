import { API_BASE_URL, API_TIMEOUT_MS } from './config';
import type { TranslationKey } from '../i18n/translations';

/**
 * Server trả lỗi nghiệp vụ bằng HTTP 200 kèm `{isSuccess:false, errorMessage}`,
 * chứ không dùng mã lỗi HTTP. Nên đừng chỉ nhìn `response.ok`.
 *
 * Lỗi chia làm hai loại và HIỂN THỊ KHÁC NHAU:
 *   - 'rejected'  : server từ chối vì lý do nghiệp vụ. Dùng nguyên `message`
 *                   của server, vì chỉ server mới biết lý do cụ thể.
 *   - còn lại     : app không gọi được server. Trả về `messageKey` để màn hình
 *                   tự dịch - lớp API không dùng được hook nên không tự dịch.
 */
export type ApiFailure = {
  isSuccess: false;
  kind: 'rejected' | 'network' | 'timeout' | 'http';
  /** Câu chữ từ server, chỉ có khi kind === 'rejected'. */
  message?: string;
  /** Khoá dịch, chỉ có khi KHÔNG phải 'rejected'. */
  messageKey?: TranslationKey;
  messageVars?: Record<string, string | number>;
  /** Mã lỗi nghiệp vụ của server, vd "max_devices". */
  errorCode?: string;
};

export type ApiResult<T> = ({ isSuccess: true } & T) | ApiFailure;

type Envelope = { isSuccess?: boolean; errorMessage?: string; errorCode?: string };

export function postJson<T>(
  path: string,
  body: unknown,
  token?: string | null,
): Promise<ApiResult<T>> {
  return post<T>(path, 'application/json', JSON.stringify(body), token);
}

/**
 * POST kiểu `x-www-form-urlencoded`.
 *
 * CẦN CẢ HAI KIỂU vì server không nhất quán:
 *   - `PublicActivationController` đánh dấu `[FromBody]` → nhận JSON
 *   - `PublicGameController` là `Controller` thường, KHÔNG có `[ApiController]`
 *     và KHÔNG có `[FromBody]` → tham số kiểu phức bind từ FORM, không phải
 *     JSON. Gửi JSON vào đó thì mọi field về null/0 mà không báo lỗi gì, chỉ
 *     vỡ sâu bên trong (đã dính: NullReferenceException ở `languageLocal.Trim()`).
 *
 * Web dùng jQuery `$.ajax({data: {...}})`, mặc định là form-encoded - đó là lý
 * do bản web chạy được. Đừng "sửa" server thành `[FromBody]`: sẽ làm hỏng web.
 *
 * Xem lại tệp controller trước khi thêm lời gọi mới, đừng đoán.
 */
export function postForm<T>(
  path: string,
  fields: Record<string, string | number>,
  token?: string | null,
): Promise<ApiResult<T>> {
  const body = Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return post<T>(path, 'application/x-www-form-urlencoded', body, token);
}

async function post<T>(
  path: string,
  contentType: string,
  body: string,
  token?: string | null,
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(API_BASE_URL + path, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        // Server đọc "Bearer <token>"; bỏ hẳn header khi chưa có token thay vì
        // gửi "Bearer null".
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        isSuccess: false,
        kind: 'http',
        messageKey: 'error.http',
        messageVars: { status: response.status },
      };
    }

    const data = (await response.json()) as Envelope & T;

    if (data?.isSuccess === false) {
      return {
        isSuccess: false,
        kind: 'rejected',
        message: data.errorMessage,
        messageKey: data.errorMessage ? undefined : 'error.rejected',
        errorCode: data.errorCode,
      };
    }

    return { ...(data as T), isSuccess: true };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      isSuccess: false,
      kind: aborted ? 'timeout' : 'network',
      messageKey: aborted ? 'error.timeout' : 'error.network',
    };
  } finally {
    clearTimeout(timer);
  }
}
