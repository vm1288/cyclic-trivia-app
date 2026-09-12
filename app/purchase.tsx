import { useRouter } from 'expo-router';
import { useIAP, type ProductSubscription, type Purchase } from 'expo-iap';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { assetUrl } from '../src/api/game';
import { fetchStorePlans, submitStorePurchase, type StorePlan, type StorePurchaseResult } from '../src/api/store';
import { apiErrorText } from '../src/i18n/apiError';
import { FormScreen } from '../src/components/FormScreen';
import { NeonButton } from '../src/components/NeonButton';
import { StageBackground } from '../src/components/StageBackground';
import { useT } from '../src/i18n/I18nProvider';
import { bg, innerGlow, neon, outerGlow, text } from '../src/theme/colors';

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

  /*
   * Bố cục "C - hàng gọn" (Tony chọn 2026-09-12 sau bản phác): toàn bề ngang, mỗi bộ
   * một hàng logo · tên + mô tả · giá · nút, ba bộ vừa màn ngang không cuộn. Không dùng
   * `FormScreen` vì khuôn hai cột của nó chỉ chừa 60% bề ngang cho danh sách.
   */
  return (
    <View style={styles.root}>
      <StageBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.body}>
          <Pressable
            style={styles.back}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color={text.primary} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>

          <Text style={styles.title}>{t('purchase.title')}</Text>
          <Text style={styles.subtitle}>
            {!connected || storeBySku.size === 0 ? t('purchase.storeOffline') : t('purchase.subtitle', { store: storeName })}
          </Text>

          {plans === null ? (
            <View style={styles.center}>
              <ActivityIndicator color={neon.blue.stroke} />
              <Text style={styles.muted}>{t('purchase.loading')}</Text>
            </View>
          ) : plans.length === 0 ? (
            <Text style={styles.muted}>{loadError ?? t('purchase.noPlans')}</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} style={styles.scroll}>
              {plans.map((plan) => {
                const sub = storeBySku.get(plan.productId);
                const price = sub?.displayPrice ?? `${plan.currency} ${plan.price}`;
                const canBuy = !!sub && connected && !busySku;
                const meta = [
                  plan.trialDays > 0 ? t('purchase.trial', { days: plan.trialDays }) : null,
                  t(plan.maxDevices === 1 ? 'purchase.devices' : 'purchase.devices_plural', { count: plan.maxDevices }),
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <View key={plan.productId} style={styles.row}>
                    {plan.sponsorIconUrl ? (
                      <Image source={{ uri: assetUrl(plan.sponsorIconUrl) }} style={styles.icon} resizeMode="contain" accessibilityIgnoresInvertColors />
                    ) : (
                      <View style={styles.icon} />
                    )}
                    <View style={styles.nameCol}>
                      <Text style={styles.name} numberOfLines={1}>
                        {plan.title}
                      </Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {meta}
                      </Text>
                    </View>
                    <View style={styles.priceCol}>
                      <Text style={styles.price} numberOfLines={1}>
                        {price}
                      </Text>
                      <Text style={styles.priceSub} numberOfLines={1}>
                        {plan.isSubscription
                          ? plan.trialDays > 0
                            ? t('purchase.afterTrial', { days: plan.trialDays })
                            : t('purchase.perMonthShort')
                          : t('purchase.forDays', { days: plan.durationDays })}
                      </Text>
                    </View>
                    <View style={styles.btnCol}>
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
                  </View>
                );
              })}
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              {verifying ? <Text style={styles.muted}>{t('purchase.verifying')}</Text> : null}
            </ScrollView>
          )}

          <View style={styles.bottom}>
            <Text style={styles.fine} numberOfLines={2}>
              {t('purchase.renews', { store: storeName })}
            </Text>
            <Pressable onPress={() => void restore()} disabled={!connected || !!busySku} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.restoreText, (!connected || !!busySku) && styles.dim]}>{t('purchase.restore')}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: bg.deep },
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 20 },
  back: {
    position: 'absolute',
    top: 8,
    left: 12,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 12,
    gap: 2,
  },
  backText: { color: text.primary, fontSize: 16 },
  title: {
    marginTop: 10,
    color: text.primary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subtitle: { color: text.muted, fontSize: 12.5, textAlign: 'center', marginTop: 2, marginBottom: 8 },

  center: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  muted: { color: text.muted, fontSize: 13, textAlign: 'center' },
  scroll: { flex: 1 },
  list: { gap: 8, paddingBottom: 4 },

  /** Một hàng = một bộ: logo · tên + mô tả · giá · nút. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.6,
    borderColor: 'rgba(58,165,255,0.45)',
    backgroundColor: '#0A0810',
  },
  icon: { width: 44, height: 44 },
  nameCol: { flex: 1, minWidth: 0 },
  name: { color: text.primary, fontSize: 17, fontWeight: '800', letterSpacing: 0.8 },
  meta: { color: text.muted, fontSize: 12 },
  priceCol: { alignItems: 'flex-end', minWidth: 96 },
  price: { color: neon.orange.mid, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  priceSub: { color: text.muted, fontSize: 11 },
  /** `alignItems` mặc định (stretch) - NeonButton lấy bề ngang từ cha, đặt `center` là nó co thành cục. */
  btnCol: { width: 200 },
  devBtn: { paddingTop: 2, alignSelf: 'center' },
  devText: { color: '#FF3B52', fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  notice: { color: '#FF8A9A', fontSize: 13, textAlign: 'center' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 6, paddingBottom: 10 },
  fine: { flex: 1, color: 'rgba(255,255,255,0.32)', fontSize: 11 },
  restoreText: { color: neon.blue.stroke, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
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
