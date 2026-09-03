import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { assetUrl, getGameState, type GameCharacter } from '../src/api/game';
import { submitNickname } from '../src/api/room';
import { FormScreen } from '../src/components/FormScreen';
import { NeonButton } from '../src/components/NeonButton';
import { NeonField } from '../src/components/NeonField';
import { SectionHeader } from '../src/components/SectionHeader';
import { apiErrorText } from '../src/i18n/apiError';
import { useT } from '../src/i18n/I18nProvider';
import { usePlayer } from '../src/session/PlayerSession';
import { neon, text } from '../src/theme/colors';

/**
 * Nhận ghế: đặt tên + chọn nhân vật.
 *
 * Dùng chung cho CẢ HAI đường vào - người gõ mã phòng, và người tạo phòng nhận
 * ghế của mình. Khác nhau chỉ ở chỗ lấy token ở đâu, mà lúc tới màn này thì
 * token đã nằm trong `usePlayer().seat` rồi.
 *
 * Luật chép theo bản web (`player-views/SetNicknameView.js`), đừng nới ra:
 * tên bắt buộc, **tối đa 10 ký tự**, giới tính mặc định "male".
 */

const NICKNAME_MAX = 10;

export default function SeatScreen() {
  const router = useRouter();
  const player = usePlayer();
  const t = useT();
  const params = useLocalSearchParams<{ next?: string }>();

  const seat = player.status === 'ready' ? player.seat : null;

  /*
   * Xong ghế thì đi đâu - phụ thuộc VAI, không phụ thuộc màn hình này.
   *
   *   chủ phòng -> `/lobby`   (mã phòng, QR, nút mời, nút bắt đầu)
   *   khách     -> `/waiting` (chỉ chờ)
   *
   * Truyền qua param chứ không tự đoán bằng "có license hay không": chủ phòng
   * có thể mở lại màn này từ nơi khác, và suy từ license sẽ ra sai vai.
   */
  const next = params.next === '/lobby' ? '/lobby' : '/waiting';

  const [nickname, setNickname] = useState('');
  /*
   * Danh sách nhân vật LẤY TỪ SERVER, không hardcode.
   *
   * ⚠️ Bộ nhân vật phụ thuộc BOARD: CricTriv dùng 12 con thú, Cyclic Trivia và
   * FootieTriv giữ 6 con cũ. Bản trước hardcode `one`..`six` kèm mã màu chép
   * tay từ `Constants.animalMapColors` - vừa sai với CricTriv, vừa là chỗ dễ
   * lệch màu giữa ô người chơi và quân cờ. Giờ cả id lẫn màu đều do server cấp
   * trong `Board.Characters`.
   */
  const [characters, setCharacters] = useState<GameCharacter[]>([]);
  const [characterId, setCharacterId] = useState<string>('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [taken, setTaken] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*
   * Nhân vật người khác đã lấy, suy ra từ snapshot ván - không cần endpoint
   * riêng.
   *
   * ⚠️ Đây chỉ là ẢNH CHỤP lúc mở màn. Hai người mở cùng lúc vẫn thấy chung một
   * nhân vật còn trống và cùng gửi lên được; server mới là chỗ chốt, nó trả
   * `character_taken`. Lọc ở đây chỉ để đỡ phải thử - đừng coi là đủ.
   */
  const loadTaken = useCallback(async () => {
    if (!seat) return;

    // `includeBoard` để lấy `Board.Characters` - danh sách nhân vật của board này.
    const state = await getGameState(seat.gameId, true);
    if (!state.isSuccess) return;

    const list = state.Board?.Characters ?? [];
    if (list.length > 0) {
      setCharacters(list);
      // Chưa chọn gì thì lấy con đầu tiên của bộ, không đoán `one`.
      setCharacterId((current) => (current ? current : list[0].Id));
    }

    setTaken(
      state.Players.filter((p) => p.IsSetupNickName && p.Id !== seat.playerId).map(
        (p) => p.CharacterId,
      ),
    );
  }, [seat]);

  useEffect(() => {
    void loadTaken();
  }, [loadTaken]);

  // Nhân vật mặc định đang bị lấy mất thì nhảy sang cái còn trống đầu tiên,
  // để nút gửi không bao giờ ở trạng thái chắc chắn trượt.
  useEffect(() => {
    if (!taken.includes(characterId)) return;
    const free = characters.find((c) => !taken.includes(c.Id));
    if (free) setCharacterId(free.Id);
  }, [taken, characterId, characters]);

  async function submit() {
    const trimmed = nickname.trim();

    if (!trimmed) {
      setError(t('seat.nameRequired'));
      return;
    }
    if (trimmed.length > NICKNAME_MAX) {
      setError(t('seat.nameTooLong', { max: NICKNAME_MAX }));
      return;
    }
    if (!seat || player.status !== 'ready') return;

    setError(null);
    setBusy(true);

    const result = await submitNickname(
      { nickname: trimmed, gender, characterId, deviceId: player.deviceId },
      seat.token,
    );

    setBusy(false);

    if (!result.isSuccess) {
      setError(apiErrorText(result, t));
      // Có người vừa lấy mất nhân vật -> làm mới danh sách để người dùng thấy
      // ngay cái nào còn, thay vì bấm lại rồi trượt tiếp.
      if (result.errorCode === 'character_taken') void loadTaken();
      return;
    }

    await player.saveSeat({ ...seat, nickname: trimmed, characterId });
    router.replace(next);
  }

  if (!seat) {
    return (
      <FormScreen title={t('seat.title')}>
        <Text style={styles.hint}>{t('seat.noSeat')}</Text>
        <NeonButton
          label={t('seat.backToJoin')}
          color={neon.blue}
          onPress={() => router.replace('/join')}
        />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title={t('seat.title')}
      subtitle={t('seat.subtitle')}
      /*
       * Tên + giới tính xuống CỘT TRÁI, chừa cả cột phải cho lưới nhân vật.
       *
       * Bốn khối chồng trong một cột thì ở chiều ngang (cột phải cao ~340dp)
       * nút TAKE MY SEAT rơi xuống dưới đáy và phải cuộn mới thấy - đã dính.
       */
      aside={
        <>
          <NeonField
            label={t('seat.nameLabel')}
            color={neon.blue}
            value={nickname}
            onChangeText={(value) => {
              setNickname(value);
              if (error) setError(null);
            }}
            error={error}
            placeholder={t('seat.namePlaceholder')}
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            maxLength={NICKNAME_MAX}
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!busy}
          />

          <View style={styles.genderRow}>
            {(['male', 'female'] as const).map((option) => {
              const active = gender === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setGender(option)}
                  disabled={busy}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.genderCell, active && styles.genderCellOn]}
                >
                  <Text style={[styles.genderText, active && styles.genderTextOn]}>
                    {t(option === 'male' ? 'seat.male' : 'seat.female')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      }
    >
      <SectionHeader title={t('seat.pickCharacter')} />

      <View style={styles.grid}>
        {characters.map((character) => {
          const isTaken = taken.includes(character.Id);
          const active = characterId === character.Id;

          return (
            <Pressable
              key={character.Id}
              onPress={() => setCharacterId(character.Id)}
              disabled={isTaken || busy}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: isTaken }}
              style={[
                styles.character,
                { borderColor: character.Color },
                /*
                 * Ô đang chọn phải khác hẳn, không chỉ sáng hơn.
                 *
                 * Bản đầu chỉ thêm `boxShadow` CÙNG MÀU với viền - nhìn trên máy
                 * thật thì không tài nào biết ô nào đang chọn, vì mỗi ô vốn đã
                 * có viền màu riêng rồi. Phải tra DB mới biết nó chọn con nào.
                 * Nên dùng viền TRẮNG + dấu tích: trắng không trùng với bất kỳ
                 * màu nhân vật nào.
                 */
                active && styles.characterOn,
                isTaken && styles.characterTaken,
              ]}
            >
              <Image
                source={{ uri: assetUrl(character.Image) }}
                style={styles.characterImage}
                resizeMode="contain"
              />
              {active && !isTaken ? (
                <View style={[styles.tick, { backgroundColor: character.Color }]}>
                  <Text style={styles.tickMark}>✓</Text>
                </View>
              ) : null}
              {isTaken ? <Text style={styles.takenLabel}>{t('seat.taken')}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <NeonButton label={t('seat.submit')} color={neon.green} onPress={submit} busy={busy} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  hint: { color: text.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },

  genderRow: { flexDirection: 'row', gap: 10 },
  genderCell: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(140,160,210,0.35)',
    backgroundColor: 'rgba(10,13,34,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderCellOn: {
    borderColor: neon.blue.stroke,
    boxShadow: `0 0 12px rgba(${neon.blue.rgb},0.45)`,
  },
  genderText: { fontSize: 14, fontWeight: '700', color: 'rgba(198,212,240,0.72)' },
  genderTextOn: { color: text.primary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  /*
   * 64 thay vì 88 khi chuyển sang bố cục ngang.
   *
   * Cột phải cao ~340dp. Ở cỡ 88 thì bộ 12 nhân vật xếp 4 ô một hàng = 3 hàng,
   * đẩy nút I'M READY xuống dưới đáy. Ở cỡ 56 thì 6 ô một hàng = 2 hàng, vừa
   * đủ cả nút.
   *
   * ⚠️ Đo lại nếu đổi số nhân vật hoặc tỉ lệ hai cột: mốc quyết định là
   * `6*width + 5*gap` phải ≤ bề ngang cột phải, nếu không nó rớt xuống 5 ô một
   * hàng và thành 3 hàng như cũ.
   */
  character: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'rgba(10,13,34,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  characterOn: {
    borderColor: '#FFFFFF',
    boxShadow: '0 0 16px rgba(255,255,255,0.75)',
  },
  // Mờ hẳn chứ không ẩn đi: giữ nguyên vị trí lưới để danh sách không nhảy
  // chỗ mỗi khi có người nhận nhân vật.
  characterTaken: { opacity: 0.28 },
  characterImage: { width: '100%', height: '100%' },
  tick: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  tickMark: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  takenLabel: {
    position: 'absolute',
    bottom: 6,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: text.primary,
  },
});
