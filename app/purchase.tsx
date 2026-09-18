import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIAP, type ProductSubscription, type Purchase } from 'expo-iap';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { assetUrl } from '../src/api/game';
import { fetchStoreGames, fetchStorePlans, submitStorePurchase, type StoreGame, type StorePlan, type StorePurchaseResult } from '../src/api/store';
import { GameInfoDialog, type GameInfo } from '../src/components/GameInfoDialog';
import { useLicense } from '../src/session/LicenseSession';
import { apiErrorText } from '../src/i18n/apiError';
import { FormScreen } from '../src/components/FormScreen';
import { NeonButton } from '../src/components/NeonButton';
import { StageBackground } from '../src/components/StageBackground';
import { useT } from '../src/i18n/I18nProvider';
import { usePlayer } from '../src/session/PlayerSession';
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
  const player = usePlayer();
  const license = useLicense();
  /*
   * K109: `?trialFor=<sponsorId>` - tới từ tấm "7-day free trial" (PROCEED) ở JOIN A MATCH: tự
   * bấm mua gói có kỳ dùng thử của game đó ngay khi store trả giá, không bắt chọn lại.
   */
  const params = useLocalSearchParams<{ trialFor?: string; autoBuy?: string }>();
  /* K110: `?autoBuy=<sponsorId>` (tấm UNLOCK NOW) - như trialFor nhưng không đòi gói có dùng thử. */
  const autoFor = params.trialFor ?? params.autoBuy;
  const autoBought = useRef(false);

  const [plans, setPlans] = useState<StorePlan[] | null>(null);
  /** K111: lưới game (sponsor) - kể cả game chưa bán ("Coming Soon"). */
  const [games, setGames] = useState<StoreGame[] | null>(null);
  const [openGame, setOpenGame] = useState<StoreGame | null>(null);
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
      const result = await submitStorePurchase({
        platform: PLATFORM,
        productId,
        token,
        deviceId: player.status === 'ready' ? player.deviceId : undefined,
      });
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
      const [result, gamesResult] = await Promise.all([fetchStorePlans(), fetchStoreGames()]);
      if (!alive) return;
      if (!result.isSuccess) {
        setLoadError(apiErrorText(result, t));
        setPlans([]);
      } else {
        setPlans(result.plans);
      }
      if (!gamesResult.isSuccess) {
        setLoadError((e) => e ?? apiErrorText(gamesResult, t));
        setGames([]);
      } else {
        setGames(gamesResult.games);
      }
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

  useEffect(() => {
    if (autoBought.current || !autoFor || !plans?.length || storeBySku.size === 0) return;
    const plan = plans
      .filter((p) => p.sponsorId.toLowerCase() === String(autoFor).toLowerCase() && (!params.trialFor || p.trialDays > 0) && storeBySku.has(p.productId))
      .sort((a, b) => b.durationDays - a.durationDays)[0];
    if (!plan) return;
    autoBought.current = true;
    // Tài khoản store đã dùng thử rồi thì store không đưa offer free-trial - báo trước khi mở sheet.
    if (params.trialFor && trialOffer(storeBySku.get(plan.productId))?.paymentMode !== 'free-trial') setNotice(t('purchase.trialUsedStore'));
    void buy(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFor, plans, storeBySku]);

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

  /** Máy đã mua / đang dùng thử game này (có license đã kích hoạt cùng sponsor). */
  const ownedGame = (g: StoreGame | null) =>
    !!g &&
    license.all.some(
      (s) => s.activated && ((s.sponsorId ?? '').toLowerCase() === g.sponsorId.toLowerCase() || (!s.sponsorId && s.sponsorName === g.name)),
    );

  /** NEW MATCH từ tấm giới thiệu: chuyển sang license của game đó rồi vào NEW MATCH (như My Games). */
  const newMatchFor = async (g: StoreGame) => {
    const s = license.all.find(
      (x) => x.activated && ((x.sponsorId ?? '').toLowerCase() === g.sponsorId.toLowerCase() || (!x.sponsorId && x.sponsorName === g.name)),
    );
    if (!s) return;
    setOpenGame(null);
    if (license.status !== 'active' || license.session.hostId !== s.hostId) await license.switchTo(s.hostId);
    license.setCurrentGame(null);
    router.push('/new-game');
  };

  const openPlan = openGame ? (plans ?? []).find((p) => p.productId === openGame.productId) ?? null : null;
  const openInfo: GameInfo | null = openGame
    ? {
        sponsorId: openGame.sponsorId,
        gameName: openGame.name,
        logoUrl: openGame.logoUrl,
        tagline: openGame.tagline,
        description: openGame.description,
        players: openGame.players,
        ageRange: openGame.ageRange,
        price: openGame.price,
        currency: openGame.currency,
        durationDays: openGame.durationDays,
      }
    : null;

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
   * K111 (Tony 18/9, ảnh mẫu 3): EXPLORE GAMES = lưới game (logo + tagline), game chưa bán có dải
   * "Coming Soon". Chạm một game → tấm giới thiệu (`GameInfoDialog`, ảnh mẫu 4): NEW MATCH khi máy
   * đã mua / đang dùng thử game đó, PURCHASE ($XX per month) khi chưa - mua ngay trong tấm bằng
   * sheet của store (logic IAP ở trên giữ nguyên). Thay bố cục "hàng gọn" K66.
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

          <Text style={styles.title}>{t('explore.title')}</Text>

          {games === null ? (
            <View style={styles.center}>
              <ActivityIndicator color={neon.blue.stroke} />
              <Text style={styles.muted}>{t('explore.loading')}</Text>
            </View>
          ) : games.length === 0 ? (
            <Text style={styles.muted}>{loadError ?? t('explore.none')}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grid} style={styles.scroll}>
              {games.map((g) => (
                <Pressable key={g.sponsorId} onPress={() => setOpenGame(g)} accessibilityRole="button" style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                  <View style={styles.logoBox}>
                    {g.logoUrl ? <Image source={{ uri: assetUrl(g.logoUrl) }} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
                    {!g.available ? (
                      <View style={styles.ribbonWrap} pointerEvents="none">
                        <View style={styles.ribbon}>
                          <Text style={styles.ribbonText}>{t('games.comingSoon')}</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.tagline}>{g.tagline}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {notice && !openGame ? <Text style={styles.notice}>{notice}</Text> : null}
          {verifying ? <Text style={styles.muted}>{t('purchase.verifying')}</Text> : null}

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

      <GameInfoDialog
        info={openInfo}
        cta={
          !openGame
            ? { kind: 'comingSoon' }
            : ownedGame(openGame)
              ? { kind: 'newMatch', onPress: () => void newMatchFor(openGame) }
              : openGame.available && openPlan
                ? {
                    kind: 'purchase',
                    onPress: () => void buy(openPlan),
                    busy: busySku === openPlan.productId || verifying,
                    disabled: !storeBySku.has(openPlan.productId) || !connected,
                  }
                : { kind: 'comingSoon' }
        }
        storePrice={openPlan ? (storeBySku.get(openPlan.productId)?.displayPrice ?? null) : null}
        notice={openGame && openGame.available && openPlan && (!connected || !storeBySku.has(openPlan.productId)) ? t('purchase.storeOffline') : notice}
        onClose={() => setOpenGame(null)}
      >
        {__DEV__ && openPlan && openGame && !ownedGame(openGame) ? (
          <Pressable onPress={() => void simulate(openPlan)} style={styles.devBtn} accessibilityRole="button">
            <Text style={styles.devText}>{t('purchase.devSimulate')}</Text>
          </Pressable>
        ) : null}
      </GameInfoDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: bg.deep },
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 20 },
  pressed: { opacity: 0.8 },
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
  title: { marginTop: 10, color: text.primary, fontSize: 24, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center' },

  center: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  muted: { color: text.muted, fontSize: 13, textAlign: 'center' },
  scroll: { flex: 1 },
  /** Lưới ngang: ba game vừa một màn, nhiều hơn thì cuộn ngang. */
  grid: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 26, paddingHorizontal: 10, paddingVertical: 8 },
  card: { width: 210, alignItems: 'center', gap: 10 },
  logoBox: { width: 190, height: 160, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 180, height: 150 },
  tagline: { color: text.primary, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  /* Dải "Coming Soon" đỏ chéo góc trên trái như ảnh mẫu. */
  ribbonWrap: { position: 'absolute', top: 0, left: 0, width: 120, height: 120, overflow: 'hidden' },
  ribbon: {
    position: 'absolute',
    top: 24,
    left: -38,
    width: 170,
    paddingVertical: 4,
    backgroundColor: '#D9262E',
    transform: [{ rotate: '-45deg' }],
    alignItems: 'center',
  },
  ribbonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  notice: { color: '#FFD166', fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  devBtn: { marginTop: 6, paddingVertical: 4, paddingHorizontal: 8 },
  devText: { color: 'rgba(255,255,255,0.45)', fontSize: 11, textDecorationLine: 'underline' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
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
