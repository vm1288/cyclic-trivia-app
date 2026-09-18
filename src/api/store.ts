import { postJson, type ApiResult } from './client';
import { API_BASE_URL, API_TIMEOUT_MS } from './config';

/**
 * Mua license bằng In-App Purchase của store (Google Play / App Store) - thay cho
 * Stripe/Razorpay của bản web (Tony chốt 2026-09-12, K66).
 *
 * Hai lời gọi, cả hai ở `/api` (JSON, không token - người mua chưa có license):
 *   GET  /api/store/plans      gói bán, chữ từ `LicensePlan` của web + product id trên store
 *   POST /api/store/purchase   token store sau khi mua -> server hỏi store -> mã license 6 số
 */

export type StorePlan = {
  productId: string;
  planId: string;
  planCode: string;
  title: string;
  durationDays: number;
  maxDevices: number;
  isSubscription: boolean;
  trialDays: number;
  /** Giá niêm yết của web - chỉ hiện khi store chưa trả giá. */
  listPrice: number;
  price: number;
  currency: string;
  sponsorId: string;
  sponsorName: string | null;
  /** Đường dẫn tương đối, phải qua `assetUrl`. */
  sponsorIconUrl: string | null;
};

export async function fetchStorePlans(): Promise<ApiResult<{ plans: StorePlan[] }>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/api/store/plans`, { signal: controller.signal });
    const body = (await response.json().catch(() => null)) as { isSuccess?: boolean; plans?: StorePlan[] } | null;
    if (!response.ok || !body?.isSuccess) {
      return { isSuccess: false, kind: 'http', message: `HTTP ${response.status}` };
    }
    return { isSuccess: true, plans: body.plans ?? [] };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return { isSuccess: false, kind: aborted ? 'timeout' : 'network', messageKey: aborted ? 'error.timeout' : 'error.network' };
  } finally {
    clearTimeout(timer);
  }
}

export type StorePurchaseResult = {
  /** Mã license 6 số - đưa vào REGISTER như mã mua trên web. */
  code: string;
  expiresAt: string | null;
  isActivated: boolean;
  /** Token này đã đổi mã trước đó (cài lại app / restore). */
  restored: boolean;
};

export function submitStorePurchase(args: {
  platform: 'android' | 'ios';
  productId: string;
  /** Android: purchaseToken. iOS: transactionId. */
  token: string;
  buyerName?: string;
  buyerEmail?: string;
  /** K109: id máy (PlayerSession) - server ghi vào Payment để biết máy đã dùng thử game này. */
  deviceId?: string;
}): Promise<ApiResult<StorePurchaseResult>> {
  return postJson<StorePurchaseResult>('/api/store/purchase', args);
}
