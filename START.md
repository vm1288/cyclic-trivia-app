# Chạy lên — khi máy đã setup xong

Chỉ gồm việc phải làm **mỗi lần ngồi vào bàn**. Cài đặt lần đầu, và mọi bẫy môi
trường đã gặp, nằm ở [SETUP_NOTES.md](SETUP_NOTES.md) — chỉ mở file đó khi có
thứ gì đó hỏng.

Máy đích: Samsung SM-A175F, serial `R5GL607M1TW`. Cắm USB và mở khoá máy trước.

---

## Ba bước

### 1. Server

```powershell
cd E:\Projects\CyclicTrivia
dotnet run --project CyclicTrivia.csproj --launch-profile https
```

### 2. Metro

```powershell
powershell -ExecutionPolicy Bypass -File E:\Projects\CyclicTriviaApp\scripts\start-metro.ps1
```

Script này làm ba việc: dọn Metro cũ, đặt hai đường `adb reverse` (8081 + 5276),
rồi mở app trên máy. Thêm `-Visible` khi cần nhìn console Metro; mặc định nó đổ
ra `%TEMP%\cyclic-metro.log`.

> ⚠️ **Chạy script này ngay cả khi Metro có vẻ vẫn đang chạy từ hôm trước.**
>
> Hai đường `adb reverse` **mất mỗi lần rút/cắm lại máy hoặc adb khởi động
> lại**, trong khi Metro vẫn sống nhăn. Lúc đó nhìn đâu cũng thấy "đang chạy
> ngon" mà app thì treo ở splash — đã mất một vòng debug đúng vì chuyện này
> (2026-09-08). Script tự đặt lại forward nên chạy lại là xong.

### 3. Xong việc thì tắt server

```powershell
Get-Process -Name CyclicTrivia -ErrorAction SilentlyContinue | Stop-Process -Force
```

> Để nguyên thì tiến trình giữ `bin\Debug\net8.0\CyclicTrivia.dll`, và lần build
> sau fail ở bước copy — nhìn như lỗi biên dịch nhưng không phải.

---

## Khi nào cần build lại APK

| Sửa gì | Làm gì |
|---|---|
| `.ts` / `.tsx` | không cần build, Metro tự nạp |
| `app.json`, thêm native module | `scripts\build-apk.ps1` (nó chạy prebuild) |
| thêm/bớt nhân vật | `CyclicTrivia\scripts\build-characters.ps1`, sửa `wwwroot\character-sets.json`, **restart server** |

> ⚠️ Sửa **animation** xong thì force-stop app rồi mở lại. Fast refresh không
> nạp lại vòng animation đang chạy, đo sẽ ra kết quả sai hướng.

---

## Test luật cần hai người mà chỉ có một máy

```bash
node scripts/dev-room.mjs 8888 probe-crictriv
```

Mở sẵn phòng 2 người, in ra mã phòng, đợi điện thoại vào rồi tự bấm ready +
start. `8888` là board CricTriv (oval), `916160` là board chữ nhật.

---

## Hỏng thì tra ở đâu

Trước hết luôn là hai đường forward. Chúng phải in ra **hai** dòng:

```bash
adb -s R5GL607M1TW reverse --list
```

| Thiếu | Triệu chứng |
|---|---|
| `tcp:8081` | app **treo ở splash**, không bao giờ bundle |
| `tcp:5276` | app vào được nhưng báo "Cannot reach the server" |

Đặt lại bằng cách chạy `start-metro.ps1`, hoặc bằng tay:

```bash
adb -s R5GL607M1TW reverse tcp:8081 tcp:8081
adb -s R5GL607M1TW reverse tcp:5276 tcp:5276
```

Còn lại:

| Triệu chứng | Xem |
|---|---|
| `adb devices` báo `unauthorized` | mở khoá máy, bấm **Allow** ở hộp thoại USB debugging |
| Sửa `app.json` mà không thấy đổi gì | phải `build-apk.ps1`, Metro không nạp được thay đổi này |
| Mọi thứ khác | [SETUP_NOTES.md](SETUP_NOTES.md) |

Đọc log server: `SELECT TOP 30 TimeStamp, Message FROM Logs ORDER BY Id DESC`
(`VI-PC\SQLEXPRESS`, database `CyclicTrivia`). Serilog để `MinimumLevel.Error()`
nên **mọi** log đều ghi ở mức `Error`, kể cả log thông tin. Thấy dòng
`Client ... connected` là máy đã chạm tới server — lúc đó vấn đề không còn ở
mạng nữa.
