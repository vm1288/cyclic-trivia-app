import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { assetUrl } from '../api/game';
import { useT } from '../i18n/I18nProvider';

/**
 * K110 (Tony 18/9): hết 3 lượt vào miễn phí VÀ đã dùng thử → hai tấm:
 *
 *   1. "You haven't unlocked {Game} yet. Purchase the game now to continue joining matches,
 *      creating new games, and playing with your friends without limits!"  [UNLOCK NOW]
 *   2. ‹ Back | logo · tagline · [PURCHASE / $XX per month]  |  mô tả · No of players · Age Range
 *
 * Chữ theo game do server cấp (`GameCatalog`, 409 `free_joins_used` → `Unlock`). Giá là giá niêm
 * yết web của gói ("USD 9 per month"); giá thật do store định, màn mua hiện lại.
 * PURCHASE → nơi gọi đưa sang /purchase với `autoBuy` = sponsorId (tự mở sheet store).
 */
export type UnlockInfo = {
  sponsorId: string;
  gameName: string;
  logoUrl: string | null;
  price: number;
  currency: string | null;
  durationDays: number;
  tagline: string;
  description: string;
  players: string;
  ageRange: string;
};

const SYMBOL: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', INR: '₹', AUD: 'A$', VND: '₫' };

export function UnlockDialog({
  info,
  onPurchase,
  onClose,
}: {
  info: UnlockInfo | null;
  onPurchase: (info: UnlockInfo) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [step, setStep] = useState<1 | 2>(1);
  useEffect(() => {
    if (info) setStep(1);
  }, [info]);

  if (!info) return null;
  const cur = (info.currency ?? '').toUpperCase();
  const money = info.price > 0 ? `${SYMBOL[cur] ?? cur + ' '}${Number.isInteger(info.price) ? info.price : info.price.toFixed(2)}` : '';
  const per =
    info.durationDays >= 360 ? t('unlock.perYear') : info.durationDays >= 28 ? t('unlock.perMonth') : t('unlock.perDays', { days: info.durationDays });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button">
        {step === 1 ? (
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.body}>{t('unlock.notYet', { game: info.gameName })}</Text>
            <Pressable onPress={() => setStep(2)} accessibilityRole="button" style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
              <Text style={styles.btnText}>{t('unlock.cta')}</Text>
            </Pressable>
          </Pressable>
        ) : (
          <Pressable style={[styles.card, styles.cardWide]} onPress={() => {}}>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10} style={styles.back}>
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
              <Text style={styles.backText}>{t('common.back')}</Text>
            </Pressable>
            <View style={styles.row}>
              <View style={styles.logoCol}>
                {info.logoUrl ? <Image source={{ uri: assetUrl(info.logoUrl) }} style={styles.logo} resizeMode="contain" /> : null}
                <Text style={styles.tagline}>{info.tagline}</Text>
                <Pressable onPress={() => onPurchase(info)} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.buy, pressed && styles.pressed]}>
                  <Text style={styles.buyText}>{t('unlock.purchase')}</Text>
                  {money ? <Text style={styles.buyPrice}>{t('unlock.price', { price: money, per })}</Text> : null}
                </Pressable>
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
              </ScrollView>
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 560, borderRadius: 14, backgroundColor: '#000000', paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center', gap: 18 },
  cardWide: { maxWidth: 900, maxHeight: '96%', alignItems: 'stretch', gap: 8, paddingTop: 10 },
  body: { fontSize: 17, lineHeight: 25, color: '#FFFFFF', textAlign: 'center' },
  btn: { minWidth: 210, paddingVertical: 8, paddingHorizontal: 22, borderRadius: 8, borderWidth: 2.5, borderColor: '#3B6CE6', alignItems: 'center' },
  btnText: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.4 },
  pressed: { opacity: 0.7 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2 },
  backText: { color: '#FFFFFF', fontSize: 15 },
  row: { flexDirection: 'row', gap: 20, flexShrink: 1 },
  logoCol: { width: 190, alignItems: 'center', justifyContent: 'center', gap: 10 },
  logo: { width: 170, height: 130 },
  tagline: { fontSize: 15, color: '#FFFFFF', textAlign: 'center' },
  buy: { minWidth: 170, paddingVertical: 6 },
  buyText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.6 },
  buyPrice: { fontSize: 15, color: '#FFFFFF', marginTop: 2 },
  textCol: { flex: 1 },
  textInner: { gap: 14, paddingVertical: 4 },
  desc: { fontSize: 15, lineHeight: 21, color: '#FFFFFF' },
});
