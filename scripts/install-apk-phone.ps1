# Cai APK debug moi nhat len MAY THAT (Samsung SM-A175F). Khong build lai gi ca.
#
# Dung:  powershell -ExecutionPolicy Bypass -File scripts\install-apk-phone.ps1
#        powershell -ExecutionPolicy Bypass -File scripts\install-apk-phone.ps1 -Device R5GL607M1TW
#        powershell -ExecutionPolicy Bypass -File scripts\install-apk-phone.ps1 -Clean
#
# KHI NAO CAN CHAY: sau khi `scripts\build-apk.ps1` sinh APK moi.
# KHI NAO KHONG CAN: chi sua .ts/.tsx -> Metro tu nap lai, khong dung toi APK.

# `param()` PHAI la cau lenh dau tien cua file (chi duoc phep co comment o tren).
param(
    # Serial cu the. Bo trong = lay may THAT dau tien (bo qua moi `emulator-*`).
    [string]$Device,
    # Duong dan APK khac. Bo trong = ban debug moi build.
    [string]$Apk,
    # Go app cu truoc khi cai. Can khi APK doi chu ky
    # (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Xoa sach du lieu app, ke ca license
    # va ghe da nhan.
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'

$AppDir  = 'E:\Projects\CyclicTriviaApp'
$Package = 'com.cyclictrivia.app'

if (-not $Apk) {
    $Apk = Join-Path $AppDir 'android\app\build\outputs\apk\debug\app-debug.apk'
}
if (-not (Test-Path $Apk)) {
    Write-Host "Khong thay APK: $Apk" -ForegroundColor Red
    Write-Host 'Build truoc: powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1 -NoInstall' -ForegroundColor Yellow
    exit 1
}

# ── tim may that ──────────────────────────────────────────────────────────
$lines = adb devices

# ⚠️ Bat rieng trang thai `unauthorized`. Do la truong hop hay gap nhat va thong
# bao mac dinh cua adb khong noi phai lam gi: may chua bam Allow o hop thoai
# "Allow USB debugging?". Khong bat thi script chi bao "khong tim thay may", dan
# nguoi doc di sai huong.
$unauth = $lines | Select-String '^(\S+)\s+unauthorized$'
if ($unauth) {
    $s = $unauth[0].Matches[0].Groups[1].Value
    Write-Host "May $s dang o trang thai 'unauthorized'." -ForegroundColor Red
    Write-Host 'Mo khoa man hinh, bam ALLOW o hop thoai "Allow USB debugging?"' -ForegroundColor Yellow
    Write-Host '(tick "Always allow from this computer" cho khoi hoi lai), roi chay lai.' -ForegroundColor Yellow
    exit 1
}

if ($Device) {
    if (-not ($lines | Select-String "^$([regex]::Escape($Device))\s+device$")) {
        Write-Host "'$Device' khong o trang thai ``device``. Dang co:" -ForegroundColor Red
        $lines | Select-Object -Skip 1 | Where-Object { $_ -match '\S' } | ForEach-Object { Write-Host "  $_" }
        exit 1
    }
} else {
    # Loai bo emulator bang look-ahead phu dinh - .NET regex ho tro san.
    $found = $lines |
        Select-String '^(?!emulator-)(\S+)\s+device$' |
        ForEach-Object { $_.Matches[0].Groups[1].Value }

    if (-not $found) {
        Write-Host 'Khong thay may that nao.' -ForegroundColor Red
        Write-Host 'Cam USB, mo khoa may, va cho phep USB debugging. Kiem tra: adb devices' -ForegroundColor Yellow
        exit 1
    }
    $Device = @($found)[0]
    if (@($found).Count -gt 1) {
        Write-Host "Co $(@($found).Count) may that, chon cai dau: $Device" -ForegroundColor Yellow
        Write-Host '  (dung -Device <serial> de chi dinh cai khac)' -ForegroundColor DarkGray
    }
}

# ── bao ro dang cai BAN NAO ───────────────────────────────────────────────
# ⚠️ In gio build ra man hinh la co chu dich: SETUP_NOTES ghi lai chuyen "loi van
# the" nhieu lan hoa ra la dang chay binary cu. Nhin gio o day de biet APK nay co
# thuc su moi hon lan sua vua roi khong.
$item = Get-Item $Apk
Write-Host "APK   : $Apk" -ForegroundColor Cyan
Write-Host "Build : $($item.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))  ($([Math]::Round($item.Length / 1MB, 1)) MB)" -ForegroundColor Cyan
Write-Host "May   : $Device" -ForegroundColor Cyan

if ($Clean) {
    Write-Host "`nGo ban cu..." -ForegroundColor Yellow
    # ⚠️ Tren may that, -Clean xoa luon license da dang ky va ghe trong van dang
    # do (chung nam trong SecureStore cua app). Phai nhap lai ma license sau do.
    # Chua cai bao gio thi adb bao loi - do khong phai that bai, bo qua.
    $ErrorActionPreference = 'Continue'
    adb -s $Device uninstall $Package | Out-Null
    $ErrorActionPreference = 'Stop'
}

Write-Host "`nCai..." -ForegroundColor Cyan
# APK debug dong goi ca 4 ABI (arm64-v8a, armeabi-v7a, x86, x86_64) nen ban build
# cho emulator cai thang sang may that duoc, va nguoc lai.
#
# ⚠️ Ha `$ErrorActionPreference` quanh lenh nay. Khi adb that bai no ghi ra
# STDERR, ma tren PowerShell 5.1 stderr cua exe bi boc thanh ErrorRecord
# (NativeCommandError) - de 'Stop' thi script chet ngay tai day va khong bao gio
# in duoc thong bao huu ich ben duoi. Kiem tra bang $LASTEXITCODE thay vi de no
# nem exception.
$ErrorActionPreference = 'Continue'
adb -s $Device install -r $Apk
$code = $LASTEXITCODE
$ErrorActionPreference = 'Stop'

if ($code -ne 0) {
    Write-Host "`nCai THAT BAI (exit $code)." -ForegroundColor Red
    Write-Host 'Neu loi la INSTALL_FAILED_UPDATE_INCOMPATIBLE (APK doi chu ky):' -ForegroundColor Yellow
    Write-Host '  chay lai voi -Clean (se xoa sach du lieu app, ke ca license da dang ky).' -ForegroundColor Yellow
    exit 1
}

Write-Host "`nXONG. Buoc tiep theo:" -ForegroundColor Green
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\start-metro.ps1 -Device $Device" -ForegroundColor DarkGray
