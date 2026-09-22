import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIAP, type ProductSubscription, type Purchase } from 'expo-iap';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, LogBox, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// Dev-client không có Play Billing: expo-iap tự console.error mỗi lần hỏi giá - chỉ là LogBox dev, che đi.
LogBox.ignoreLogs(['[Expo-IAP]', '[expo-iap]']);
import { SafeAreaView } from 'react-native-safe-area-context';

import { assetUrl } from '../src/api/game';
import { fetchStoreGames, fetchStorePlans, submitStorePurchase, type StoreGame, type StorePlan, type StorePurchaseResult } from '../src/api/store';
import { FreeTrialDialog, type TrialInfo } from '../src/components/FreeTrialDialog';
import { GameInfoDialog, type GameInfo } from '../src/components/GameInfoDialog';
import { NeonSheet, SheetButton } from '../src/components/NeonSheet';
import { useLicense } from '../src/session/LicenseSession';
import { downloadSponsorLogo } from '../src/session/sponsorLogo';
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
  /** K112: TRY {GAME} → tấm giải thích dùng thử (bước 2 của FreeTrialDialog) → PROCEED → mua. */
  const [trialFor, setTrialFor] = useState<{ info: TrialInfo; plan: StorePlan } | null>(null);
  const [trialNotice, setTrialNotice] = useState<string | null>(null);
  /** `onPurchaseError` được tạo trước `restore`; giữ qua ref để gọi lại (K126). */
  const restoreRef = useRef<() => Promise<void>>(async () => {});
  /** K112: mua xong + server kích hoạt luôn → "You're ready to play!" (logo, NEW MATCH / JOIN A MATCH). */
  const [ready, setReady] = useState<StoreGame | null>(null);
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
        const msg = result.kind === 'rejected' ? t('purchase.failed') : t('purchase.notConfirmed');
        setNotice(msg);
        // K126: tấm dùng thử KHÔNG tự đóng khi mua hỏng - thiếu dòng này thì người dùng thấy
        // PROCEED hết quay rồi đứng im, lời báo lỗi nằm ở màn phía sau (Tony: "stuck tại Proceed").
        setTrialNotice(msg);
        return;
      }
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch {
        // Store không nhận finish thì lần sau nó phát lại; server đã có token, sẽ trả cùng mã.
      }
      // Qua ref: `settle` được tạo một lần (deps [t]), landPurchase thì đổi theo games/license.
      await landRef.current(result);
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
        /*
         * K126: đã có gói còn hiệu lực trên tài khoản store (mua rồi mà server chưa đổi ra mã,
         * hoặc cài lại app) - store từ chối mua lần nữa. Đừng bắt người dùng tự tìm "Restore
         * purchases": lấy luôn giao dịch đang có và gửi lên server, cùng đường với nút đó.
         */
        if (String(error.code ?? '').toLowerCase().includes('already')) {
          void restoreRef.current();
          return;
        }
        // Người dùng tự đóng sheet của store thì không phải lỗi.
        const cancelled = String(error.code ?? '').toLowerCase().includes('cancel');
        const msg = cancelled ? t('purchase.cancelled') : (error.message ?? t('purchase.failed'));
        setNotice(msg);
        setTrialNotice(msg);
      },
      onError: (error) => {
        // fetchProducts / restore hỏng - store không sẵn sàng. Màn vẫn hiện giá web.
        console.warn('[iap]', error.message);
      },
    });

  /**
   * K112: server trả `session` (đã kích hoạt cho máy này) → lưu license, hiện "You're ready to
   * play!"; không có (server cũ / hết suất máy) → màn mã + REGISTER như K66.
   */
  const landPurchase = async (result: StorePurchaseResult) => {
    const s = result.session;
    if (!s?.token) {
      setDone(result);
      return;
    }
    const sponsorLogoUri = s.sponsorLogoUrl ? await downloadSponsorLogo(s.sponsorLogoUrl) : null;
    await license.save({
      token: s.token,
      expiresAt: s.expiresAt ?? null,
      deviceId: s.deviceId,
      hostId: s.hostId,
      licenseCode: s.licenseCode,
      activated: true,
      languageCode: s.languageCode ?? null,
      sponsorName: s.sponsorName ?? null,
      sponsorId: s.sponsorId ?? null,
      planTitle: s.planTitle ?? null,
      licenseExpiresAt: s.licenseExpiresAt ?? null,
      sponsorLogoUri,
    });
    setOpenGame(null);
    setTrialFor(null);
    setTrialNotice(null);
    const g = (games ?? []).find((x) => x.sponsorId.toLowerCase() === (s.sponsorId ?? '').toLowerCase()) ?? null;
    setReady(
      g ?? {
        sponsorId: s.sponsorId ?? '',
        name: s.sponsorName ?? '',
        logoUrl: s.sponsorLogoUrl,
        available: true,
        productId: null,
        trialDays: 0,
        price: 0,
        currency: null,
        durationDays: 0,
        trialUsed: true,
        tagline: '',
        prompt: '',
        description: '',
        players: '',
        ageRange: '',
      },
    );
  };

  const landRef = useRef(landPurchase);
  landRef.current = landPurchase;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [result, gamesResult] = await Promise.all([
        fetchStorePlans(),
        fetchStoreGames(player.status === 'ready' ? player.deviceId : null),
      ]);
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
    // Store chưa sẵn sàng (dev-client, máy không có Play) thì hứa bị từ chối - nuốt, màn rơi về giá web.
    void fetchProducts({ skus: plans.map((p) => p.productId), type: 'subs' }).catch(() => {});
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
      const msg = error instanceof Error ? error.message : t('purchase.failed');
      setNotice(msg);
      setTrialNotice(msg);
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
  /*
   * K126 (Tony 22/9): CHỈ store biết tài khoản còn được dùng thử hay không - Play bỏ hẳn offer
   * `free-trial` khỏi danh sách khi tài khoản đã tiêu nó. Server chỉ biết licence của CHÍNH NÓ
   * (`trialUsed`), nên thiếu kiểm này thì app vẫn mời "7-day free trial" rồi Play tính tiền ngay.
   * Store chưa nối được (dev-client, máy không có Play) thì không kết luận gì - giữ nguyên nút TRY.
   */
  const storeTrialGone = (productId: string) =>
    connected && storeBySku.has(productId) && trialOffer(storeBySku.get(productId))?.paymentMode !== 'free-trial';

  const restore = async () => {
    setNotice(null);
    setTrialNotice(null);
    setBusySku('restore');
    try {
      await getAvailablePurchases();
    } finally {
      setBusySku(null);
    }
  };
  restoreRef.current = restore;
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
    const result = await submitStorePurchase({
      platform: PLATFORM,
      productId: plan.productId,
      token: `dev-${Date.now()}`,
      deviceId: player.status === 'ready' ? player.deviceId : undefined,
    });
    setVerifying(false);
    if (!result.isSuccess) {
      setNotice(apiErrorText(result, t));
      return;
    }
    await landPurchase(result);
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
  const trialInfoFor = (g: StoreGame, plan: StorePlan): TrialInfo => ({
    days: g.trialDays,
    durationDays: plan.durationDays,
    sponsorId: g.sponsorId,
    gameName: g.name,
    logoUrl: g.logoUrl,
  });
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
        comingSoon: !openGame.available,
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
                <Pressable
                  key={g.sponsorId}
                  onPress={() => setOpenGame(g)}
                  // K114 (Tony 19/9): game Coming Soon chưa mua/dùng thử được → mờ + không bấm (trừ khi máy đã có license của nó).
                  disabled={!g.available && !ownedGame(g)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !g.available && !ownedGame(g) }}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed, !g.available && !ownedGame(g) && styles.cardOff]}
                >
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
            ? { kind: 'none' }
            : ownedGame(openGame)
              ? { kind: 'newMatch', onPress: () => void newMatchFor(openGame) }
              : openGame.available && openPlan
                ? !openGame.trialUsed && openGame.trialDays > 0 && !storeTrialGone(openPlan.productId)
                  ? {
                      // K112 (ảnh mẫu 2): chưa dùng thử → TRY {GAME} → tấm giải thích → PROCEED → mua có dùng thử.
                      kind: 'try',
                      days: openGame.trialDays,
                      gameName: openGame.name,
                      onPress: () => setTrialFor({ info: trialInfoFor(openGame, openPlan), plan: openPlan }),
                      busy: busySku === openPlan.productId || verifying,
                    }
                  : {
                      kind: 'purchase',
                      onPress: () => void buy(openPlan),
                      busy: busySku === openPlan.productId || verifying,
                      disabled: !storeBySku.has(openPlan.productId) || !connected,
                    }
                : { kind: 'none' }
        }
        storePrice={openPlan ? (storeBySku.get(openPlan.productId)?.displayPrice ?? null) : null}
        notice={
          openGame && !ownedGame(openGame) && openGame.available && openPlan
            ? !connected || !storeBySku.has(openPlan.productId)
              ? t('purchase.storeOffline')
              : // K126: đáng lẽ được dùng thử theo server, nhưng store nói tài khoản đã tiêu offer.
                !openGame.trialUsed && openGame.trialDays > 0 && storeTrialGone(openPlan.productId)
                ? t('purchase.trialUsedStore')
                : notice
            : notice
        }
        onClose={() => setOpenGame(null)}
      >
        {__DEV__ && openPlan && openGame && !ownedGame(openGame) ? (
          <Pressable onPress={() => void simulate(openPlan)} style={styles.devBtn} accessibilityRole="button">
            <Text style={styles.devText}>{t('purchase.devSimulate')}</Text>
          </Pressable>
        ) : null}
      </GameInfoDialog>

      {/* K112: TRY {GAME} → tấm giải thích dùng thử (ảnh mẫu 3) → PROCEED → sheet store (offer free-trial). */}
      <FreeTrialDialog
        info={trialFor?.info ?? null}
        total={3}
        initialStep={2}
        onClose={() => setTrialFor(null)}
        busy={!!trialFor && (busySku === trialFor.plan.productId || verifying)}
        notice={trialFor ? trialNotice : null}
        onProceed={() => {
          /*
           * K114: KHÔNG đóng tấm - mở sheet store ngay trên nó. Store chưa sẵn sàng (dev-client, máy
           * không có Play) thì báo tại chỗ; thành công thì `landPurchase` đóng tấm và hiện "You're ready".
           */
          const plan = trialFor?.plan;
          if (!plan) return;
          if (!connected || !storeBySku.has(plan.productId)) {
            setTrialNotice(t('purchase.storeNotReady', { store: storeName }));
            return;
          }
          setTrialNotice(null);
          void buy(plan);
        }}
      />

      {/* K112: mua xong, đã kích hoạt cho máy → "You're ready to play!" (ảnh mẫu 3 dưới). */}
      {/* ✕ = về Home (ảnh mẫu ghi "‹ Back to Home"; Tony 19/9 chốt ✕ góc ngoài mép cho tấm kiểu này). */}
      <NeonSheet visible={ready !== null} onClose={() => router.replace('/')} maxWidth={900} style={styles.readyCard} closeButton>
        <View style={styles.readyRow}>
          <View style={styles.readyLogoCol}>
            {ready?.logoUrl ? <Image source={{ uri: assetUrl(ready.logoUrl) }} style={styles.readyLogo} resizeMode="contain" /> : null}
            {ready?.tagline ? <Text style={styles.readyTagline}>{ready.tagline}</Text> : null}
          </View>
          <View style={styles.readyTextCol}>
            <Text style={styles.readyTitle}>{t('explore.readyTitle')}</Text>
            <Text style={styles.readyBody}>{t('explore.readyBody', { game: ready?.name ?? '' })}</Text>
            <View style={styles.readyBtns}>
              <SheetButton
                label={t('games.newMatch')}
                onPress={() => {
                  if (ready) void newMatchFor(ready);
                  setReady(null);
                }}
                style={styles.readyBtn}
              />
              <SheetButton
                label={t('home.join')}
                variant="ghost"
                onPress={() => {
                  setReady(null);
                  router.replace('/join');
                }}
                style={styles.readyBtn}
              />
            </View>
          </View>
        </View>
      </NeonSheet>
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
  cardOff: { opacity: 0.45 },
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
  /* K112: tấm "You're ready to play!" */
  readyCard: { alignItems: 'stretch', paddingHorizontal: 24, paddingVertical: 22 },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  readyLogoCol: { width: 200, alignItems: 'center', gap: 8 },
  readyLogo: { width: 170, height: 130 },
  readyTagline: { fontSize: 15, color: '#FFFFFF', textAlign: 'center' },
  readyTextCol: { flex: 1, gap: 12 },
  readyTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  readyBody: { fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
  readyBtns: { flexDirection: 'row', gap: 16, marginTop: 6 },
  readyBtn: { flex: 1, minWidth: 0 },
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
