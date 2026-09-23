import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { NeonSheet, SheetButton } from './NeonSheet';
import { assetUrl } from '../api/game';
import { useT } from '../i18n/I18nProvider';

/**
 * Tấm giới thiệu một game (ảnh mẫu 4 của Tony, K110/K111):
 *
 *   ✕ (góc, ngoài mép) | logo · tagline · [NÚT]  |  mô tả · No of players · Age Range
 *
 * Dùng ở hai chỗ, chỉ khác NÚT:
 *   - EXPLORE GAMES (K111): NEW MATCH khi máy đã mua / đang dùng thử game đó; PURCHASE ($XX per
 *     month) khi chưa; "Coming Soon" (mờ) khi game chưa bán.
 *   - UNLOCK NOW (K110): luôn PURCHASE.
 *
 * Chữ theo game do server cấp (`GameCatalog`). Giá là giá niêm yết của gói; giá thật do store.
 *
 * Nền: KHÔNG đen đặc như ảnh mẫu (Tony 18/9: "nền đen của mockup chỉ là demo") - tấm mờ, nền sân
 * khấu của app hiện xuyên qua. Áp cho mọi tấm K107-K111 (Go big!, free trial, unlock, taken).
 */
export type GameInfo = {
  sponsorId: string;
  gameName: string;
  logoUrl: string | null;
  tagline: string;
  description: string;
  players: string;
  ageRange: string;
  price: number;
  currency: string | null;
  durationDays: number;
  /** Dải "Coming Soon" đè góc logo (ảnh mẫu 19/9). */
  comingSoon?: boolean;
};

export type GameCta =
  | { kind: 'newMatch'; onPress: () => void }
  | { kind: 'purchase'; onPress: () => void; busy?: boolean; disabled?: boolean }
  /** K112: chưa dùng thử → "Want to utilise the 7-day free trial?" + TRY {GAME}. */
  | { kind: 'try'; days: number; gameName: string; onPress: () => void; busy?: boolean; disabled?: boolean }
  | { kind: 'comingSoon' }
  /** Ảnh mẫu 19/9: game Coming Soon không có nút. */
  | { kind: 'none' };

const SYMBOL: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', INR: '₹', AUD: 'A$', VND: '₫' };

export function priceText(info: Pick<GameInfo, 'price' | 'currency'>): string {
  const cur = (info.currency ?? '').toUpperCase();
  if (!(info.price > 0)) return '';
  return `${SYMBOL[cur] ?? cur + ' '}${Number.isInteger(info.price) ? info.price : info.price.toFixed(2)}`;
}

export function GameInfoDialog({
  info,
  cta,
  /** Giá do store định (displayPrice) - có thì thay giá niêm yết. */
  storePrice,
  notice,
  onClose,
  children,
}: {
  info: GameInfo | null;
  cta: GameCta;
  storePrice?: string | null;
  notice?: string | null;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const t = useT();
  /*
   * Cột chữ là ScrollView TRONG một hàng: không có trần thì nó cao bằng nội dung và đẩy cả hàng
   * tràn khỏi tấm (logo đè lên nút Back - đo 19/9). Trần = ~60% bề cao màn, phần dư thì cuộn.
   */
  const { height: winH } = useWindowDimensions();
  if (!info) return null;
  const money = storePrice || priceText(info);
  const per =
    info.durationDays >= 360 ? t('unlock.perYear') : info.durationDays >= 28 ? t('unlock.perMonth') : t('unlock.perDays', { days: info.durationDays });

  return (
    <NeonSheet visible onClose={onClose} maxWidth={900} style={styles.card} closeButton>
          <View style={styles.row}>
            <View style={styles.logoCol}>
              <View style={styles.logoBox}>
                {info.logoUrl ? <Image source={{ uri: assetUrl(info.logoUrl) }} style={styles.logo} resizeMode="contain" /> : null}
                {info.comingSoon ? (
                  <View style={styles.ribbonWrap} pointerEvents="none">
                    <View style={styles.ribbon}>
                      <Text style={styles.ribbonText}>{t('games.comingSoon')}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
              <Text style={styles.tagline}>{info.tagline}</Text>

              {cta.kind === 'newMatch' ? (
                <SheetButton label={t('games.newMatch')} onPress={cta.onPress} style={styles.cta} />
              ) : cta.kind === 'purchase' ? (
                <SheetButton
                  label={t('unlock.purchase')}
                  sub={money ? t('unlock.price', { price: money, per }) : null}
                  onPress={cta.onPress}
                  disabled={cta.disabled}
                  busy={cta.busy}
                  style={styles.cta}
                />
              ) : cta.kind === 'try' ? (
                <>
                  <Text style={styles.tryHint}>{t('explore.tryHint', { days: cta.days })}</Text>
                  <SheetButton
                    label={t('explore.tryCta', { game: cta.gameName.toUpperCase() })}
                    onPress={cta.onPress}
                    disabled={cta.disabled}
                    busy={cta.busy}
                    style={styles.cta}
                  />
                </>
              ) : cta.kind === 'none' ? null : (
                <SheetButton label={t('games.comingSoon')} variant="ghost" disabled style={styles.cta} />
              )}
              {/*
                K128: lời nhắn đi kèm NÚT (store ngoại tuyến, tài khoản đã tiêu dùng thử…) phải nằm
                ngay dưới nút. Trước đây nó ở cuối cột mô tả bên phải, rơi dưới tầm nhìn - đo trên A17
                23/9 phải cuộn mới thấy, coi như không có.
              */}
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              {children}
            </View>
            <ScrollView style={[styles.textCol, { maxHeight: Math.max(220, winH * 0.56) }]} contentContainerStyle={styles.textInner}>
              <Text style={styles.desc}>{info.description}</Text>
              <Text style={styles.desc}>
                {t('unlock.players')}
                {'\n'}
                {info.players}
              </Text>
              <Text style={styles.desc}>
                {t('unlock.age')}
                {'\n'}
                {info.ageRange}
              </Text>
            </ScrollView>
          </View>
    </NeonSheet>
  );
}

const styles = StyleSheet.create({
  /* Lề đều bốn phía - ✕ nằm ngoài mép (NeonSheet closeButton), không có hàng Back. */
  card: { alignItems: 'stretch', paddingHorizontal: 24, paddingVertical: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  logoCol: { width: 190, alignItems: 'center', justifyContent: 'center', gap: 6 },
  logoBox: { width: 124, height: 92 },
  logo: { width: 124, height: 92 },
  ribbonWrap: { position: 'absolute', top: 0, left: 0, width: 96, height: 96, overflow: 'hidden' },
  ribbon: { position: 'absolute', top: 18, left: -34, width: 140, paddingVertical: 3, backgroundColor: '#D9262E', transform: [{ rotate: '-45deg' }], alignItems: 'center' },
  ribbonText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4 },
  tryHint: { fontSize: 12.5, lineHeight: 16, color: '#9FC4FF', textAlign: 'center' },
  tagline: { fontSize: 14, lineHeight: 19, color: '#FFFFFF', textAlign: 'center' },
  cta: { minWidth: 180 },
  textCol: { flex: 1 },
  textInner: { gap: 10, paddingVertical: 4 },
  desc: { fontSize: 14, lineHeight: 20, color: '#FFFFFF' },
  notice: { fontSize: 13, lineHeight: 18, color: '#FFD166', marginTop: 10, textAlign: 'center' },
});
