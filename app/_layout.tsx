import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfirmProvider } from '../src/components/ConfirmDialog';
import { I18nProvider } from '../src/i18n/I18nProvider';
import { LicenseProvider } from '../src/session/LicenseSession';
import { PlayerProvider } from '../src/session/PlayerSession';
import { bg } from '../src/theme/colors';

export default function RootLayout() {
  /*
   * Mặc định KHOÁ DỌC cho toàn app.
   *
   * `app.json` để `orientation: "default"` vì màn trong ván cần xoay ngang -
   * nhưng mọi màn còn lại đều dựng cho chiều dọc và sẽ vỡ nếu bị xoay theo
   * máy. Khoá ở đây, rồi để riêng `app/game-landscape.tsx` tự mở khoá sang
   * ngang lúc nó mở và trả về dọc lúc rời đi.
   */
  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {/* Bọc ngoài Stack để mọi màn đọc được phiên license mà không phải
          truyền qua route params.

          I18nProvider nằm TRONG LicenseProvider vì ngôn ngữ mặc định suy ra từ
          sponsor của license - đảo thứ tự là useLicense() sẽ ném lỗi. */}
      <LicenseProvider>
        {/* PlayerProvider giữ GHẾ TRONG VÁN, tách hẳn với license.
            Người vào phòng bằng mã không có license nào, nên nó phải nằm
            NGOÀI mọi thứ phụ thuộc vào license - đặt ở đây để cả hai đường
            vào (chủ phòng và khách) đọc chung một kho ghế. */}
        <PlayerProvider>
          <I18nProvider>
            {/* ConfirmProvider nằm TRONG I18nProvider để chỗ gọi truyền được câu
                chữ đã dịch, và bọc ngoài Stack để hộp thoại phủ lên mọi màn. */}
            <ConfirmProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: bg.base },
                  animation: 'fade',
                }}
              />
            </ConfirmProvider>
          </I18nProvider>
        </PlayerProvider>
      </LicenseProvider>
    </SafeAreaProvider>
  );
}
