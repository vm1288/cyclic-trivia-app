import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useConfirm } from '../src/components/ConfirmDialog';
import { lobbyColors } from '../src/components/LobbyParts';
import { SheetButton } from '../src/components/NeonSheet';
import { ScreenShell } from '../src/components/ProfileParts';
import { useT } from '../src/i18n/I18nProvider';
import { useProfile } from '../src/session/ProfileSession';
import { text } from '../src/theme/colors';

/**
 * Account (mockup V6 slide 6, Tony 2/10).
 *   - chưa gắn email: Register Account / Login with Existing Account
 *   - đã gắn: nickname + email + Logout (logout → máy nhận hồ sơ khách MỚI)
 */
export default function AccountScreen() {
  const t = useT();
  const router = useRouter();
  const confirm = useConfirm();
  const profile = useProfile();
  const p = profile.profile;

  return (
    <ScreenShell title={t('account.title')}>
      <View style={styles.center}>
        {p?.email ? (
          <>
            <Text style={styles.name}>{p.nickName}</Text>
            <Text style={styles.email}>{p.email}</Text>
            <SheetButton
              label={t('account.logout')}
              variant="danger"
              onPress={async () => {
                const ok = await confirm({
                  title: t('account.logoutTitle'),
                  message: t('account.logoutBody'),
                  cancelLabel: t('common.cancel').toUpperCase(),
                  confirmLabel: t('account.logout').toUpperCase(),
                });
                if (!ok) return;
                await profile.logout();
                router.back();
              }}
            />
          </>
        ) : (
          <>
            <Text style={styles.lead}>{t('account.lead')}</Text>
            <SheetButton label={t('account.register')} variant="ghost" onPress={() => router.push('/account-email?mode=register')} style={styles.btn} />
            <SheetButton label={t('account.login')} variant="ghost" onPress={() => router.push('/account-email?mode=login')} style={styles.btn} />
          </>
        )}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingBottom: 30 },
  name: { color: text.primary, fontSize: 30, fontWeight: '800' },
  email: { color: lobbyColors.dim, fontSize: 18, marginTop: -10, marginBottom: 6 },
  lead: { color: text.primary, fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 460 },
  btn: { minWidth: 320 },
});
