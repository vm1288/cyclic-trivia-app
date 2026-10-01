import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { GameInfoDialog, type GameInfo } from './GameInfoDialog';
import { NeonSheet, SheetButton } from './NeonSheet';
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
  freeJoinsTotal,
  onPurchase,
  onClose,
}: {
  info: UnlockInfo | null;
  /**
   * Tới vì HẾT lượt vào miễn phí (Tony 1/10, mockup "When free joins and the 7-day trial are both
   * exhausted"): câu "You've used all your 3 free match joins for {game}…" + nút PURCHASE.
   * Không truyền thì giữ câu "You haven't unlocked {game} yet" + UNLOCK NOW.
   */
  freeJoinsTotal?: number | null;
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
    <NeonSheet visible onClose={onClose} maxWidth={560} closeButton>
      <Text style={styles.body}>
        {freeJoinsTotal
          ? t('unlock.usedAll', { game: info.gameName, total: String(freeJoinsTotal) })
          : t('unlock.notYet', { game: info.gameName })}
      </Text>
      <SheetButton label={t(freeJoinsTotal ? 'unlock.purchase' : 'unlock.cta')} onPress={() => setStep(2)} />
    </NeonSheet>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 17, lineHeight: 25, color: '#FFFFFF', textAlign: 'center' },
});
