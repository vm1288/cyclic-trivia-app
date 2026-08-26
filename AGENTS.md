# CyclicTrivia — app native

Expo SDK 57 / React Native 0.86 / expo-router. Server nằm ở `E:\Projects\CyclicTrivia`.

## Expo ĐÃ THAY ĐỔI

Đọc đúng tài liệu theo phiên bản tại https://docs.expo.dev/versions/v57.0.0/ trước khi viết code. Đừng viết theo trí nhớ về các bản Expo cũ.

## Đọc trước khi làm gì

| File | Khi nào đọc |
|---|---|
| [SETUP_NOTES.md](SETUP_NOTES.md) | **Trước khi debug "app không chạy".** Toàn bộ bẫy môi trường đã gặp — mỗi cái từng ngốn một vòng debug. |
| [../CyclicTrivia/NEXT_STEPS.md](../CyclicTrivia/NEXT_STEPS.md) | Trạng thái công việc, việc kế tiếp, những gì đã chốt. |
| [../CyclicTrivia/GAME_RULES.md](../CyclicTrivia/GAME_RULES.md) | Trước khi đụng vào logic ván chơi. |

Các mục có ⚠️ trong ba file trên là những chỗ đã mất một vòng debug.

## Chạy app

Máy thật Samsung `R5GL607M1TW` (ưu tiên hơn emulator). Cần **hai** forward, thiếu cái nào cũng có triệu chứng riêng:

```bash
adb -s R5GL607M1TW reverse tcp:8081 tcp:8081   # Metro, thieu thi treo o splash
adb -s R5GL607M1TW reverse tcp:7025 tcp:7025   # server, thieu thi "Cannot reach the server"
```

Sửa JS thì Metro tự nạp lại. Sửa `app.json` hoặc thêm **native module** thì phải build lại:

```bash
powershell -ExecutionPolicy Bypass -File scripts\rebuild-native.ps1 -Device R5GL607M1TW
```

Sửa nhiều file cùng lúc xong mà gặp `ReferenceError: Property 'X' doesn't exist` dù code đúng → **khởi động lại Metro**, force-stop app không chữa được.

## Quy ước trong mã nguồn

- Hiệu ứng phát sáng dùng `boxShadow` / `filter` (RN 0.76+), **không** dùng bộ `shadowColor`/`shadowRadius` cũ. Công thức gom ở `src/theme/colors.ts`.
- **Không** dùng `StyleSheet.absoluteFillObject` — RN 0.86 bỏ khai báo kiểu, và trên `<Image>` nó còn không có tác dụng.
- Animation chạy bằng Reanimated (UI thread), không dùng React state — JS thread sẽ bận vì packet SignalR.
- Chuỗi giao diện nằm ở `src/i18n/translations.ts`; mọi bản dịch phải phủ đúng tập khoá của `en`.
- Hộp thoại xác nhận dùng `useConfirm()` (`src/components/ConfirmDialog.tsx`), **không** dùng `Alert.alert` của hệ thống.
