import type { ApiFailure } from '../api/client';
import type { TranslationKey } from './translations';

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/**
 * Đổi một lỗi API thành câu hiển thị được.
 *
 * Lỗi nghiệp vụ giữ nguyên câu của server (chỉ server mới biết lý do cụ thể);
 * lỗi kết nối thì dịch theo ngôn ngữ đang dùng.
 *
 * LƯU Ý: câu của server hiện đang là tiếng Anh - nó đi qua `IStringLocalizer`
 * nhưng hệ localize trong DB gần như trống nên trả lại chính khoá tiếng Anh.
 * Muốn server nói được tiếng Việt thì phải bổ sung bản dịch trong DB và cho
 * app gửi kèm header ngôn ngữ; đó là việc riêng, chưa làm.
 */
export function apiErrorText(failure: ApiFailure, t: Translate): string {
  if (failure.message) return failure.message;
  if (failure.messageKey) return t(failure.messageKey, failure.messageVars);
  return t('error.rejected');
}
