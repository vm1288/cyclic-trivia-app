import { useRouter } from 'expo-router';
import { useIAP, type ProductSubscription, type Purchase } from 'expo-iap';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { assetUrl } from '../src/api/game';
import { fetchStorePlans, submitStorePurchase, type StorePlan, type StorePurchaseResult } from '../src/api/store';
import { apiErrorText } from '../src/i18n/apiError';
import { FormScreen } from '../src/components/FormScreen';
import { NeonButton } from '../src/components/NeonButton';
import { useT } from '../src/i18n/I18nProvider';
import { innerGlow, neon, outerGlow, text } from '../src/theme/colors';

/**
 * PURCHASE - mua license bằng In-App Purchase của store, thay cho luồng web
 * (tạo tài khoản → giữ thẻ Stripe/Razorpay → 7 ngày thử → 30 ngày tự gia hạn).
 * Tony chốt 2026-09-12: "thanh toán dùng in-app purchase từ stores thay vì Stripe
 * hay Razor". Xem TEST_CASES K66.
 *
 * Luồng:
 *   1. `GET /api/store/plans` - gói + chữ của web (`LicensePlan`) + product id store
 *   2. store connected → `fetchProducts` để lấy GIÁ THẬT (theo vùng, do store định)
 *   3. bấm mua → sheet của store (`requestPurchase`, type 'subs')
 *   4. `onPurchaseSuccess` → `POST /api/store/purchase` (server tự hỏi store) → mã 6 số
 *   5. `finishTransaction` rồi sang REGISTER với mã điền sẵn → bước tên/email/OTP như cũ
 *
 * Store không nối được (dev-client chưa lên Play, máy không có Play Services) thì
 * vẫn hiện gói với giá niêm yết của web và nút mua xám. `__DEV__` có nút giả lập
 * để đo đường server → REGISTER ngay cả khi chưa có sản phẩm trên store.
 */

const PLATFORM: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';

/** Offer dùng thử nếu store có (Google: phase đầu paymentMode 'free-trial'; Apple: introductory). */
function trialOffer(sub: ProductSubscription | undefined) {
  const offers = sub?.subscriptionOffers ?? [];
  return offers.find((o) => o.paymentMode === 'free-trial') ?? offers[0] ?? null;
}

export default function PurchaseScreen() {
  const router = useRouter();
  const t = useT();

  const [plans, setPlans] = useState<StorePlan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busySku, setBusySku] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState<StorePurchaseResult | null>(null);
  /** Chặn xử lý cùng một purchase hai lần (store phát lại khi nối lại). */
  const handled = useRef(new Set<string>());

  const storeName = t(PLATFORM === 'ios' ? 'purchase.storeApple' : 'purchase.storeGoogle');

  /*
   * Token gửi server: Android là purchaseToken (server hỏi purchases.subscriptionsv2),
   * iOS là transactionId (App Store Server API). Server trả mã license; chỉ khi server
   * đã ghi mới `finishTransaction` - chưa finish thì store còn phát lại lần mở app sau,
   * ta còn cơ hội đổi mã. Không được finish trước rồi mới gọi server.
   */
  const settle = useCallback(
    async (purchase: Purchase, productId: string) => {
      const token = PLATFORM === 'ios' ? purchase.transactionId : (purchase.purchaseToken ?? '');
      const key = `${productId}:${token}`;
      if (!token || handled.current.has(key)) return;
      handled.current.add(key);

      setVerifying(true);
      const result = await submitStorePurchase({ platform: PLATFORM, productId, token });
      setVerifying(false);
      setBusySku(null);

      if (!result.isSuccess) {
        handled.current.delete(key);
        setNotice(result.kind === 'rejected' ? t('purchase.failed') : t('purchase.notConfirmed'));
        return;
      }
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch {
        // Store không nhận finish thì lần sau nó phát lại; server đã có token, sẽ trả cùng mã.
      }
      setDone(result);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  const { connected, subscriptions, fetchProducts, requestPurchase, finishTransaction, getAvailablePurchases, availablePurchases } =
    useIAP({
      onPurchaseSuccess: (purchase) => {
        const productId = purchase.productId ?? busySku ?? '';
        void settle(purchase, productId);
      },
      onPurchaseError: (error) => {
        setBusySku(null);
        // Người dùng tự đóng sheet của store thì không phải lỗi.
        const cancelled = String(error.code ?? '').toLowerCase().includes('cancel');
        setNotice(cancelled ? t('purchase.cancelled') : (error.message ?? t('purchase.failed')));
      },
      onError: (error) => {
        // fetchProducts / restore hỏng - store không sẵn sàng. Màn vẫn hiện giá web.
        console.warn('[iap]', error.message);
      },
    });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const result = await fetchStorePlans();
      if (!alive) return;
      if (!result.isSuccess) {
        setLoadError(apiErrorText(result, t));
        setPlans([]);
        return;
      }
      setPlans(result.plans);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!connected || !plans?.length) return;
    void fetchProducts({ skus: plans.map((p) => p.productId), type: 'subs' });
  }, [connected, plans, fetchProducts]);

  const storeBySku = useMemo(() => {
    const map = new Map<string, ProductSubscription>();
    /*
     * Play Billing nối được mà sản phẩm chưa có trên Play Console (đo 10:39 12/9:
     * `productStatusAndroid: "not-found"`, `displayPrice: ""`) thì expo-iap vẫn trả
     * MỘT bản ghi rỗng cho mỗi sku. Bản ghi đó không mua được - lọc đi, để màn rơi
     * về giá niêm yết và nút xám như khi store không nối.
     */
    for (const s of subscriptions) {
      const missing = 'productStatusAndroid' in s && s.productStatusAndroid === 'not-found';
      if (!missing && s.displayPrice) map.set(s.id, s);
    }
    return map;
  }, [subscriptions]);

  const buy = async (plan: StorePlan) => {
    if (busySku) return;
    setNotice(null);
    setBusySku(plan.productId);
    const sub = storeBySku.get(plan.productId);
    const offer = trialOffer(sub);
    try {
      await requestPurchase({
        type: 'subs',
        request: {
          google: {
            skus: [plan.productId],
            subscriptionOffers: offer?.offerTokenAndroid ? [{ sku: plan.productId, offerToken: offer.offerTokenAndroid }] : null,
          },
          apple: { sku: plan.productId },
        },
      });
      // Kết quả về qua onPurchaseSuccess / onPurchaseError, không phải ở đây.
    } catch (error) {
      setBusySku(null);
      setNotice(error instanceof Error ? error.message : t('purchase.failed'));
    }
  };

  /*
   * Restore: cài lại app / máy mới cùng tài khoản store. Store trả các giao dịch còn
   * hiệu lực; gửi từng cái lên server - token đã có thì server trả lại đúng mã cũ.
   */
  const restore = async () => {
    setNotice(null);
    setBusySku('restore');
    try {
      await getAvailablePurchases();
    } finally {
      setBusySku(null);
    }
  };
  useEffect(() => {
    if (busySku !== 'restore' && availablePurchases.length === 0) return;
    if (availablePurchases.length === 0) {
      setNotice(t('purchase.nothingToRestore'));
      return;
    }
    for (const purchase of availablePurchases) {
      const productId = purchase.productId;
      if (productId && plans?.some((p) => p.productId === productId)) void settle(purchase, productId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availablePurchases]);

  /** `__DEV__`: đo đường server → REGISTER khi chưa có sản phẩm trên store (server ở chế độ tin token). */
  const simulate = async (plan: StorePlan) => {
    setNotice(null);
    setVerifying(true);
    const result = await submitStorePurchase({ platform: PLATFORM, productId: plan.productId, token: `dev-${Date.now()}` });
    setVerifying(false);
    if (!result.isSuccess) {
      setNotice(apiErrorText(result, t));
      return;
    }
    setDone(result);
  };

  const goRegister = () => {
    if (!done) return;
    router.replace({ pathname: '/register', params: { code: done.code } });
  };

  if (done) {
    return (
      <FormScreen title={t('purchase.successTitle')}>
        <View style={styles.doneCard}>
          <Text style={styles.doneCode}>{done.code}</Text>
          <Text style={styles.doneBody}>
            {t(done.restored ? 'purchase.successRestored' : 'purchase.successBody', { code: done.code })}
          </Text>
        </View>
        <NeonButton label={t('purchase.continue')} color={neon.green} onPress={goRegister} />
      </FormScreen>
    );
  }

  return (
    <FormScreen title={t('purchase.title')} subtitle={t('purchase.subtitle', { store: storeName })}>
      {plans === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={neon.blue.stroke} />
          <Text style={styles.muted}>{t('purchase.loading')}</Text>
        </View>
      ) : plans.length === 0 ? (
        <Text style={styles.muted}>{loadError ?? t('purchase.noPlans')}</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {!connected || storeBySku.size === 0 ? <Text style={styles.hint}>{t('purchase.storeOffline')}</Text> : null}
          {plans.map((plan) => {
            const sub = storeBySku.get(plan.productId);
            const storePrice = sub?.displayPrice ?? null;
            const price = storePrice ?? `${plan.currency} ${plan.price}`;
            const canBuy = !!sub && connected && !busySku;
            return (
              <View key={plan.productId} style={styles.card}>
                <View style={styles.cardHead}>
                  {plan.sponsorIconUrl ? (
                    <Image source={{ uri: assetUrl(plan.sponsorIconUrl) }} style={styles.icon} resizeMode="contain" accessibilityIgnoresInvertColors />
                  ) : null}
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{plan.title}</Text>
                    {plan.isSubscription ? (
                      <>
                        {plan.trialDays > 0 ? <Text style={styles.cardTrial}>{t('purchase.trial', { days: plan.trialDays })}</Text> : null}
                        <Text style={styles.cardPrice}>
                          {t(plan.trialDays > 0 ? 'purchase.thenPerMonth' : 'purchase.perMonth', { price })}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.cardPrice}>{t('purchase.oneOff', { price, days: plan.durationDays })}</Text>
                    )}
                    <Text style={styles.cardMeta}>
                      {t(plan.maxDevices === 1 ? 'purchase.devices' : 'purchase.devices_plural', { count: plan.maxDevices })}
                    </Text>
                  </View>
                </View>
                <NeonButton
                  label={t(plan.trialDays > 0 ? 'purchase.buy' : 'purchase.buyNoTrial')}
                  color={neon.orange}
                  onPress={() => void buy(plan)}
                  busy={busySku === plan.productId || verifying}
                  disabled={!canBuy}
                />
                {__DEV__ ? (
                  <Pressable onPress={() => void simulate(plan)} style={styles.devBtn} accessibilityRole="button">
                    <Text style={styles.devText}>{t('purchase.devSimulate')}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {verifying ? <Text style={styles.muted}>{t('purchase.verifying')}</Text> : null}

          <Pressable onPress={() => void restore()} disabled={!connected || !!busySku} style={styles.restore} accessibilityRole="button">
            <Text style={[styles.restoreText, (!connected || !!busySku) && styles.dim]}>{t('purchase.restore')}</Text>
          </Pressable>
        </ScrollView>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  muted: { color: text.muted, fontSize: 13, textAlign: 'center' },
  hint: { color: text.muted, fontSize: 12, textAlign: 'center', marginBottom: 2 },
  list: { gap: 12, paddingBottom: 8 },
  card: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: neon.blue.stroke,
    backgroundColor: '#0A0810',
    boxShadow: `${outerGlow(neon.blue)}, ${innerGlow(neon.blue)}`,
    padding: 14,
    gap: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 64, height: 64 },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { color: text.primary, fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  cardTrial: { color: '#FFE7A8', fontSize: 14, fontWeight: '700' },
  cardPrice: { color: text.primary, fontSize: 14 },
  cardMeta: { color: text.muted, fontSize: 12 },
  devBtn: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 10 },
  devText: { color: '#FF3B52', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  notice: { color: '#FF8A9A', fontSize: 13, textAlign: 'center' },
  restore: { alignSelf: 'center', paddingVertical: 8 },
  restoreText: { color: neon.blue.stroke, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  dim: { opacity: 0.4 },
  doneCard: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: neon.green.stroke,
    backgroundColor: '#0A0810',
    boxShadow: `${outerGlow(neon.green)}, ${innerGlow(neon.green)}`,
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  doneCode: { color: neon.green.mid, fontSize: 36, fontWeight: '800', letterSpacing: 6, fontVariant: ['tabular-nums'] },
  doneBody: { color: text.primary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
