import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { checkActivationCode } from '../src/api/activation';
import { useLicense } from '../src/session/LicenseSession';
import { downloadSponsorLogo } from '../src/session/sponsorLogo';
import { text } from '../src/theme/colors';

/**
 * CHỈ BẢN DEV - nạp một licence bằng mã cho máy test (Tony 30/9).
 *
 * Màn REGISTER và `/activate` đã bỏ (K150): khách thật chỉ có licence bằng cách MUA trong store.
 * Máy test (iPhone dev client, A17) vẫn cần làm chủ phòng, nên có cửa này:
 *
 *   cyclic://dev-licence?code=106734
 *   (Android: adb shell am start -a android.intent.action.VIEW -d "cyclic://dev-licence?code=106734")
 *
 * Licence nạp ở đây được coi là ĐÃ KÍCH HOẠT dù server trả `isActivated: false` (licence chưa gắn
 * email) - và `LicenseSession` ở bản dev không hạ nó xuống khi làm mới. Server vẫn cho licence
 * chưa kích hoạt tạo ván, nên không cần sửa gì phía server.
 *
 * Bản release: route vẫn tồn tại (expo-router tạo từ file) nhưng chỉ chuyển về Home.
 */
export default function DevLicenceScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DevLicence />;
}

function DevLicence() {
  const router = useRouter();
  const license = useLicense();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [msg, setMsg] = useState(code ? `Loading licence ${code}…` : 'Missing ?code=');

  useEffect(() => {
    if (!code || license.status === 'loading') return;
    let cancelled = false;
    (async () => {
      const r = await checkActivationCode(code, license.deviceIdFor(code) ?? null, null);
      if (cancelled) return;
      if (!r.isSuccess) {
        setMsg(`Licence ${code} rejected: ${r.errorCode ?? r.message ?? r.kind}`);
        return;
      }
      const sponsorLogoUri = r.sponsorLogoUrl ? await downloadSponsorLogo(r.sponsorLogoUrl) : null;
      await license.save({
        token: r.data,
        expiresAt: r.expiresAt ?? null,
        deviceId: r.deviceId,
        hostId: r.HostId,
        licenseCode: code,
        activated: true,
        languageCode: r.languageCode ?? null,
        sponsorName: r.sponsorName ?? null,
        sponsorId: r.sponsorId ?? null,
        planTitle: r.planTitle ?? null,
        licenseExpiresAt: r.licenseExpiresAt ?? null,
        sponsorLogoUri,
      });
      router.replace('/');
    })();
    return () => {
      cancelled = true;
    };
    // Chạy lại khi licence tải xong; `license`/`router` đổi tham chiếu mỗi lần render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, license.status]);

  return (
    <View style={styles.root}>
      <Text style={styles.msg}>{msg}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#070B1F', padding: 24 },
  msg: { color: text.primary, fontSize: 15, textAlign: 'center' },
});
