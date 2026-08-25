#!/usr/bin/env bash
# Chạy app lên Android emulator (development build, KHÔNG phải Expo Go).
#
# Vì sao cần script này thay vì `npx expo start --android`:
#
# 1. `--android` mở app bằng IP LAN của máy host (exp://192.168.x.x). Emulator
#    KHÔNG với tới được địa chỉ đó. Phải dùng 10.0.2.2 - alias mà emulator ánh
#    xạ về máy host.
# 2. KHÔNG dùng cờ `--localhost`: nó khiến Metro chỉ bind [::1] (IPv6 loopback),
#    trong khi 10.0.2.2 đi vào IPv4 loopback -> không có gì lắng nghe ở đó.
# 3. Metro hay để lại tiến trình giữ cổng sau khi thoát, làm lần chạy sau báo
#    "Port is being used" rồi bỏ luôn dev server.
# 4. CỔNG PHẢI LÀ 8081. Dev build hỏi bundle ở cổng mặc định của React Native
#    (localhost:8081). Chạy Metro ở cổng khác thì app treo ở splash, logcat báo:
#      "The device must either be USB connected (with bundler set to
#       localhost:8081) or..." - không hề nhắc gì tới cổng ta đang chạy.
#    `adb reverse` ĐÃ THỬ VÀ KHÔNG HOẠT ĐỘNG trên emulator này (dù
#    `adb reverse --list` có liệt kê mapping), nên bắt buộc đi qua 10.0.2.2.
set -euo pipefail

PORT="${PORT:-8081}"
DEVICE="${DEVICE:-emulator-5554}"
SCHEME="${SCHEME:-cyclic}"

echo "==> giải phóng cổng $PORT"
if command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -Command "
    netstat -ano | Select-String ':$PORT\s+.*LISTENING' |
      ForEach-Object { (\$_ -split '\s+')[-1] } | Sort-Object -Unique |
      ForEach-Object { Stop-Process -Id \$_ -Force -ErrorAction SilentlyContinue }
  " >/dev/null 2>&1 || true
else
  pkill -f "expo start" 2>/dev/null || true
fi
sleep 3

echo "==> khởi động Metro (bind mọi interface)"
npx expo start --port "$PORT" "$@" >/tmp/expo.log 2>&1 &
sleep 30

echo "==> mở app qua 10.0.2.2 (alias trỏ về máy host)"
# Dev build dùng deep link của expo-development-client + scheme trong app.json.
# (Expo Go thì mới là `exp://...` + package host.exp.exponent.)
adb -s "$DEVICE" shell am force-stop com.cyclictrivia.app >/dev/null 2>&1 || true
adb -s "$DEVICE" shell am start -a android.intent.action.VIEW \
  -d "$SCHEME://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A$PORT" >/dev/null 2>&1

echo "==> chờ bundle..."
until grep -qE "Android Bundled|Bundling failed|Unable to resolve" /tmp/expo.log; do sleep 4; done
grep -E "Android Bundled|Bundling failed|Unable to resolve" /tmp/expo.log | head -3
