const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Ký bản RELEASE bằng UPLOAD KEY của Play Console (K124, 2026-09-22 - Tony tạo subscription trên Play,
 * Play đòi AAB trước).
 *
 * VÌ SAO PHẢI LÀ CONFIG PLUGIN: `expo prebuild` xoá rồi tạo lại `android/`, nên `signingConfigs.release`
 * viết tay vào build.gradle mất ở lần prebuild sau (xem withDevHttps.js). Plugin này chèn lại mỗi lần.
 *
 * KHOÁ: đọc từ `keys/upload.properties` (KHÔNG commit - `.gitignore` có `keys/` và `*.jks`):
 *   storeFile=../../keys/cyclic-upload.jks    (đường dẫn tương đối từ android/app/)
 *   storePassword=...
 *   keyAlias=cyclic
 *   keyPassword=...
 * Không có file đó → release vẫn ký `debug.keystore` như cũ (build LAN / thử máy), không vỡ gì.
 *
 * ⚠️ Play App Signing: chứng chỉ của LẦN UPLOAD ĐẦU TIÊN trở thành upload key vĩnh viễn của app.
 * Mất `cyclic-upload.jks` = phải xin Google reset upload key (mất vài ngày). Sao lưu ra ngoài máy.
 */
const SIGNING = `
    signingConfigs {
        release {
            def upload = new Properties()
            def uploadFile = rootProject.file('../keys/upload.properties')
            if (uploadFile.exists()) {
                uploadFile.withInputStream { upload.load(it) }
                storeFile file(upload['storeFile'])
                storePassword upload['storePassword']
                keyAlias upload['keyAlias']
                keyPassword upload['keyPassword']
            }
        }
        debug {`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes("rootProject.file('../keys/upload.properties')")) return cfg;
    gradle = gradle.replace(/\n    signingConfigs \{\n        debug \{/, SIGNING);
    // release dùng upload key khi có file, không thì giữ debug.
    // Chỉ đụng buildTypes.release (regex "release {" đầu tiên là signingConfigs.release vừa chèn - đã dính
    // một lần: bundle ra ký debug, đo 22/9). Dò từ "buildTypes {" rồi tới "release {" của nó.
    const bt = gradle.indexOf('buildTypes {');
    const rel = gradle.indexOf('release {', bt);
    const marker = 'signingConfig = signingConfigs.debug';
    const at = gradle.indexOf(marker, rel);
    if (bt < 0 || rel < 0 || at < 0) throw new Error('withReleaseSigning: buildTypes.release không có signingConfig = signingConfigs.debug');
    gradle = gradle.slice(0, at) + "signingConfig = rootProject.file('../keys/upload.properties').exists() ? signingConfigs.release : signingConfigs.debug" + gradle.slice(at + marker.length);
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
