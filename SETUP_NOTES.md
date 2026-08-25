# Ghi chú môi trường — đọc trước khi debug "app không chạy"

## Quyết định: ở lại Expo SDK 57 (2026-08-25)

SDK 57 (React 19.2, RN 0.86) là bản rất mới và có cạnh sắc thật — Reanimated 4 vừa tách `react-native-worklets` ra package riêng, và hệ sinh thái còn tự mâu thuẫn peer dependency (`react-dom@19.2.8` đòi `react@^19.2.8` trong khi SDK ghim `19.2.3`, phải dùng `--legacy-peer-deps`).

Đã cân nhắc lùi về SDK 56 cho ổn định. **Quyết định ở lại 57**, lý do: nâng SDK về sau phiền hơn nhiều so với chịu vài cạnh sắc lúc mới dựng. Bắt đầu ở bản mới nhất = ít lần nâng phía trước. Các vấn đề đã gặp cũng đã giải quyết và ghi lại hết trong file này.

> Khi cài package mới mà gặp lỗi peer dependency, dùng `--legacy-peer-deps`. Đây là hệ quả đã biết của việc ở trên bản mới, không phải dấu hiệu hỏng project.


Những lỗi dưới đây đều **không phải lỗi code**, và mỗi cái từng ngốn một vòng debug. Gặp triệu chứng lạ, soi danh sách này trước.

---

## Chạy app lên emulator

Dùng script, đừng gọi `npx expo start --android` trực tiếp:

```bash
bash scripts/run-emulator.sh
```

Lý do từng bước nằm trong comment của script. Tóm tắt ba cái bẫy:

| Bẫy | Triệu chứng | Nguyên nhân |
|---|---|---|
| Metro chạy ở cổng khác 8081 | App treo ở splash, không bao giờ bundle | Dev build hỏi bundle ở **cổng mặc định của React Native là 8081**. Logcat báo `The device must either be USB connected (with bundler set to "localhost:8081")…` — **không hề nhắc tới cổng ta đang chạy**, nên rất dễ nhầm là lỗi khác. |
| Mở bằng IP LAN | App kẹt ở splash mãi | `--android` mở `exp://192.168.x.x` — emulator **không** với tới IP LAN của host. Phải dùng `10.0.2.2`, alias emulator ánh xạ về máy host. |
| Cờ `--localhost` | `Failed to download remote update` | Nó khiến Metro chỉ bind **`[::1]`** (IPv6 loopback), trong khi `10.0.2.2` đi vào **IPv4** loopback → không có gì lắng nghe ở đó. Kiểm tra bằng `netstat -ano \| grep 8081`, phải thấy `0.0.0.0:8081`. |
| Metro để lại tiến trình giữ cổng | `Port 8081 is being used` rồi **bỏ luôn dev server** (chế độ non-interactive không hỏi được) | Phải kill theo PID đang LISTEN, `pkill -f "expo start"` không đủ. |

### Chạy trên máy thật (ưu tiên - nhìn đúng thực tế hơn emulator)

Máy đang dùng: Samsung **SM-A175F**, serial `R5GL607M1TW`.

1. Cắm USB, mở khoá máy, bấm **Allow** ở hộp thoại *Allow USB debugging?* (tick *Always allow from this computer*). Chưa bấm thì `adb devices` báo `unauthorized` và mọi lệnh đều trượt.
2. Không cần build lại nếu chỉ sửa JS - APK debug đã đóng gói **cả 4 ABI** (`arm64-v8a, armeabi-v7a, x86, x86_64`), nên bản build cho emulator cài thẳng sang máy thật được.

```bash
adb -s R5GL607M1TW install -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s R5GL607M1TW reverse tcp:8081 tcp:8081   # Metro
adb -s R5GL607M1TW reverse tcp:7025 tcp:7025   # server CyclicTrivia
adb -s R5GL607M1TW shell am start -a android.intent.action.VIEW \
  -d "cyclic://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

> Cần **hai** forward: 8081 cho Metro (nếu không thì treo ở splash) và 7025 cho server (nếu không thì app báo "Cannot reach the server"). Rất dễ nhớ cái đầu mà quên cái sau.

Trên máy thật thì dùng `localhost`, **không** phải `10.0.2.2` - xem ngay dưới.

`scripts/rebuild-native.ps1` nhận `-Device <serial>` và tự chọn `localhost` hay `10.0.2.2` theo loại máy; bỏ trống thì lấy máy đầu tiên ở trạng thái `device`.

> **Nhiều emulator cùng mở = nhìn nhầm bản cũ.** Đã dính một lần: hai cửa sổ emulator, một cái mất kết nối adb nhưng vẫn hiển thị bundle cũ, tưởng là code không ăn. `adb devices` trước khi kết luận, và `adb -s <serial> emu kill` cái thừa.

---

### Nối app với server CyclicTrivia lúc dev

Server chạy ở `https://localhost:7025` (profile `https` trong `CyclicTrivia/Properties/launchSettings.json`, mở cả 7025 HTTPS và 5276 HTTP). Địa chỉ nằm ở [src/api/config.ts](src/api/config.ts).

Server **chỉ bind vào `127.0.0.1`**, không phải `0.0.0.0` — nên trỏ app vào IP LAN sẽ không tới được. Bắt buộc forward qua cáp:

```bash
adb -s R5GL607M1TW reverse tcp:7025 tcp:7025
```

> Quên lệnh này thì app báo **"Cannot reach the server"**. Đây là thứ dễ quên nhất mỗi khi cắm lại máy hoặc restart adb — `adb reverse --list` để kiểm tra.

**Vì sao HTTPS chạy được dù chứng chỉ là self-signed**

Chứng chỉ do `dotnet dev-certs` sinh ra tự ký, Android từ chối theo mặc định — và lỗi duy nhất app thấy được là "Network request failed", không hề nhắc tới TLS.

Bản debug tin được nó nhờ [plugins/withDevHttps.js](plugins/withDevHttps.js): plugin nhúng chính chứng chỉ đó (`certs/aspnet_dev.crt`) làm **trust anchor riêng của app**. Không phải cài gì lên điện thoại, không đụng kho CA hệ thống, và chỉ app này tin nó. Bản release không bị ảnh hưởng.

Hostname khớp được là vì đi qua `adb reverse` nên app gọi đúng `localhost`, mà chứng chỉ có `CN=localhost` / SAN `DNS:localhost`.

**Khi chứng chỉ hết hạn** (bản hiện tại: 30/12/2026) hoặc sau khi chạy `dotnet dev-certs https --clean`:

```bash
dotnet dev-certs https --export-path certs/aspnet_dev.crt --format PEM
```

rồi prebuild + build lại. Plugin là config plugin chứ không phải file chép tay vào `android/` vì `expo prebuild` xoá sạch thư mục đó — chép tay sẽ mất ở lần prebuild sau.

> **Tắt server sau khi test.** Tiến trình đang chạy giữ `bin\Debug\net8.0\CyclicTrivia.dll`, Visual Studio sẽ không build được.

---

**`adb reverse` KHÔNG hoạt động trên emulator này** (nhưng chạy tốt trên máy thật qua USB). Đã thử và xác minh: `adb reverse tcp:8081 tcp:8081` chạy thành công, `adb reverse --list` liệt kê đúng mapping, nhưng gọi vào `127.0.0.1:8081` từ máy ảo **không trả về gì**. Trong khi `10.0.2.2:8081` trả `HTTP/1.1 200 OK`. → Luôn dùng `10.0.2.2`, đừng mất thời gian với `adb reverse`.

Kiểm tra nhanh emulator có với được Metro không (không có `curl` trên máy ảo, dùng `nc`):

```bash
adb -s emulator-5554 shell "echo -e 'GET /status HTTP/1.0\r\n\r' | nc 10.0.2.2 8081 | head -1"
# mong đợi: HTTP/1.1 200 OK
```

Deep link để mở dev build (khác Expo Go — Expo Go dùng `exp://…` + package `host.exp.exponent`):

```bash
adb -s emulator-5554 shell am start -a android.intent.action.VIEW \
  -d "cyclic://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"
```

Biết bundle xong chưa: nhìn terminal Metro chờ dòng `Android Bundled 600ms node_modules\expo-router\entry.js (1773 modules)`.

---

## Lệch phiên bản package

**Luôn chạy lệnh này trước khi debug lỗi lạ lúc khởi tạo module:**

```bash
npx expo install --check
```

Đã dính một lần: `react-native-worklets@0.12.1` trong khi SDK cần `0.10.1`. Triệu chứng là `TypeError: undefined is not a function` ở dòng `import { Stack } from 'expo-router'` — **hoàn toàn không gợi ý gì tới worklets**. Chuỗi nhân quả: expo-router import reanimated, reanimated cần worklets, lệch phiên bản → vỡ lúc khởi tạo module.

---

## Shell: PowerShell 5.1 không có `&&`

Máy này chạy **Windows PowerShell 5.1**, không phải bash hay PowerShell 7. Nối lệnh bằng `&&` sẽ báo:

```
The token '&&' is not a valid statement separator in this version.
```

Cũng không có `||`, `?:`, `??`. Muốn nối có điều kiện thì dùng `if ($LASTEXITCODE -eq 0) { ... }`.

Vì vậy quy trình build native được đóng gói sẵn thành script, đừng gõ tay chuỗi lệnh dài:

```bash
powershell -ExecutionPolicy Bypass -File E:\Projects\CyclicTriviaApp\scripts\rebuild-native.ps1
```

---

## Sửa `app.json` xong PHẢI chạy `expo prebuild`

`npx expo run:android` **bỏ qua bước prebuild** khi thư mục `android/` đã tồn tại. Nghĩa là mọi thay đổi trong `app.json` thuộc về cấu hình native — splash, icon, tên app, permissions, scheme — **sẽ không có tác dụng**, dù build báo SUCCESSFUL.

Triệu chứng cực dễ nhầm: build xanh, app cài lại, nhưng màn hình vẫn y như cũ. Tôi mất hai vòng build mới nhận ra.

Kiểm chứng bằng dấu thời gian của file được sinh:

```bash
ls -la android/app/src/main/res/drawable-xxxhdpi/splashscreen_logo.png
```

Nếu nó cũ hơn lúc sửa `app.json` thì prebuild chưa chạy:

```bash
npx expo prebuild --platform android     # sinh lại từ app.json
cd android && ./gradlew assembleDebug    # rồi mới build
```

---

## Cẩn thận với `npm install --no-save`

Đã dính một lần: `npm install --no-save sharp --legacy-peer-deps` làm npm **dọn lại toàn bộ cây phụ thuộc** và xoá mất `react-native-gesture-handler` — package mà expo-router phụ thuộc ngầm, không có trong `package.json` nên npm coi là thừa.

Triệu chứng lúc build:

```
Configuring project ':react-native-gesture-handler' without an existing directory is not allowed.
```

Khắc phục: `npx expo install react-native-gesture-handler`, rồi `npx expo install --check` để xác nhận. Cần cài công cụ tạm thì dùng thư mục khác hoặc `npx` thay vì `--no-save` trong project.

---

## Hiệu ứng phát sáng: dùng `boxShadow`, không dùng `shadow*` cũ

Bộ `shadowColor` / `shadowRadius` / `shadowOpacity` **chỉ nhận MỘT lớp bóng**, và trên Android nó rơi về `elevation` - vốn không đổi được màu. Không dựng được quầng neon nhiều tầng bằng nó.

RN 0.76+ (dự án này ở 0.86, New Architecture) đã có các thuộc tính style kiểu CSS. Đã kiểm chứng chạy thật trên emulator Android:

| Thuộc tính | Dùng ở đâu |
|---|---|
| `boxShadow` nhiều lớp | quầng ngoài nút: `0 0 18px …, 0 0 46px …, 0 0 90px …` |
| `boxShadow` với `inset` | gờ trắng 1px cạnh trên + ánh sáng neon hắt vào trong thân nút |
| `filter: 'drop-shadow(...)'` | glow quanh nét icon SVG |

Công thức nằm tập trung trong [src/theme/colors.ts](src/theme/colors.ts) (`outerGlow`, `innerGlow`, `iconGlow`) - sửa ở đó, đừng chỉnh lẻ trong component.

**Hai chỗ RN vẫn không theo được CSS:**

- `textShadow*` chỉ nhận một lớp. Chevron cần hai (14px + 30px) nên phải xếp chồng hai `<Text>` cùng glyph, cùng vị trí, khác bán kính bóng. Đừng đặt `color: 'transparent'` cho lớp dưới - trên Android bóng chữ vẽ theo paint của glyph, chữ trong suốt thì mất luôn bóng.
- Không có `mask-image`. Vùng chấm halftone tắt dần phải đi qua `<Mask>` của `react-native-svg`.

---

## Đừng tự tạo `babel.config.js`

Template blank **không có** file này, và đó là chủ ý — `babel-preset-expo` tự lo cả expo-router lẫn worklet plugin của Reanimated.

Tự thêm vào sẽ **ghi đè** cấu hình mặc định và làm hỏng expo-router. File `babel.config.js.bak` còn trong repo là dấu tích của lần thử sai đó; xoá được.

---

## Emulator

AVD `CyclicPhone` (tạo tay, Pixel dọc 1080×2340, API 33). AVD duy nhất có sẵn trên máy là `Honda_IVI_LHD_API30` — màn hình xe hơi nằm ngang, không dùng để xem app dọc được.

```bash
emulator -avd CyclicPhone -gpu host -memory 4096 -no-snapshot -no-boot-anim
```

- **`-memory 4096` là bắt buộc.** Lần đầu tôi đặt 2048 → RAM cạn sạch (1858/2013MB), `graphics.composer` và `graphics.allocator` kẹt 100% CPU, emulator đứng hình.
- **`-gpu host`** để dùng GPU thật. Không có nó, log báo `Failed to load opengl32sw` rồi rơi về render phần mềm rất chậm.

**Chấm đen giữa mép trên màn hình** là punch-hole camera giả lập của skin AVD, **không phải lỗi app**. Đừng tắt vĩnh viễn — app cần chạy đúng trên máy có notch, đó là lý do `SafeAreaView` bọc nội dung.

---

## Splash screen: Expo Go vs dev build

Trong **Expo Go**, màn chờ là **UI của Expo Go**, không phải của app. Dấu hiệu: có thanh `Bundling xx%`. Nó tự vẽ khung xám bo góc, tự ghép icon nền trong suốt lên **nền trắng**, và tự hiện tên project.

**Cấu hình `expo-splash-screen` trong `app.json` không tác động được vào đó** — Expo Go là app dựng sẵn, không đọc cấu hình splash native của project.

→ Muốn splash đúng thiết kế thì phải chạy **development build**:

```bash
npx expo run:android --device emulator-5554
```

Dev build cũng cần thiết về sau cho deep link (luồng mời) và các native module Expo Go không đóng gói.

---

## Chụp màn hình emulator

Git Bash biến `/sdcard/...` thành đường dẫn Windows. Dùng PowerShell, và **đừng** redirect `adb exec-out screencap -p > file.png` trong PowerShell — nó là redirect văn bản, làm hỏng file nhị phân.

```powershell
adb -s emulator-5554 shell screencap -p /sdcard/s.png
adb -s emulator-5554 pull /sdcard/s.png .\s.png
```
