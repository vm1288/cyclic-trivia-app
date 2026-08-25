import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { checkActivationCode, ERR_MAX_DEVICES } from '../src/api/activation';
import { FormScreen } from '../src/components/FormScreen';
import { NeonButton } from '../src/components/NeonButton';
import { NeonField } from '../src/components/NeonField';
import { apiErrorText } from '../src/i18n/apiError';
import { useT } from '../src/i18n/I18nProvider';
import { useLicense } from '../src/session/LicenseSession';
import { downloadSponsorLogo } from '../src/session/sponsorLogo';
import { neon, text } from '../src/theme/colors';

export default function RegisterScreen() {
  const router = useRouter();
  const license = useLicense();
  const t = useT();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = code.trim();
    if (!trimmed) {
      setError(t('register.codeRequired'));
      return;
    }

    setError(null);
    setHint(null);
    setBusy(true);

    /*
     * Gửi kèm deviceId/token của phiên cũ nếu có. Server sẽ nhận ra máy này đã
     * đăng ký license đó rồi và trả lại đúng host cũ, thay vì tạo host mới và
     * ăn thêm một suất trong hạn mức MaxDevices.
     */
    const previous = license.status === 'none' || license.status === 'loading' ? null : license.session;

    const result = await checkActivationCode(
      trimmed,
      previous?.deviceId ?? null,
      previous?.token ?? null,
    );

    setBusy(false);

    if (!result.isSuccess) {
      setError(apiErrorText(result, t));
      if (result.errorCode === ERR_MAX_DEVICES) setHint(t('register.maxDevicesHint'));
      return;
    }

    /*
     * Tải logo sponsor NGAY tại đây, trong lúc nút còn đang quay, chứ không để
     * màn hình chính tự tải khi cần: ở đó nó sẽ thành một khoảng trống chớp
     * lên rồi mới có logo. Đây là chỗ duy nhất người dùng đang sẵn sàng chờ.
     *
     * Tải hỏng thì vẫn đi tiếp - `downloadSponsorLogo` trả null và app dùng
     * logo Cyclic mặc định. Không đáng chặn việc kích hoạt vì một cái ảnh.
     */
    const sponsorLogoUri = result.sponsorLogoUrl
      ? await downloadSponsorLogo(result.sponsorLogoUrl)
      : null;

    await license.save({
      token: result.data,
      deviceId: result.deviceId,
      hostId: result.HostId,
      licenseCode: trimmed,
      activated: result.isActivated,
      languageCode: result.languageCode ?? null,
      sponsorLogoUri,
    });

    // Mã hợp lệ nhưng license chưa gắn email -> còn bước nhập tên/email + OTP.
    // Chỉ khi qua hết bước đó license mới thực sự kích hoạt.
    router.replace(result.isActivated ? '/new-game' : '/activate');
  }

  return (
    <FormScreen title={t('register.title')} subtitle={t('register.subtitle')}>
      <NeonField
        label={t('register.codeLabel')}
        color={neon.orange}
        value={code}
        onChangeText={(value) => {
          setCode(value);
          if (error) setError(null);
        }}
        error={error}
        placeholder={t('register.codePlaceholder')}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        returnKeyType="go"
        onSubmitEditing={submit}
        editable={!busy}
      />

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <NeonButton label={t('register.submit')} color={neon.orange} onPress={submit} busy={busy} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  hint: { color: text.muted, fontSize: 13, lineHeight: 19 },
});
