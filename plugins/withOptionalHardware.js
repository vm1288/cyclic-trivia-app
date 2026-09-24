const { withAndroidManifest } = require('expo/config-plugins');

/**
 * K145: khai MICRO và CAMERA là **không bắt buộc** trong AndroidManifest.
 *
 * VÌ SAO CẦN: Android suy ra phần cứng từ quyền — `RECORD_AUDIO` ngầm đòi
 * `android.hardware.microphone`, `CAMERA` ngầm đòi `android.hardware.camera`, cả hai mặc định
 * `required="true"`. Play đọc đúng cái đó rồi **loại những máy không có phần cứng ấy**. Đã dính
 * thật ở **K144**: thêm `expo-audio` (kéo theo `RECORD_AUDIO`) làm Play báo *"no longer supports
 * 6 devices"*, lúc đó phải chặn hẳn quyền để lấy lại.
 *
 * Nhưng video call thì **bắt buộc** phải có micro. Nên không chặn quyền được nữa — cách đúng là
 * khai tường minh `required="false"`: máy không có micro vẫn cài được, chỉ là không gọi được.
 *
 * ⚠️ Kiểm lại sau mỗi lần build AAB, đừng tin là nó còn đó:
 *
 *     python - <<'EOF'
 *     import zipfile, re
 *     t = zipfile.ZipFile('dist/....aab').read('base/manifest/AndroidManifest.xml').decode('latin-1')
 *     print(sorted(set(re.findall(r'android\.hardware[\w.]*', t))))
 *     EOF
 *
 * Phải thấy đủ **năm** tên, và **tất cả đều `required="false"`** trong manifest đã gộp
 * (`android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml`
 * là bản CHỮ, dễ đọc hơn manifest nhị phân trong AAB).
 *
 * ⚠️ Đừng chỉ so danh sách `uses-feature`: thứ làm mất máy là **quyền mới**, vì mỗi quyền kéo
 * theo một đòi hỏi phần cứng ngầm. So quyền giữa hai bản AAB trước, rồi tra xem quyền mới đòi
 * phần cứng gì: `RECORD_AUDIO` → micro (K144), `CAMERA` → camera, `BLUETOOTH` → bluetooth (K149).
 */
const OPTIONAL = [
  'android.hardware.microphone',
  'android.hardware.camera',
  'android.hardware.camera.autofocus',
  'android.hardware.camera.front',
  /*
   * K149: `react-native-webrtc` khai thêm quyền `BLUETOOTH` (để đỏi tiếng sang tai nghe SCO), và
   * quyền đó **ngầm đòi `android.hardware.bluetooth`**. Play báo *"no longer supports 12 devices"*
   * ở bản v9 chính vì dòng này — máy không có Bluetooth (hộp Android TV, vài máy tính bảng) bị loại.
   */
  'android.hardware.bluetooth',
];

module.exports = function withOptionalHardware(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-feature'] = manifest['uses-feature'] ?? [];

    for (const name of OPTIONAL) {
      const existing = manifest['uses-feature'].find((f) => f.$?.['android:name'] === name);
      if (existing) {
        existing.$['android:required'] = 'false';
      } else {
        manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
      }
    }
    return cfg;
  });
};
