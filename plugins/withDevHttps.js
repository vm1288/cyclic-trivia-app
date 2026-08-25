const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

/**
 * Cho phép bản DEBUG tin chứng chỉ HTTPS dev của .NET, để app gọi được
 * `https://localhost:7025`.
 *
 * VÌ SAO CẦN: chứng chỉ do `dotnet dev-certs` sinh ra là self-signed. Android
 * từ chối thẳng, và lỗi duy nhất app thấy được là "Network request failed" -
 * không hề nhắc tới TLS, nên rất dễ đi tìm nhầm chỗ.
 *
 * CÁCH LÀM: nhúng chính chứng chỉ đó làm trust anchor riêng của app. Khác với
 * cách "cài chứng chỉ lên điện thoại": không phải thao tác tay trên máy, không
 * đụng tới kho CA của hệ thống, và chỉ có app này tin nó.
 *
 * VÌ SAO PHẢI LÀ CONFIG PLUGIN: `expo prebuild` XOÁ rồi tạo lại thư mục
 * `android/`. Mọi file chép tay vào đó sẽ biến mất ở lần prebuild sau. Plugin
 * chạy như một phần của prebuild nên luôn được áp lại.
 *
 * CHỈ ÁP CHO DEBUG: file nằm dưới `src/debug/`, và chỉ manifest debug bị sửa.
 * Bản release không đổi gì - nó phải dùng HTTPS thật.
 *
 * BẢO TRÌ: chứng chỉ dev có hạn (bản hiện tại hết hạn 2026-12-30). Khi hết hạn
 * hoặc sau khi chạy `dotnet dev-certs https --clean`, phải xuất lại:
 *   dotnet dev-certs https --export-path certs/aspnet_dev.crt --format PEM
 * rồi prebuild + build lại.
 */

const CERT_SOURCE = 'certs/aspnet_dev.crt';
const NETWORK_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<!--
  SINH TỰ ĐỘNG bởi plugins/withDevHttps.js - đừng sửa tay, prebuild sẽ ghi đè.
  Chỉ dùng cho bản debug.
-->
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <!-- Chứng chỉ dev của .NET, để gọi được https://localhost:7025 -->
            <certificates src="@raw/aspnet_dev" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

module.exports = function withDevHttps(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const androidRoot = cfg.modRequest.platformProjectRoot;
      const debugRoot = path.join(androidRoot, 'app', 'src', 'debug');

      const certSource = path.join(projectRoot, CERT_SOURCE);
      if (!fs.existsSync(certSource)) {
        // Không dừng build: thiếu chứng chỉ thì app vẫn chạy được qua HTTP.
        console.warn(
          `[withDevHttps] Không thấy ${CERT_SOURCE}. Bỏ qua phần tin chứng chỉ dev.\n` +
            '  Xuất lại bằng: dotnet dev-certs https --export-path certs/aspnet_dev.crt --format PEM',
        );
        return cfg;
      }

      // 1. Chứng chỉ vào res/raw (tên file thành id tài nguyên: R.raw.aspnet_dev,
      //    nên tên PHẢI là chữ thường + gạch dưới, không có dấu chấm thừa).
      const rawDir = path.join(debugRoot, 'res', 'raw');
      fs.mkdirSync(rawDir, { recursive: true });
      fs.copyFileSync(certSource, path.join(rawDir, 'aspnet_dev.crt'));

      // 2. Cấu hình network security
      const xmlDir = path.join(debugRoot, 'res', 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'network_security_config.xml'), NETWORK_CONFIG, 'utf8');

      // 3. Trỏ manifest debug vào cấu hình đó.
      //    Sửa bằng chuỗi chứ không qua `withAndroidManifest`: API đó chỉ đụng
      //    tới manifest CHÍNH, không thấy manifest của build type debug.
      const manifestPath = path.join(debugRoot, 'AndroidManifest.xml');
      if (fs.existsSync(manifestPath)) {
        let manifest = fs.readFileSync(manifestPath, 'utf8');
        if (!manifest.includes('android:networkSecurityConfig')) {
          manifest = manifest.replace(
            '<application ',
            '<application android:networkSecurityConfig="@xml/network_security_config" ',
          );
          fs.writeFileSync(manifestPath, manifest, 'utf8');
        }
      }

      return cfg;
    },
  ]);
};
