# Khoi dong Metro va noi may that voi server CyclicTrivia.
#
# Dung:  powershell -ExecutionPolicy Bypass -File scripts\start-metro.ps1
#        powershell -ExecutionPolicy Bypass -File scripts\start-metro.ps1 -Device emulator-5554
#        powershell -ExecutionPolicy Bypass -File scripts\start-metro.ps1 -NoLaunch
#
# Script nay KHONG build gi ca. Sua file .ts/.tsx thi chi can cai nay.
# Sua app.json hoac them native module -> dung scripts\build-apk.ps1.

# `param()` PHAI la cau lenh dau tien cua file (chi duoc phep co comment o tren).
param(
    # Serial may dich. Bo trong = lay may dau tien dang o trang thai `device`.
    [string]$Device,
    # Chi khoi dong Metro, khong mo app tren may.
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'

$AppDir  = 'E:\Projects\CyclicTriviaApp'
$Package = 'com.cyclictrivia.app'

# Hai cong PHAI forward, thieu cai nao cung co trieu chung rieng:
#   8081 - Metro. Thieu thi app treo o splash, khong bao gio bundle.
#   5276 - server CyclicTrivia. Thieu thi app bao "Cannot reach the server".
$Ports = @(8081, 5276)

if (-not $Device) {
    $Device = (adb devices | Select-String '^\S+\s+device$' | Select-Object -First 1) -replace '\s+device$', ''
}
if (-not $Device) {
    Write-Host 'Khong tim thay may nao o trang thai `device`. Cam USB va mo khoa may.' -ForegroundColor Red
    exit 1
}
Write-Host "May dich: $Device" -ForegroundColor Cyan

Set-Location $AppDir

# ── 1. Don Metro cu ───────────────────────────────────────────────────────
# `pkill -f "expo start"` KHONG du: tien trinh cu van giu cong 8081, va Metro
# moi se bao "Port 8081 is being used" roi BO LUON dev server (che do
# non-interactive khong hoi duoc). Phai kill theo PID dang LISTEN.
$old = netstat -ano | Select-String ':8081\s.*LISTENING'
if ($old) {
    $pids = $old | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -Unique
    foreach ($processId in $pids) {
        Write-Host "Dung Metro cu (PID $processId)..." -ForegroundColor DarkGray
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 3
}

# ── 2. Khoi dong Metro ────────────────────────────────────────────────────
$Log = Join-Path $env:TEMP 'cyclic-metro.log'
Write-Host "`nKhoi dong Metro (log: $Log)..." -ForegroundColor Cyan
Start-Process -FilePath 'cmd.exe' `
    -ArgumentList "/c npx expo start --port 8081 > `"$Log`" 2>&1" `
    -WindowStyle Hidden

$deadline = (Get-Date).AddSeconds(90)
do {
    Start-Sleep -Seconds 3
    $up = netstat -ano | Select-String ':8081\s.*LISTENING'
} while (-not $up -and (Get-Date) -lt $deadline)

if (-not $up) {
    Write-Host "Metro khong len sau 90 giay. Xem log: $Log" -ForegroundColor Red
    exit 1
}
Write-Host 'Metro da san sang o cong 8081.' -ForegroundColor Green

# ── 3. Forward cong ───────────────────────────────────────────────────────
# `adb reverse` CHAY duoc ca tren may that lan emulator (da do lai 2026-08-26).
# Ghi chu cu trong SETUP_NOTES tung noi nguoc lai - da sua.
Write-Host "`nForward cong..." -ForegroundColor Cyan
foreach ($port in $Ports) {
    adb -s $Device reverse "tcp:$port" "tcp:$port" | Out-Null
    Write-Host "  tcp:$port -> tcp:$port"
}

# ── 4. Mo app ─────────────────────────────────────────────────────────────
if ($NoLaunch) {
    Write-Host "`nXong. Tu mo app tren may." -ForegroundColor Green
    exit 0
}

Write-Host "`nMo app tren may..." -ForegroundColor Cyan
adb -s $Device shell am force-stop $Package
Start-Sleep -Seconds 2

# Deep link cua DEV BUILD. Expo Go dung `exp://...` + package host.exp.exponent,
# khong phai cai nay.
adb -s $Device shell am start -a android.intent.action.VIEW `
    -d 'cyclic://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081' | Out-Null

Write-Host "`nXong. Cho dong 'Android Bundled ...' trong log:" -ForegroundColor Green
Write-Host "  Get-Content `"$Log`" -Tail 5 -Wait" -ForegroundColor DarkGray
Write-Host "`nNHO: server CyclicTrivia phai dang chay (profile https)." -ForegroundColor Yellow
