# build-aab.ps1 - Android App Bundle (.aab) de UPLOAD LEN PLAY CONSOLE (K124, 22/9).
#
#   powershell -ExecutionPolicy Bypass -File scripts\build-aab.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\build-aab.ps1 -ServerUrl https://trivia-asia.cyclicdigital.com
#
# Khac build-apk.ps1: ra .aab (Play khong nhan APK cho track nao nua), ky bang UPLOAD KEY trong
# keys\upload.properties (plugins\withReleaseSigning.js chen signingConfig luc prebuild). Thieu file do
# thi bundle bi ky debug.keystore -> Play tu choi neu app da co upload key -> script dung lai.
#
# versionCode lay tu app.json (expo.android.versionCode) - MOI LAN upload len Play PHAI TANG so nay.
param(
    [string]$ServerUrl = 'https://trivia-asia.cyclicdigital.com'
)
$ErrorActionPreference = 'Stop'
$AppDir = 'E:\Projects\CyclicTriviaApp'
Set-Location $AppDir

if (-not (Test-Path (Join-Path $AppDir 'keys\upload.properties'))) {
    Write-Host 'Thieu keys\upload.properties (upload keystore). Xem plugins\withReleaseSigning.js.' -ForegroundColor Red
    exit 1
}
$env:ANDROID_HOME     = 'D:\AndroidSDK'
$env:ANDROID_SDK_ROOT = 'D:\AndroidSDK'
$env:EXPO_PUBLIC_API_URL = $ServerUrl.TrimEnd('/')
Remove-Item Env:CYCLIC_ALLOW_CLEARTEXT -ErrorAction SilentlyContinue
Write-Host "AAB release -> server $env:EXPO_PUBLIC_API_URL" -ForegroundColor Cyan

# prebuild (nhu build-apk.ps1: android/ duoc tao lai, plugin ky release duoc ap)
if (Test-Path (Join-Path $AppDir 'android\gradlew.bat')) {
    Push-Location (Join-Path $AppDir 'android'); try { .\gradlew.bat --stop 2>&1 | Out-Null } catch {}; Pop-Location
}
npx expo prebuild --platform android
if ($LASTEXITCODE -ne 0) { Write-Host 'prebuild THAT BAI.' -ForegroundColor Red; exit 1 }

Push-Location (Join-Path $AppDir 'android')
.\gradlew.bat bundleRelease
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { Write-Host 'bundleRelease THAT BAI.' -ForegroundColor Red; exit 1 }

$aab = Join-Path $AppDir 'android\app\build\outputs\bundle\release\app-release.aab'
$ver = (Get-Content (Join-Path $AppDir 'app.json') -Raw | ConvertFrom-Json).expo.android.versionCode
$out = Join-Path $AppDir ("dist\CricTriv-v{0}-{1}.aab" -f $ver, (Get-Date -Format 'yyyyMMdd-HHmm'))
New-Item -ItemType Directory -Force (Join-Path $AppDir 'dist') | Out-Null
Copy-Item $aab $out -Force
Write-Host "AAB: $out ($([math]::Round((Get-Item $out).Length / 1MB, 1)) MB, versionCode $ver)" -ForegroundColor Green
Write-Host 'Upload: Play Console -> Testing -> Internal testing -> Create new release -> keo file nay vao.' -ForegroundColor Yellow
