import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { assetUrl } from '../api/game';
import { useT } from '../i18n/I18nProvider';

/**
 * K109 (Tony 18/9): hết 3 lượt vào miễn phí mà máy CHƯA từng dùng thử game này → hai tấm:
 *
 *   1. "You've used all your 3 free match joins for {Game}. Start your 7-day free trial now to
 *      continue joining matches, or become a host…"  [7-DAY FREE TRIAL]
 *   2. logo + tên game | "You can play {Game} as much as you like during the next 7 days at no
 *      cost. / You can end your trial of {Game} in the 'My Games' section. / After the 7 days,
 *      if you haven't cancelled you'll be charged and you'll have unlimited use of the game for
 *      {period}."  [PROCEED]
 *
 * Nội dung theo game: trước mắt **tên + logo** (Tony 18/9: "tùy vào game mà nội dung sẽ khác
 * nhau, trước mắt hãy khác theo tên và logo"); câu chữ còn lại dùng chung. Chạm ngoài để đóng.
 * PROCEED → nơi gọi đưa sang /purchase với `trialFor` (mua gói có kỳ dùng thử của store).
 */
export type TrialInfo = {
  days: number;
  durationDays: number;
  sponsorId: string;
  gameName: string;
  logoUrl: string | null;
};

export function FreeTrialDialog({
  info,
  total,
  onProceed,
  onClose,
}: {
  info: TrialInfo | null;
  total: number;
  onProceed: (info: TrialInfo) => void;
  onClose: () => void;
}) {
  const t = useT();
  const step = useStep(info);

  if (!info) return null;
  const period =
    info.durationDays >= 360
      ? t('trial.period12m')
      : info.durationDays >= 28
        ? t('trial.period1m')
        : t('trial.periodDays', { days: info.durationDays });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button">
        <Pressable style={styles.card} onPress={() => {}}>
          {step.value === 1 ? (
            <>
              <Text style={styles.body}>{t('trial.usedAll', { total, game: info.gameName, days: info.days })}</Text>
              <Pressable onPress={() => step.set(2)} accessibilityRole="button" style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
                <Text style={styles.btnText}>{t('trial.cta', { days: info.days })}</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.row}>
              <View style={styles.logoCol}>
                {info.logoUrl ? (
                  <Image source={{ uri: assetUrl(info.logoUrl) }} style={styles.logo} resizeMode="contain" />
                ) : null}
                <Text style={styles.gameName}>{info.gameName}</Text>
              </View>
              <View style={styles.textCol}>
                <Text style={styles.body2}>{t('trial.line1', { game: info.gameName, days: info.days })}</Text>
                <Text style={styles.body2}>{t('trial.line2', { game: info.gameName })}</Text>
                <Text style={styles.body2}>{t('trial.line3', { days: info.days, period })}</Text>
                <Pressable onPress={() => onProceed(info)} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.btnProceed, pressed && styles.pressed]}>
                  <Text style={styles.btnText}>{t('trial.proceed')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Về tấm 1 mỗi lần mở lại. */
function useStep(info: TrialInfo | null) {
  const [value, set] = useState<1 | 2>(1);
  useEffect(() => {
    if (info) set(1);
  }, [info]);
  return { value, set };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  /* Đen đặc, chữ trắng - đúng ảnh mẫu. */
  card: {
    width: '100%',
    maxWidth: 720,
    borderRadius: 14,
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 16,
  },
  body: { fontSize: 17, lineHeight: 25, color: '#FFFFFF', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 22, alignSelf: 'stretch' },
  logoCol: { width: 170, alignItems: 'center', gap: 8 },
  logo: { width: 150, height: 120 },
  gameName: { fontSize: 15, color: '#FFFFFF', textAlign: 'center', fontWeight: '700' },
  textCol: { flex: 1, gap: 12, alignItems: 'center' },
  body2: { fontSize: 15.5, lineHeight: 22, color: '#FFFFFF', alignSelf: 'stretch' },
  btn: {
    minWidth: 200,
    paddingVertical: 8,
    paddingHorizontal: 22,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#3B6CE6',
    alignItems: 'center',
  },
  btnProceed: { marginTop: 4 },
  btnText: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.4, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
