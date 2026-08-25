import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { confirmActivationCode, submitActivationInfo } from '../src/api/activation';
import { FormScreen } from '../src/components/FormScreen';
import { NeonButton } from '../src/components/NeonButton';
import { NeonField } from '../src/components/NeonField';
import { apiErrorText } from '../src/i18n/apiError';
import { useT } from '../src/i18n/I18nProvider';
import { useLicense } from '../src/session/LicenseSession';
import { neon, text } from '../src/theme/colors';

/**
 * Bước 2 của kích hoạt, chỉ chạy khi `ActivationCodeCheck` trả
 * `isActivated: false` - tức license chưa gắn email lần nào.
 *
 * Gộp hai bước vào MỘT màn thay vì hai route: giữa hai bước không có gì để
 * quay lại (OTP đã gửi đi rồi), tách route chỉ tổ đẻ ra nút back dẫn tới trạng
 * thái vô nghĩa.
 */
export default function ActivateScreen() {
  const router = useRouter();
  const license = useLicense();
  const t = useT();

  const [step, setStep] = useState<'info' | 'otp'>('info');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const session = license.status === 'pending' || license.status === 'active' ? license.session : null;

  // Vào thẳng route này mà chưa qua bước nhập mã thì không có token để gọi API.
  if (!session) {
    return (
      <FormScreen title={t('activate.noSessionTitle')} onBack={() => router.replace('/register')}>
        <Text style={styles.note}>{t('activate.noSession')}</Text>
        <NeonButton
          label={t('activate.goToRegister')}
          color={neon.orange}
          onPress={() => router.replace('/register')}
        />
      </FormScreen>
    );
  }

  async function sendInfo() {
    if (!session) return;
    if (!name.trim() || !email.trim()) {
      setError(t('activate.infoRequired'));
      return;
    }

    setError(null);
    setBusy(true);
    const result = await submitActivationInfo(
      name.trim(),
      email.trim(),
      session.licenseCode,
      session.token,
    );
    setBusy(false);

    if (!result.isSuccess) {
      setError(apiErrorText(result, t));
      return;
    }
    setStep('otp');
  }

  async function confirm() {
    if (!session) return;
    if (!otp.trim()) {
      setError(t('activate.otpRequired'));
      return;
    }

    setError(null);
    setBusy(true);
    const result = await confirmActivationCode(otp.trim(), session.token);
    setBusy(false);

    if (!result.isSuccess) {
      setError(apiErrorText(result, t));
      return;
    }

    await license.markActivated();
    router.replace('/new-game');
  }

  if (step === 'info') {
    return (
      <FormScreen title={t('activate.infoTitle')} subtitle={t('activate.infoSubtitle')}>
        <NeonField
          label={t('activate.nameLabel')}
          color={neon.orange}
          value={name}
          onChangeText={setName}
          placeholder={t('activate.namePlaceholder')}
          autoCapitalize="words"
          editable={!busy}
        />
        <NeonField
          label={t('activate.emailLabel')}
          color={neon.orange}
          value={email}
          onChangeText={setEmail}
          error={error}
          placeholder={t('activate.emailPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="go"
          onSubmitEditing={sendInfo}
          editable={!busy}
        />
        <NeonButton
          label={t('activate.sendCode')}
          color={neon.orange}
          onPress={sendInfo}
          busy={busy}
        />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title={t('activate.otpTitle')}
      subtitle={t('activate.otpSubtitle', { email: email.trim() })}
      onBack={() => {
        setError(null);
        setStep('info');
      }}
    >
      <NeonField
        label={t('activate.otpLabel')}
        color={neon.orange}
        value={otp}
        onChangeText={setOtp}
        error={error}
        placeholder={t('activate.otpPlaceholder')}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        returnKeyType="go"
        onSubmitEditing={confirm}
        editable={!busy}
      />
      <NeonButton label={t('activate.confirm')} color={neon.orange} onPress={confirm} busy={busy} />
      <Text style={styles.note}>{t('activate.otpNote')}</Text>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  note: { color: text.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
