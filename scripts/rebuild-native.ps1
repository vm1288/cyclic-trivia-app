# Build lại native sau khi đổi app.json hoặc asset native (splash, icon).
#
# Vì sao cần script này:
#   - `npx expo run:android` BỎ QUA prebuild khi thư mục android/ đã tồn tại,
#     nên thay đổi trong app.json sẽ im lặng không có tác dụng (build vẫn báo
#     SUCCESSFUL, app vẫn cài được, nhưng splash/icon y như cũ).
#   - Windows PowerShell 5.1 không có toán tử `&&`, không nối lệnh kiểu bash được.
#
# Dùng:  powershell -ExecutionPolicy Bypass -File scripts\rebuild-native.ps1
#        powershell -ExecutionPolicy Bypass -File scripts\rebuild-native.ps1 -Device R5GL607M1TW

# `param()` PHAI la cau lenh dau tien cua file (chi duoc phep co comment o
# tren). Dat sau bat ky lenh nao khac, ke ca `$ErrorActionPreference`, se loi
# "The term 'param' is not recognized".
param(
    # Serial cua may dich. Bo trong = lay may dau tien dang o trang thai `device`.
    [string]$Device
)

$ErrorActionPreference = 'Stop'

$AppDir = 'E:\Projects\CyclicTriviaApp'
$Apk    = Join-Path $AppDir 'android\app\build\outputs\apk\debug\app-debug.apk'

if (-not $Device) {
    $Device = (adb devices | Select-String '^\S+\s+device$' | Select-Object -First 1) -replace '\s+device$', ''
}
if (-not $Device) { Write-Host 'Khong tim thay may nao o trang thai `device`.' -ForegroundColor Red; exit 1 }
Write-Host "May dich: $Device" -ForegroundColor Cyan

# May that noi qua USB thi `adb reverse` chay tot -> Metro o localhost:8081.
# Emulator thi KHONG (da kiem chung), phai di qua 10.0.2.2. Xem SETUP_NOTES.md.
$IsEmulator = $Device -like 'emulator-*'
$MetroHost  = if ($IsEmulator) { '10.0.2.2' } else { 'localhost' }

$env:ANDROID_HOME     = 'D:\AndroidSDK'
$env:ANDROID_SDK_ROOT = 'D:\AndroidSDK'

# QUAN TRỌNG: `expo prebuild` XOÁ rồi tạo lại thư mục android/. Bất cứ tiến trình
# nào đang giữ thư mục đó sẽ làm nó thất bại với `EBUSY: resource busy or locked`.
# Thủ phạm hay gặp nhất là chính cái shell đang đứng bên trong android/ - kể cả
# shell chạy script này, nếu lần chạy trước thoát giữa chừng mà không quay ra.
# Vì vậy toàn bộ phần dưới nằm trong try/finally để luôn trả cwd về $AppDir.
try {
    Set-Location $AppDir

    Write-Host "`n[0/3] Dung gradle daemon (no giu file trong android/)..." -ForegroundColor Cyan
    if (Test-Path (Join-Path $AppDir 'android\gradlew.bat')) {
        Push-Location (Join-Path $AppDir 'android')
        try { .\gradlew.bat --stop 2>&1 | Out-Null } catch {}
        Pop-Location
    }
    Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    Write-Host "`n[1/3] Sinh lai cau hinh native tu app.json..." -ForegroundColor Cyan
    npx expo prebuild --platform android
    if ($LASTEXITCODE -ne 0) {
        Write-Host "prebuild THAT BAI." -ForegroundColor Red
        Write-Host "Neu loi la EBUSY/locked: dong moi cua so Explorer va tab editor dang mo trong android\, roi chay lai." -ForegroundColor Yellow
        exit 1
    }

    Write-Host "`n[2/3] Build APK (lan dau sau prebuild se lau ~5 phut)..." -ForegroundColor Cyan
    Push-Location (Join-Path $AppDir 'android')
    try {
        .\gradlew.bat assembleDebug
        $gradleExit = $LASTEXITCODE
    } finally {
        Pop-Location   # luon quay ra, ke ca khi gradle loi
    }
    if ($gradleExit -ne 0) { Write-Host "gradle THAT BAI" -ForegroundColor Red; exit 1 }

    if (-not (Test-Path $Apk)) { Write-Host "Khong tim thay APK: $Apk" -ForegroundColor Red; exit 1 }
    Write-Host "APK: $Apk ($([math]::Round((Get-Item $Apk).Length/1MB,1)) MB)" -ForegroundColor Green

    Write-Host "`n[3/3] Cai len emulator..." -ForegroundColor Cyan
    adb -s $Device install -r $Apk
    if ($LASTEXITCODE -ne 0) { Write-Host "cai dat THAT BAI" -ForegroundColor Red; exit 1 }

    Write-Host "`nXONG. Dang mo app..." -ForegroundColor Green
    # Cong 8081 la BAT BUOC: dev build hoi bundle o cong mac dinh cua React Native.
    # Chay Metro o cong khac => app treo o splash. Xem SETUP_NOTES.md.
    if (-not $IsEmulator) { adb -s $Device reverse tcp:8081 tcp:8081 | Out-Null }
    adb -s $Device shell am force-stop com.cyclictrivia.app | Out-Null
    adb -s $Device shell am start -a android.intent.action.VIEW `
        -d "cyclic://expo-development-client/?url=http%3A%2F%2F${MetroHost}%3A8081" | Out-Null
    Write-Host "Nho chay Metro o cua so khac: bash scripts/run-emulator.sh" -ForegroundColor Yellow
}
finally {
    # Khong bao gio de shell dung lai trong android/ - lan chay sau se bi EBUSY.
    Set-Location $AppDir
}
