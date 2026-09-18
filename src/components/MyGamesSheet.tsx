import { LinearGradient } from 'expo-linear-gradient';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lobbyColors } from './LobbyParts';
import { useI18n } from '../i18n/I18nProvider';
import type { LicenseSession } from '../session/LicenseSession';
import { text } from '../theme/colors';

/**
 * Hai tấm dùng chung một khung (K106, Tony 18/9 - thay `SwitchGameSheet` + mã license):
 *
 *   `mode: 'manage'`  - nút "My Games" ở góc trên trái Home: từng game đã mua, gói đang
 *                       dùng + ngày gia hạn, NEW MATCH / CANCEL SUBSCRIPTION, dưới cùng
 *                       BUY ANOTHER GAME.
 *   `mode: 'choose'`  - SET UP A MATCH khi có hơn một game: "Choose the game for the new
 *                       match", mỗi hàng chỉ có NEW MATCH.
 *
 * Không còn nhập mã license: mua trong app, server tự cấp. Mọi thứ về "ADD A LICENCE" /
 * "Remove licence" bỏ khỏi màn này.
 */
export function MyGamesSheet({
  visible,
  mode,
  sessions,
  activeHostId,
  onNewMatch,
  onCancelSubscription,
  onBuyAnother,
  onClose,
}: {
  visible: boolean;
  mode: 'manage' | 'choose';
  sessions: LicenseSession[];
  activeHostId: string | null;
  onNewMatch: (hostId: string) => void;
  onCancelSubscription: (hostId: string) => void;
  onBuyAnother: () => void;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const insets = useSafeAreaInsets();

  /* Ngày theo NGÔN NGỮ APP ("Sep 9, 2026" / "9 thg 9, 2026"), không theo locale máy. */
  const renewal = (s: LicenseSession) => {
    if (!s.licenseExpiresAt) return null;
    const d = new Date(s.licenseExpiresAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} accessibilityRole="button" />

        <View
          style={[
            styles.sheet,
            { paddingBottom: 20 + insets.bottom, paddingLeft: 20 + insets.left, paddingRight: 20 + insets.right },
          ]}
        >
          <LinearGradient colors={['rgba(24,16,56,0.97)', 'rgba(9,6,30,1)']} style={styles.fill} />
          <View style={styles.grabber} />

          <Text style={styles.title}>{t(mode === 'choose' ? 'games.chooseTitle' : 'games.title')}</Text>
          {mode === 'choose' ? null : <Text style={styles.subtitle}>{t('games.subtitle')}</Text>}

          <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
            {sessions.map((s) => {
              const inUse = s.hostId === activeHostId;
              const when = renewal(s);
              return (
                <View key={s.hostId} style={[styles.row, mode === 'choose' && inUse && styles.rowActive]}>
                  {s.sponsorLogoUri ? (
                    <Image source={{ uri: s.sponsorLogoUri }} style={styles.logo} resizeMode="contain" />
                  ) : (
                    <View style={styles.logoBlank} />
                  )}

                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {s.sponsorName || t('games.unnamed')}
                    </Text>
                    {mode === 'manage' ? (
                      <>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {s.planTitle || t('games.planFallback')}
                        </Text>
                        {when ? (
                          <Text style={styles.rowSub} numberOfLines={1}>
                            {t('games.renewal', { date: when })}
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => onNewMatch(s.hostId)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.newMatch, pressed && styles.pressed]}
                    >
                      <Text style={styles.newMatchText}>{t('games.newMatch')}</Text>
                    </Pressable>
                    {mode === 'manage' ? (
                      <Pressable
                        onPress={() => onCancelSubscription(s.hostId)}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
                      >
                        <Text style={styles.cancelText}>{t('games.cancelSubscription')}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {mode === 'manage' ? (
            <Pressable
              onPress={onBuyAnother}
              accessibilityRole="button"
              style={({ pressed }) => [styles.buyWrap, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={[lobbyColors.violet, lobbyColors.purple]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.buy}
              >
                <Text style={styles.buyText}>{t('games.buyAnother')}</Text>
              </LinearGradient>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,3,14,0.75)', justifyContent: 'flex-end' },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  pressed: { opacity: 0.75 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.5,
    borderColor: 'rgba(200,107,255,0.55)',
    overflow: 'hidden',
    paddingTop: 10,
    maxHeight: '92%',
  },
  grabber: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(190,205,255,0.35)', marginBottom: 14 },
  title: { fontSize: 15, fontWeight: '800', letterSpacing: 2, color: lobbyColors.cyan },
  subtitle: { marginTop: 6, fontSize: 13, lineHeight: 19, color: lobbyColors.dim },
  list: { marginTop: 14 },
  listInner: { gap: 10, paddingBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(120,150,220,0.25)',
    backgroundColor: 'rgba(12,14,38,0.72)',
  },
  rowActive: { borderColor: lobbyColors.green, boxShadow: '0 0 12px rgba(46,232,95,0.35)' },
  logo: { width: 56, height: 56, borderRadius: 10 },
  logoBlank: { width: 56, height: 56, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '800', color: text.primary },
  rowSub: { fontSize: 12.5, color: lobbyColors.dim },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  /* Nút xanh dương đặc như ảnh mẫu của Tony. */
  newMatch: {
    minWidth: 76,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#3B6CE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newMatchText: { fontSize: 12.5, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  /* Viền đỏ, nền trong như ảnh mẫu. */
  cancel: {
    minWidth: 96,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E03A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 11.5, fontWeight: '700', color: '#FF7A88', textAlign: 'center' },
  buyWrap: { marginTop: 16 },
  buy: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(200,107,255,0.5)' },
  buyText: { fontSize: 14.5, fontWeight: '800', letterSpacing: 1.4, color: '#FFFFFF' },
});
