# Boot mot Android emulator. CHI co vay, khong lam gi khac.
#
# Dung:  powershell -ExecutionPolicy Bypass -File scripts\start-emulator.ps1
#        powershell -ExecutionPolicy Bypass -File scripts\start-emulator.ps1 -Avd CyclicPhone2 -Port 5556
#        powershell -ExecutionPolicy Bypass -File scripts\start-emulator.ps1 -List
#
# KHONG chay Metro, KHONG adb reverse, KHONG mo app, KHONG dung toi cong 8081.
# Xong roi thi chay tiep:
#
#     powershell -ExecutionPolicy Bypass -File scripts\start-metro.ps1 -Device emulator-5554
#
# ⚠️ `scripts\run-emulator.sh` (ban cu, 25/08) KHONG boot emulator - no gia dinh
# emulator da chay san roi chi `am start` vao `emulator-5554`. Chua co may ao thi
# no bao `device not found`, ma loi do bi `>/dev/null 2>&1` nuot mat va `set -e`
# lam script thoat im lang - trong nhu treo chu khong nhu hong. No con giet luon
# tien trinh giu cong 8081 truoc khi chet, tuc keo sap ca Metro cua may that.

# `param()` PHAI la cau lenh dau tien cua file (chi duoc phep co comment o tren).
param(
    # Ten AVD. `-List` de xem co nhung cai nao.
    [string]$Avd = 'CyclicPhone',
    # Cong console cua emulator; serial se la `emulator-<Port>`.
    # 5554 = may thu nhat, 5556 = may thu hai (chay song song duoc).
    [int]$Port = 5554,
    # Tra ve ngay sau khi bat tien trinh, khong cho boot xong.
    [switch]$NoWait,
    # Chi liet ke AVD roi thoat.
    [switch]$List
)

$ErrorActionPreference = 'Stop'

# ⚠️ ANDROID_HOME / ANDROID_SDK_ROOT o cap may DANG TRO SAI:
# `C:\Users\Vi\.antidetect-cloud-android\sdk` - thu muc do KHONG TON TAI (rac cua
# mot du an khac). SDK that nam o D:\AndroidSDK. Dat de o day cho chac, giong
# build-apk.ps1 dang lam. Dung go bo neu chua sua bien moi truong cua may.
$Sdk = 'D:\AndroidSDK'
$env:ANDROID_HOME     = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk

$Emulator = Join-Path $Sdk 'emulator\emulator.exe'
if (-not (Test-Path $Emulator)) {
    # Du phong: lay tu PATH neu SDK doi cho.
    $fromPath = (Get-Command emulator -ErrorAction SilentlyContinue).Source
    if ($fromPath) {
        $Emulator = $fromPath
    } else {
        Write-Host "Khong tim thay emulator.exe (da tim: $Emulator, va PATH)." -ForegroundColor Red
        exit 1
    }
}

# Khong dat `2>$null` o day: xem ghi chu ve NativeCommandError o cuoi file.
$avds = & $Emulator -list-avds | Where-Object { $_ -match '\S' }

if ($List) {
    Write-Host 'AVD co san:' -ForegroundColor Cyan
    $avds | ForEach-Object { Write-Host "  $_" }
    exit 0
}

if ($avds -notcontains $Avd) {
    Write-Host "Khong co AVD ten '$Avd'. Cac AVD co san:" -ForegroundColor Red
    $avds | ForEach-Object { Write-Host "  $_" }
    exit 1
}

$Serial = "emulator-$Port"

# Dang chay roi thi thoi, dung boot chong len.
$running = adb devices | Select-String "^$Serial\s"
if ($running) {
    Write-Host "$Serial da chay san. Khong lam gi ca." -ForegroundColor Yellow
    exit 0
}

# ⚠️ Ba co nay KHONG phai trang tri:
#   -memory 4096   dat 2048 thi RAM can sach, graphics.composer va
#                  graphics.allocator ket 100% CPU, emulator dung hinh.
#   -gpu host      thieu thi log bao `Failed to load opengl32sw` roi roi ve
#                  render phan mem, cham den muc khong dung duoc.
#   -no-snapshot   boot sach, tranh khoi phuc trang thai cu cua may ao.
#
# ⚠️ Hai instance cua CUNG mot AVD chi chay duoc khi CA HAI cung co `-read-only`.
# Vi vay may thu hai la mot AVD NHAN BAN (`CyclicPhone2`), khong phai co do -
# `-read-only` khong giu lai app da cai.
Write-Host "Boot $Avd tren cong $Port ..." -ForegroundColor Cyan
Start-Process -FilePath $Emulator `
    -ArgumentList @('-avd', $Avd, '-gpu', 'host', '-memory', '4096', '-no-snapshot', '-no-boot-anim', '-port', $Port) `
    -WindowStyle Normal

if ($NoWait) {
    Write-Host "Da bat tien trinh. Kiem tra bang: adb devices" -ForegroundColor Green
    exit 0
}

# Cho boot xong.
#
# ⚠️ Hai cai bay o buoc nay, dinh ca hai roi moi ra:
#
# 1. `adb wait-for-device` KHONG du. No tra ve ngay khi adb THAY thiet bi, luc
#    do Android van dang boot; phai doi han `sys.boot_completed` bang 1.
# 2. Trong luc boot, serial hien ra voi trang thai `offline`, va goi
#    `adb -s ... shell` vao no thi adb ghi `device offline` ra STDERR. Tren
#    Windows PowerShell 5.1, stderr cua mot exe bi boc thanh ErrorRecord
#    (NativeCommandError), ma file nay dat `$ErrorActionPreference = 'Stop'`
#    nen script CHET giua chung du emulator van dang boot binh thuong.
#    Vi vay: doc `adb devices` (khong bao gio ghi stderr) de biet da sang
#    `device` chua, roi MOI hoi getprop. Dung them `2>$null` - chinh no la bay.
Write-Host 'Cho boot...' -ForegroundColor DarkGray
$deadline = (Get-Date).AddMinutes(5)
$booted = ''
do {
    Start-Sleep -Seconds 5
    $line = adb devices | Select-String "^$Serial\s+(\S+)"
    if ($line -and $line.Matches[0].Groups[1].Value -eq 'device') {
        $booted = (adb -s $Serial shell getprop sys.boot_completed | Out-String).Trim()
    }
} while ($booted -ne '1' -and (Get-Date) -lt $deadline)

if ($booted -ne '1') {
    Write-Host "$Serial chua boot xong sau 5 phut. Xem cua so emulator." -ForegroundColor Red
    exit 1
}

Write-Host "`n$Serial da san sang." -ForegroundColor Green
Write-Host 'Chay app len no:' -ForegroundColor DarkGray
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\start-metro.ps1 -Device $Serial" -ForegroundColor DarkGray
