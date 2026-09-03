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
   * KHOÁ NGANG cho TOÀN APP (2026-09-03).
   *
   * Trước đây chỗ này khoá `PORTRAIT_UP` và chỉ riêng `game-landscape.tsx` mở
   * khoá sang ngang. Nay mọi màn đều dựng cho chiều ngang, nên khoá một lần ở
   * đây là đủ và không màn nào được tự đổi lại nữa.
   *
   * ⚠️ `app.json` vẫn để `orientation: "default"`. Khoá lúc chạy như thế này
   * có tác dụng ngay sau khi JS nạp xong, nhưng KHÔNG chặn được nhịp đầu tiên:
   * máy đang cầm dọc thì splash và khung màn hình đầu vẫn dựng dọc rồi mới
   * xoay. Muốn hết hẳn nhịp đó thì đổi `app.json` sang `"landscape"` - và như
   * vậy PHẢI chạy lại `scripts/build-apk.ps1` (prebuild), sửa `.tsx` không đủ.
   */
  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
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
