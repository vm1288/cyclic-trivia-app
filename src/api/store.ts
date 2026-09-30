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

/** K111 EXPLORE GAMES: một game (sponsor) - có bán hay "Coming Soon", chữ giới thiệu từ `GameCatalog` server. */
export type StoreGame = {
  sponsorId: string;
  name: string;
  logoUrl: string | null;
  available: boolean;
  productId: string | null;
  trialDays: number;
  price: number;
  currency: string | null;
  durationDays: number;
  /** K112: máy này đã bắt đầu dùng thử game này (server tra Payment theo deviceId). */
  trialUsed: boolean;
  tagline: string;
  prompt: string;
  description: string;
  players: string;
  ageRange: string;
};

export async function fetchStoreGames(deviceId?: string | null): Promise<ApiResult<{ games: StoreGame[] }>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const q = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
    const response = await fetch(`${API_BASE_URL}/api/store/games${q}`, { signal: controller.signal });
    const body = (await response.json().catch(() => null)) as { isSuccess?: boolean; games?: StoreGame[] } | null;
    if (!response.ok || !body?.isSuccess) return { isSuccess: false, kind: 'http', message: `HTTP ${response.status}` };
    return { isSuccess: true, games: body.games ?? [] };
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
  /**
   * K112: app gửi `deviceId` → server kích hoạt luôn và trả phiên (cùng hình ActivationCodeCheck)
   * → app `license.save` rồi "You're ready to play!". Null = server cũ / hết suất máy → báo purchase.maxDevicesHint (K150: không còn màn REGISTER).
   */
  session?: {
    token: string;
    expiresAt: string | null;
    deviceId: string;
    hostId: string;
    licenseCode: string;
    languageCode: string | null;
    sponsorLogoUrl: string | null;
    sponsorName: string | null;
    sponsorId: string | null;
    planTitle: string | null;
    licenseExpiresAt: string | null;
  } | null;
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
