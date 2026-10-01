import { fetchProducts, initConnection, type ProductSubscription } from 'expo-iap';

/**
 * Store còn mời tài khoản này dùng thử gói `productId` không (Tony 1/10, lỗi JOIN số 4).
 *
 * Server chỉ biết "máy này đã dùng thử chưa" qua Payment của CHÍNH NÓ (`FreeJoinRule.TrialUsedAsync`,
 * theo `device:{id}`) - dùng thử trên máy khác, hoặc lúc mua chưa có id máy, là server vẫn bảo
 * "còn". Store mới là bên quyết: Play bỏ hẳn offer `free-trial` khỏi danh sách khi tài khoản đã
 * tiêu nó (cùng điều K126 dựa vào ở màn mua).
 *
 * @returns `true`  = store xác nhận HẾT dùng thử → hiện tấm UNLOCK NOW thay vì 7-DAY FREE TRIAL.
 *          `false` = store còn offer dùng thử.
 *          `null`  = không biết (store chưa nối được, gói chưa có trên store, quá giờ) → đừng kết
 *                    luận gì, giữ nguyên lời server.
 */
export async function storeTrialGone(productId: string, timeoutMs = 5000): Promise<boolean | null> {
  const work = (async () => {
    await initConnection();
    const products = (await fetchProducts({ skus: [productId], type: 'subs' })) as ProductSubscription[] | null;
    const sub = (products ?? []).find((p) => p.id === productId);
    if (!sub) return null;
    // Play trả bản ghi rỗng cho sku chưa có trên store (xem purchase.tsx) - không kết luận gì.
    if ('productStatusAndroid' in sub && sub.productStatusAndroid === 'not-found') return null;
    const offers = sub.subscriptionOffers ?? [];
    return !offers.some((o) => o.paymentMode === 'free-trial');
  })();
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  try {
    return await Promise.race([work, timeout]);
  } catch {
    return null;
  }
}
