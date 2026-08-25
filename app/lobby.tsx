import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '../src/components/PlaceholderScreen';
import { useLicense } from '../src/session/LicenseSession';

export default function LobbyScreen() {
  const params = useLocalSearchParams<{ gameId?: string }>();
  const license = useLicense();

  /*
   * gameId đến từ hai đường: tham số route (vừa tạo ván xong) và phiên đã lưu
   * (bấm RESUME GAME từ màn hình chính). Ưu tiên tham số vì nó luôn là ván mới
   * nhất; phiên lưu là đường dự phòng khi mở lại app.
   */
  const stored = license.status === 'active' ? license.session.currentGameId : null;
  const gameId = params.gameId ?? stored;

  return (
    <PlaceholderScreen
      title="WAITING FOR PLAYERS"
      todo={
        `Ván: ${gameId ?? '(thiếu gameId)'}\n\n` +
        'Màn này cần: QR + room code để người chơi vào, danh sách người chơi đã vào (cập nhật realtime qua SignalR), nút bắt đầu.\n\n' +
        'CÒN VƯỚNG: room code hiện chỉ cấp qua gói SignalR JoinSession của Main Device, chưa có endpoint HTTP cho app.'
      }
    />
  );
}
