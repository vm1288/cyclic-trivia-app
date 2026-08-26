import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import {
  claimSeat,
  isRoomCodeShaped,
  normaliseRoomCode,
  resolveRoom,
  ROOM_CODE_LENGTH,
} from '../src/api/room';
import { FormScreen } from '../src/components/FormScreen';
import { NeonButton } from '../src/components/NeonButton';
import { NeonField } from '../src/components/NeonField';
import { apiErrorText } from '../src/i18n/apiError';
import { useT } from '../src/i18n/I18nProvider';
import { usePlayer } from '../src/session/PlayerSession';
import { neon, text } from '../src/theme/colors';

/**
 * Vào phòng bằng mã.
 *
 * Đường vào dành cho người KHÔNG có license: họ nhận mã qua nút INVITE của chủ
 * phòng (mã nằm ngay trong tin nhắn), hoặc nghe đọc qua điện thoại. Bảng chữ
 * của mã đã bỏ 0/O và 1/I/L đúng vì nó được đọc thành tiếng.
 *
 * Nhận sẵn `?code=` để mở thẳng từ deep link `cyclic://join?code=ABC123` -
 * expo-router tự ánh xạ query thành param, không cần đăng ký gì thêm vì scheme
 * `cyclic` đã có trong app.json.
 */
export default function JoinScreen() {
  const router = useRouter();
  const player = usePlayer();
  const t = useT();
  const params = useLocalSearchParams<{ code?: string }>();

  const existingSeat = player.status === 'ready' ? player.seat : null;

  const [code, setCode] = useState(() => normaliseRoomCode(params.code ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (raw: string) => {
      const normalised = normaliseRoomCode(raw);

      if (!isRoomCodeShaped(normalised)) {
        setError(t('join.codeInvalid', { length: ROOM_CODE_LENGTH }));
        return;
      }

      // Chưa đọc xong SecureStore thì chưa có deviceId bền để xin ghế. Xin bằng
      // id tạm sẽ làm người dùng ăn hai ghế khi họ thử lại.
      if (player.status !== 'ready') return;

      setError(null);
      setHint(null);
      setBusy(true);

      const room = await resolveRoom(normalised);
      if (!room.isSuccess) {
        setBusy(false);
        setError(apiErrorText(room, t));
        return;
      }

      if (room.IsGameOver) {
        setBusy(false);
        setError(t('join.gameOver'));
        return;
      }

      // Phòng có thật nhưng chủ phòng chưa chọn thời lượng/số người, nên chưa
      // có ghế nào tồn tại. Nói đúng chuyện đó - báo "sai mã" ở đây sẽ khiến
      // người ta gõ đi gõ lại một mã hoàn toàn đúng.
      if (!room.IsGameCreated) {
        setBusy(false);
        setHint(t('join.notReady'));
        return;
      }

      const seat = await claimSeat(normalised, player.deviceId);
      setBusy(false);

      if (!seat.isSuccess) {
        setError(apiErrorText(seat, t));
        return;
      }

      await player.saveSeat({
        gameId: seat.GameId,
        roomCode: seat.RoomCode,
        playerId: seat.PlayerId,
        token: seat.Token,
        nickname: seat.NickName,
        characterId: seat.CharacterId,
      });

      // Máy này đã nhận ghế xong từ trước (vào lại sau khi rớt mạng) thì đừng
      // bắt đặt lại tên - đi thẳng vào phòng chờ.
      router.replace(seat.IsClaimed ? '/waiting' : '/seat');
    },
    [player, router, t],
  );

  /*
   * Mở từ deep link thì gửi luôn, khỏi bắt bấm thêm một nút nữa.
   * Ref chống chạy hai lần khi component render lại.
   */
  const autoSubmitted = useRef(false);
  useEffect(() => {
    const fromLink = normaliseRoomCode(params.code ?? '');
    if (autoSubmitted.current || !fromLink || player.status !== 'ready') return;
    autoSubmitted.current = true;
    void submit(fromLink);
  }, [params.code, player.status, submit]);

  return (
    <FormScreen title={t('join.title')} subtitle={t('join.subtitle')}>
      <NeonField
        label={t('join.codeLabel')}
        color={neon.blue}
        value={code}
        onChangeText={(value) => {
          // Chuẩn hoá ngay lúc gõ: người ta hay chép cả khoảng trắng hoặc gạch
          // nối từ tin nhắn mời.
          setCode(normaliseRoomCode(value));
          if (error) setError(null);
          if (hint) setHint(null);
        }}
        error={error}
        placeholder={t('join.codePlaceholder')}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        maxLength={ROOM_CODE_LENGTH}
        returnKeyType="go"
        onSubmitEditing={() => submit(code)}
        editable={!busy}
      />

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <NeonButton
        label={t('join.submit')}
        color={neon.blue}
        onPress={() => submit(code)}
        busy={busy}
      />

      {/*
        Đường về ghế cũ. Máy đã nhận ghế rồi mà tắt app đi thì chỉ nhớ mã phòng
        mới quay lại được - trong khi ghế vẫn còn nguyên ở server. KHÔNG tự động
        chuyển hướng: người dùng có thể đang muốn vào một phòng KHÁC, ép họ về
        phòng cũ là cụt đường.
      */}
      {existingSeat?.nickname ? (
        <NeonButton
          label={t('join.backToRoom')}
          color={neon.green}
          onPress={() => router.replace('/waiting')}
        />
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  hint: { color: text.muted, fontSize: 13, lineHeight: 19 },
});
