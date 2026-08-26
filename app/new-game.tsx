import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createGameUseSession,
  getGameConfig,
  hostSeat,
  openRoom,
  playersForDuration,
  stripGamePrefix,
  type GameConfig,
} from '../src/api/game';
import { Halftone } from '../src/components/Halftone';
import { NeonButton } from '../src/components/NeonButton';
import { ArrowLeftIcon, ClockIcon, TrophyIcon } from '../src/components/NeonIcons';
import { SectionHeader } from '../src/components/SectionHeader';
import { StageBackground } from '../src/components/StageBackground';
import { apiErrorText } from '../src/i18n/apiError';
import { useT } from '../src/i18n/I18nProvider';
import { useLicense } from '../src/session/LicenseSession';
import { usePlayer } from '../src/session/PlayerSession';
import { cell, cellGlow, cta, neon, text, type CellVariant } from '../src/theme/colors';

export default function NewGameScreen() {
  const router = useRouter();
  const license = useLicense();
  const player = usePlayer();
  const t = useT();

  const [config, setConfig] = useState<GameConfig | null>(null);
  const [players, setPlayers] = useState<number | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [dice, setDice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const session = license.status === 'active' ? license.session : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await getGameConfig();
    setLoading(false);

    if (!result.isSuccess) {
      setError(apiErrorText(result, t));
      return;
    }

    setConfig(result.data);

    /*
     * Chọn sẵn giá trị đầu tiên cho mỗi mục. Màn hình mở ra là bấm tạo được
     * ngay, không bắt người dùng chạm ba lần chỉ để lấy đúng mặc định.
     *
     * Số người chơi mặc định phải lọc theo thời lượng mặc định, không lấy bừa
     * phần tử đầu của danh sách gốc.
     */
    const firstDuration = result.data.Durations[0]?.Id ?? null;
    setDuration(firstDuration);
    setPlayers(playersForDuration(result.data, firstDuration)[0]?.NumberOfPlayers ?? null);
    setDice(result.data.DiceOptions[0]?.key ?? null);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Đổi thời lượng thì danh sách người chơi hợp lệ đổi theo. Nếu lựa chọn hiện
   * tại rơi ra ngoài danh sách mới (vd đang chọn 6 người rồi chuyển sang
   * Leaderboard Challenge - vốn tối đa 4) thì phải kéo về giá trị hợp lệ.
   *
   * Bỏ bước này thì app vẫn gửi được 6 người cho chế độ chỉ cho 4, server
   * KHÔNG kiểm tra nên ván sẽ được tạo rồi hỏng ở trong game.
   */
  function selectDuration(next: string) {
    setDuration(next);
    if (!config) return;

    const allowed = playersForDuration(config, next);
    if (!allowed.some((p) => p.NumberOfPlayers === players)) {
      setPlayers(allowed[allowed.length - 1]?.NumberOfPlayers ?? null);
    }
  }

  async function submit() {
    if (!session || !players || !duration || !dice) return;

    setError(null);
    setBusy(true);

    /*
     * BA lượt gọi, phải đúng thứ tự - xem khối ghi chú "Tạo ván: chuỗi BA BƯỚC"
     * trong `src/api/game.ts` để biết vì sao không gộp được.
     */

    // 1. Mở phòng trước. `createGameUseSession` tra hostId ra từ
    //    `GameSetup-{sessionId}`, nên không có bước này thì nó trả "Not found".
    const room = await openRoom(session.token);
    if (!room.isSuccess) {
      setBusy(false);
      setError(apiErrorText(room, t));
      return;
    }

    /*
     * 2. Tạo ván.
     *
     * Ngôn ngữ gửi lên là ngôn ngữ ĐẦY ĐỦ của sponsor (vd "en-GB"), không phải
     * mã rút gọn dùng cho giao diện: server lấy nó để chọn bộ câu hỏi, mà bộ
     * câu hỏi gắn với bản ghi trong bảng `Languages`.
     */
    const result = await createGameUseSession(
      room.SessionId,
      players,
      duration,
      session.languageCode ?? '',
      dice,
      session.token,
    );

    if (!result.isSuccess) {
      setBusy(false);
      setError(apiErrorText(result, t));
      return;
    }

    const gameId = stripGamePrefix(result.data);

    /*
     * Nhớ ván này lại để màn hình chính hiện RESUME GAME khi bấm back từ lobby.
     * Ghi TRƯỚC khi điều hướng, vì `replace` gỡ màn này khỏi stack - không còn
     * lượt render nào nữa để ghi.
     */
    license.setCurrentGame(gameId);

    // 3. Lấy token NGƯỜI CHƠI cho ghế 0 (ghế `isHost`).
    const seat = await hostSeat(gameId, session.token);
    setBusy(false);

    if (!seat.isSuccess) {
      setError(apiErrorText(seat, t));
      return;
    }

    await player.saveSeat({
      gameId,
      roomCode: room.RoomCode,
      playerId: seat.PlayerId,
      token: seat.Token,
      nickname: null,
      characterId: null,
    });

    /*
     * Người tạo phòng cũng là MỘT NGƯỜI CHƠI, nên phải nhận ghế như mọi người:
     * đặt tên, chọn nhân vật. Không làm thì ghế 0 trống mãi và `/ready` sẽ từ
     * chối với "Not everyone has taken a seat yet" - nút START GAME không bao
     * giờ bấm được.
     *
     * `next=/lobby` vì họ là chủ phòng: xong ghế thì về lobby để lấy mã phòng,
     * QR, nút mời và nút bắt đầu. Khách thì `seat.tsx` mặc định về `/waiting`.
     *
     * `replace` chứ không `push`: back phải về thẳng màn hình chính, không quay
     * lại màn dựng ván (ván đã tạo rồi, quay lại đó dễ khiến bấm tạo thêm ván).
     */
    router.replace({ pathname: '/seat', params: { next: '/lobby', gameId } });
  }

  return (
    <View style={styles.root}>
      <StageBackground />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backRow}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <View style={styles.backCircle}>
              <ArrowLeftIcon color="#8FD0FF" />
            </View>
            <Text style={styles.backLabel}>{t('common.back').toUpperCase()}</Text>
          </Pressable>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>{t('newGame.title')}</Text>
            <Text style={styles.subtitle}>{t('newGame.subtitle')}</Text>
          </View>

          {!session ? (
            <View style={styles.centerBlock}>
              <Text style={styles.note}>{t('newGame.noLicence')}</Text>
              <NeonButton
                label={t('activate.goToRegister')}
                color={neon.orange}
                onPress={() => router.replace('/register')}
              />
            </View>
          ) : loading ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color={cell.idle.line} size="large" />
              <Text style={styles.note}>{t('newGame.loading')}</Text>
            </View>
          ) : !config ? (
            <View style={styles.centerBlock}>
              <Text style={styles.error}>{error}</Text>
              <NeonButton label={t('newGame.retry')} color={neon.orange} onPress={load} />
            </View>
          ) : (
            <>
              <SectionHeader title={t('newGame.duration')} />

              <View style={styles.grid}>
                {config.Durations.map((item) => {
                  const selected = item.Id === duration;
                  const variant: CellVariant = selected ? cell.purple : cell.idle;
                  // Mốc tính theo phút dùng đồng hồ; thể thức đếm lượt tung
                  // xúc xắc (Leaderboard Challenge) dùng cúp.
                  const Icon = item.isMinute ? ClockIcon : TrophyIcon;

                  return (
                    <Pressable
                      key={item.Id}
                      onPress={() => selectDuration(item.Id)}
                      disabled={busy}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: busy }}
                      style={({ pressed }) => [
                        styles.gridCell,
                        pressed && styles.pressedCard,
                      ]}
                    >
                      <View
                        style={[
                          styles.card,
                          { borderColor: variant.line, boxShadow: cellGlow(variant) },
                        ]}
                      >
                        <LinearGradient colors={[...variant.fill]} style={styles.fill} />
                        <Halftone color={variant.line} style={styles.cardDots} />
                        <Icon color={variant.line} size={24} />
                        <Text
                          style={[styles.cardLabel, { color: variant.label }]}
                          numberOfLines={2}
                        >
                          {/* Nhãn do server cấp ("15 minutes", "Leaderboard
                              Challenge"); chỉ viết hoa, không tự sửa câu chữ. */}
                          {item.Time.toUpperCase()}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <SectionHeader title={t('newGame.players')} />

              <View style={styles.chipRow}>
                {playersForDuration(config, duration).map((p) => {
                  const selected = p.NumberOfPlayers === players;
                  const variant: CellVariant = selected ? cell.orange : cell.idle;

                  return (
                    <Pressable
                      key={p.Id}
                      onPress={() => setPlayers(p.NumberOfPlayers)}
                      disabled={busy}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: busy }}
                      style={({ pressed }) => [styles.chipCell, pressed && styles.pressedChip]}
                    >
                      <View
                        style={[
                          styles.chip,
                          { borderColor: variant.line, boxShadow: cellGlow(variant) },
                        ]}
                      >
                        <LinearGradient colors={[...variant.fill]} style={styles.fill} />
                        <Text
                          style={[
                            styles.chipText,
                            { color: variant.label, textShadowColor: variant.line },
                          ]}
                        >
                          {p.NumberOfPlayers}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                onPress={submit}
                disabled={busy || !players || !duration || !dice}
                accessibilityRole="button"
                accessibilityState={{ busy, disabled: busy }}
                style={({ pressed }) => [
                  styles.ctaWrap,
                  pressed && styles.pressedCta,
                  busy && styles.ctaBusy,
                ]}
              >
                <View style={styles.cta}>
                  <LinearGradient colors={[...cta.fill]} style={styles.fill} />
                  <Halftone color={cta.line} style={styles.ctaDots} />
                  {busy ? (
                    <ActivityIndicator color={cta.line} />
                  ) : (
                    <Text style={styles.ctaLabel}>{t('newGame.create')}</Text>
                  )}
                </View>
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04061A' },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 40 },
  // Không dùng `StyleSheet.absoluteFillObject`: RN 0.86 bỏ khai báo kiểu của nó.
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start' },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#3AA5FF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 10px rgba(58,165,255,0.45)',
  },
  backLabel: { color: text.primary, fontSize: 15, fontWeight: '700', letterSpacing: 2.4 },

  titleBlock: { marginTop: 22 },
  /*
   * `alignSelf: 'stretch'` + `textAlign: 'center'` chứ KHÔNG phải bọc trong
   * View `alignItems: 'center'`.
   *
   * Cách bọc kia làm Text co lại vừa nội dung, mà Android đo hụt bề rộng của
   * chữ NGHIÊNG (phần nhô ra do nét xiên không được tính) rồi cắt cụt phần
   * thừa - triệu chứng là "NEW GAME" hiện thành "NEW". Cho Text chiếm trọn bề
   * ngang thì không còn phép đo nào để sai.
   *
   * Cũng đã bỏ `letterSpacing` âm: nó cộng thêm vào sai số đo trên Android.
   */
  title: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 42,
    lineHeight: 52,
    fontWeight: '800',
    fontStyle: 'italic',
    color: '#F4F9FF',
    textShadowColor: 'rgba(140,200,255,0.65)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: 'rgba(206,222,245,0.85)',
  },

  grid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  gridCell: { width: '48%' },
  card: {
    height: 64,
    borderRadius: 13,
    borderWidth: 2,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
  },
  cardDots: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 96 },
  cardLabel: { flex: 1, fontSize: 12.5, lineHeight: 15, fontWeight: '700', letterSpacing: 0.9 },

  chipRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  chipCell: { flex: 1, aspectRatio: 1 },
  chip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 21,
    fontWeight: '700',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },

  ctaWrap: { marginTop: 52 },
  ctaBusy: { opacity: 0.7 },
  cta: {
    height: 68,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: cta.line,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    boxShadow: `0 0 12px rgba(${cta.rgb},0.45), 0 0 28px rgba(${cta.rgb},0.18)`,
  },
  ctaDots: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 150 },
  ctaLabel: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: cta.label,
    textShadowColor: `rgba(${cta.rgb},0.7)`,
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },

  // Phản hồi khi nhấn. Dùng transform trực tiếp trong style callback của
  // Pressable thay vì Reanimated: đây là các ô tĩnh, không có animation nào
  // khác đang chạy, nên không đáng kéo thêm shared value.
  pressedCard: { transform: [{ scale: 0.98 }] },
  pressedChip: { transform: [{ scale: 0.96 }] },
  pressedCta: { transform: [{ scale: 0.99 }] },

  centerBlock: { marginTop: 40, gap: 18, alignItems: 'stretch' },
  note: { color: text.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  error: { color: '#FF4D6A', fontSize: 13, lineHeight: 19, marginTop: 14 },
});
