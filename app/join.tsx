import { PlaceholderScreen } from '../src/components/PlaceholderScreen';

export default function JoinScreen() {
  return (
    <PlaceholderScreen
      title="JOIN A GAME"
      todo={'Nhập mã phòng + nickname.\nBackend: GET /api/room/{code} đã có.\nCÒN THIẾU: POST vào phòng bằng mã (xem NEXT_STEPS.md).'}
    />
  );
}
