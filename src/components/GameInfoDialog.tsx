import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NeonSheet, SheetButton } from './NeonSheet';
import { assetUrl } from '../api/game';
import { useT } from '../i18n/I18nProvider';

/**
 * Tấm giới thiệu một game (ảnh mẫu 4 của Tony, K110/K111):
 *
 *   ‹ Back | logo · tagline · [NÚT]  |  mô tả · No of players · Age Range
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
};

export type GameCta =
  | { kind: 'newMatch'; onPress: () => void }
  | { kind: 'purchase'; onPress: () => void; busy?: boolean; disabled?: boolean }
  | { kind: 'comingSoon' };

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
  if (!info) return null;
  const money = storePrice || priceText(info);
  const per =
    info.durationDays >= 360 ? t('unlock.perYear') : info.durationDays >= 28 ? t('unlock.perMonth') : t('unlock.perDays', { days: info.durationDays });

  return (
    <NeonSheet visible onClose={onClose} maxWidth={900} style={styles.card}>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
          <View style={styles.row}>
            <View style={styles.logoCol}>
              {info.logoUrl ? <Image source={{ uri: assetUrl(info.logoUrl) }} style={styles.logo} resizeMode="contain" /> : null}
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
              ) : (
                <SheetButton label={t('games.comingSoon')} variant="ghost" disabled style={styles.cta} />
              )}
              {children}
            </View>
            <ScrollView style={styles.textCol} contentContainerStyle={styles.textInner}>
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
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            </ScrollView>
          </View>
    </NeonSheet>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'stretch', paddingHorizontal: 22, paddingVertical: 10, gap: 8, maxHeight: '100%' },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2 },
  backText: { color: '#FFFFFF', fontSize: 15 },
  row: { flexDirection: 'row', gap: 20, flexShrink: 1, minHeight: 0 },
  logoCol: { width: 190, alignItems: 'center', justifyContent: 'center', gap: 10 },
  logo: { width: 150, height: 112 },
  tagline: { fontSize: 15, color: '#FFFFFF', textAlign: 'center' },
  cta: { minWidth: 180 },
  textCol: { flex: 1 },
  textInner: { gap: 10, paddingVertical: 4 },
  desc: { fontSize: 14, lineHeight: 20, color: '#FFFFFF' },
  notice: { fontSize: 13.5, lineHeight: 19, color: '#FFD166' },
});
