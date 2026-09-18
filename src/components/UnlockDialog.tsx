import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { GameInfoDialog, type GameInfo } from './GameInfoDialog';
import { useT } from '../i18n/I18nProvider';

/**
 * K110 (Tony 18/9): hết 3 lượt vào miễn phí VÀ đã dùng thử → hai tấm:
 *
 *   1. "You haven't unlocked {Game} yet. Purchase the game now to continue joining matches,
 *      creating new games, and playing with your friends without limits!"  [UNLOCK NOW]
 *   2. tấm giới thiệu game (`GameInfoDialog`) với nút PURCHASE / $XX per month
 *
 * Chữ theo game do server cấp (409 `free_joins_used` → `Unlock` + `Trial`).
 * PURCHASE → nơi gọi đưa sang /purchase với `autoBuy` = sponsorId (tự mở sheet store).
 */
export type UnlockInfo = GameInfo;

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
  if (step === 2) {
    return <GameInfoDialog info={info} cta={{ kind: 'purchase', onPress: () => onPurchase(info) }} onClose={onClose} />;
  }
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button">
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.body}>{t('unlock.notYet', { game: info.gameName })}</Text>
          <Pressable onPress={() => setStep(2)} accessibilityRole="button" style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
            <Text style={styles.btnText}>{t('unlock.cta')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 560, borderRadius: 14, backgroundColor: '#000000', paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center', gap: 18 },
  body: { fontSize: 17, lineHeight: 25, color: '#FFFFFF', textAlign: 'center' },
  btn: { minWidth: 210, paddingVertical: 8, paddingHorizontal: 22, borderRadius: 8, borderWidth: 2.5, borderColor: '#3B6CE6', alignItems: 'center' },
  btnText: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.4 },
  pressed: { opacity: 0.7 },
});
