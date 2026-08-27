# Prebuild + build APK debug + cai len may.
#
# Dung:  powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
#        powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1 -Device R5GL607M1TW
#        powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1 -NoInstall
#
# KHI NAO CAN CHAY:
#   - sua app.json (huong man hinh, splash, icon, ten app, permissions, scheme)
#   - them/bot NATIVE MODULE (expo-screen-orientation, expo-secure-store, ...)
#   - doi chung chi dev trong certs/
#
# KHI NAO KHONG CAN: chi sua .ts/.tsx -> dung scripts\start-metro.ps1, Metro tu nap lai.
#
# ⚠️ `npx expo run:android` BO QUA prebuild khi thu muc android/ da ton tai, nen
# thay doi trong app.json se im lang khong co tac dung - build van bao
# SUCCESSFUL, app van cai duoc, nhung cau hinh y nhu cu. Do la ly do script nay
# goi prebuild TUONG MINH.

# `param()` PHAI la cau lenh dau tien cua file (chi duoc phep co comment o tren).
param(
    [string]$Device,
    # Chi build, khong cai len may.
    [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'

$AppDir = 'E:\Projects\CyclicTriviaApp'
$Apk    = Join-Path $AppDir 'android\app\build\outputs\apk\debug\app-debug.apk'

$env:ANDROID_HOME     = 'D:\AndroidSDK'
$env:ANDROID_SDK_ROOT = 'D:\AndroidSDK'

if (-not $NoInstall) {
    if (-not $Device) {
        $Device = (adb devices | Select-String '^\S+\s+device$' | Select-Object -First 1) -replace '\s+device$', ''
    }
    if (-not $Device) {
        Write-Host 'Khong tim thay may nao. Dung -NoInstall neu chi muon build.' -ForegroundColor Red
        exit 1
    }
    Write-Host "May dich: $Device" -ForegroundColor Cyan
}

# ⚠️ `expo prebuild` XOA roi tao lai thu muc android/. Bat cu tien trinh nao dang
# giu thu muc do se lam no that bai voi `EBUSY: resource busy or locked`. Thu
# pham hay gap nhat la chinh cai shell dang dung ben trong android/ - ke ca shell
# chay script nay, neu lan truoc thoat giua chung ma khong quay ra. Vi vay toan
# bo phan duoi nam trong try/finally de luon tra cwd ve $AppDir.
try {
    Set-Location $AppDir

    Write-Host "`n[1/4] Dung gradle daemon (no giu file trong android/)..." -ForegroundColor Cyan
    if (Test-Path (Join-Path $AppDir 'android\gradlew.bat')) {
        Push-Location (Join-Path $AppDir 'android')
        try { .\gradlew.bat --stop 2>&1 | Out-Null } catch {}
        Pop-Location
    }
    Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    Write-Host "`n[2/4] Sinh lai cau hinh native tu app.json..." -ForegroundColor Cyan
    npx expo prebuild --platform android
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'prebuild THAT BAI.' -ForegroundColor Red
        Write-Host 'Neu loi la EBUSY/locked: dong moi cua so Explorer va tab editor dang mo trong android\, roi chay lai.' -ForegroundColor Yellow
        exit 1
    }

    Write-Host "`n[3/4] Build APK debug (vai phut)..." -ForegroundColor Cyan
    Push-Location (Join-Path $AppDir 'android')
    try {
        .\gradlew.bat assembleDebug
        $buildOk = ($LASTEXITCODE -eq 0)
    } finally {
        Pop-Location
    }

    if (-not $buildOk) { Write-Host 'Build THAT BAI.' -ForegroundColor Red; exit 1 }
    if (-not (Test-Path $Apk)) { Write-Host "Khong thay APK o $Apk" -ForegroundColor Red; exit 1 }

    $size = [Math]::Round((Get-Item $Apk).Length / 1MB, 1)
    Write-Host "`nAPK: $Apk ($size MB)" -ForegroundColor Green

    if ($NoInstall) {
        Write-Host 'Bo qua buoc cai (-NoInstall).' -ForegroundColor Yellow
        exit 0
    }

    Write-Host "`n[4/4] Cai len $Device..." -ForegroundColor Cyan
    # APK debug dong goi ca 4 ABI (arm64-v8a, armeabi-v7a, x86, x86_64) nen ban
    # build cho emulator cai thang sang may that duoc, va nguoc lai.
    adb -s $Device install -r $Apk
    if ($LASTEXITCODE -ne 0) { Write-Host 'Cai THAT BAI.' -ForegroundColor Red; exit 1 }

    Write-Host "`nXONG. Buoc tiep theo:" -ForegroundColor Green
    Write-Host '  powershell -ExecutionPolicy Bypass -File scripts\start-metro.ps1' -ForegroundColor DarkGray
}
finally {
    Set-Location $AppDir
}
