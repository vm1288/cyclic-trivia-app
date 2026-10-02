import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { requestEmailCode, verifyEmailCode, type EmailMode } from '../src/api/profile';
import { NeonField } from '../src/components/NeonField';
import { SheetButton } from '../src/components/NeonSheet';
import { ScreenShell, profileErrorKey } from '../src/components/ProfileParts';
import { useT } from '../src/i18n/I18nProvider';
import { usePlayer } from '../src/session/PlayerSession';
import { useProfile } from '../src/session/ProfileSession';
import { neon, text } from '../src/theme/colors';

/**
 * Register Account / Login with Existing Account (mockup V6 slide 7-8): nhập email → server gửi mã
 * 6 số → nhập mã.
 *   - register: email gắn vào hồ sơ đang dùng (giữ tên, thành tích)
 *   - login: máy này vào hồ sơ có email đó; máy đang giữ nó bị đăng xuất (Tony 2/10: một tài khoản
 *     một máy). Hồ sơ khách đang dùng trên máy này bỏ lại.
 */
export default function AccountEmailScreen() {
  const t = useT();
  const router = useRouter();
  const profile = useProfile();
  const player = usePlayer();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: EmailMode = params.mode === 'login' ? 'login' : 'register';
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    setError(null);
    const r = await requestEmailCode(profile.token, email.trim(), mode);
    setBusy(false);
    if (!r.ok) {
      setError(t(profileErrorKey(r.errorCode ?? (r.network ? 'network' : null))));
      return;
    }
    setStep('code');
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const deviceId = player.status === 'ready' ? player.deviceId : '';
    const r = await verifyEmailCode(profile.token, email.trim(), mode, code.trim(), deviceId);
    setBusy(false);
    if (!r.ok) {
      setError(t(profileErrorKey(r.errorCode ?? (r.network ? 'network' : null))));
      return;
    }
    if (mode === 'login' && r.token) await profile.adopt(r.token, r.profile);
    else await profile.update(r.profile);
    /* Xong thì về thẳng màn trước Account (Profile, hoặc Home nếu đi từ tấm Welcome). */
    router.dismiss(mode === 'login' ? 1 : 2);
  };

  const title = t(mode === 'login' ? 'account.loginTitle' : 'account.registerTitle');

  return (
    <ScreenShell title={title}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          {step === 'email' ? (
            <>
              <Text style={styles.lead}>{t(mode === 'login' ? 'account.loginLead' : 'account.registerLead')}</Text>
              <NeonField
                label={t('account.email')}
                color={neon.blue}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (error) setError(null);
                }}
                error={error}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="send"
                onSubmitEditing={() => void send()}
                style={styles.input}
              />
              <SheetButton label={t('account.submit')} onPress={() => void send()} busy={busy} disabled={busy || !email.includes('@')} />
            </>
          ) : (
            <>
              <Text style={styles.lead}>
                {t(mode === 'login' ? 'account.codeLeadLogin' : 'account.codeLeadRegister', { email: email.trim() })}
              </Text>
              <NeonField
                label={t('account.code')}
                color={neon.blue}
                value={code}
                onChangeText={(v) => {
                  setCode(v.replace(/[^0-9]/g, ''));
                  if (error) setError(null);
                }}
                error={error}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={() => void verify()}
                style={styles.input}
              />
              <SheetButton label={t('account.submit')} onPress={() => void verify()} busy={busy} disabled={busy || code.length !== 6} />
              <SheetButton label={t('account.resend')} variant="ghost" onPress={() => void send()} disabled={busy} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingBottom: 20 },
  lead: { color: text.primary, fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 520 },
  input: { minWidth: 360 },
});
