import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ackFlow, assetUrl, getGameConfig, shouldBeOnBoard, type GameConfig } from '../src/api/game';
import { ArrowLeftIcon } from '../src/components/NeonIcons';
import { TYPE_ID } from '../src/net/gameConnection';
import { useGameState } from '../src/net/useGameState';
import { lobbyColors, PlayerRow } from '../src/components/LobbyParts';
import { NeonButton } from '../src/components/NeonButton';
import { SectionHeader } from '../src/components/SectionHeader';
import { StageBackground } from '../src/components/StageBackground';
import { useT } from '../src/i18n/I18nProvider';
import { usePlayer } from '../src/session/PlayerSession';
import { neon, text } from '../src/theme/colors';

/**
 * Phòng chờ của NGƯỜI CHƠI - khác `lobby.tsx`, vốn là phòng chờ của người tổ chức.
 *
 * Hai màn cố tình tách nhau: `lobby.tsx` cần token license để cấp mã phòng và
 * bấm START GAME, mà người vào bằng mã thì không có license nào. Nhồi cả hai vai
 * vào một màn sẽ thành một mớ `if (isHost)` xuyên suốt.
 */

export default function WaitingScreen() {
  /* K121 (Tony 21/9): màn không tự tắt khi đang chơi / chờ ván - `expo-keep-awake` (chỉ giữ khi màn này còn mount). */
  useKeepAwake();
  const router = useRouter();
  const player = usePlayer();
  const t = useT();

  const seat = player.status === 'ready' ? player.seat : null;
  const clientId = player.status === 'ready' ? player.deviceId : undefined;

  /*
   * Trạng thái ván do SignalR đẩy nhịp thay cho poll 3 giây - xem `useGameState`.
   *
   * Màn này chờ hai thứ: người khác nhận ghế (`PlayerCheckedIn`) và ván bắt đầu
   * (`GameStart` / `QuestionForTurn`). Cả hai đều nằm trong danh sách gói tin
   * làm nạp lại state.
   *
   * `asBoard` KHÔNG bật ở đây - đây là phòng chờ, chưa phải bàn cờ.
   */
  /*
   * ⚠️ MẮT XÍCH BẮT BUỘC, ĐỪNG GỠ: gói `PlayerStart` (50) tới thì phải BÁO LẠI
   * server, nếu không câu hỏi vòng đua sẽ không bao giờ tới bất cứ ai.
   *
   * `QuestionForTurnHandler` chỉ ghi câu hỏi vào flow người chơi khi
   * `CurrentFlow == PlayerStart && IsClientReceivedFlow`. Bản web đặt cờ đó bằng
   * cách điều hướng trang tới `/player/start/{playerId}`; app gọi
   * `/public/game/flow-received` thay cho việc đó - xem `ackFlow`.
   *
   * PHẢI ack Ở ĐÂY chứ không phải ở màn bàn cờ: lúc gói 50 tới, cả phòng vẫn
   * đang đứng ở màn này. Màn bàn cờ chỉ mở ra SAU khi vòng đua đã nổ.
   *
   * ⚠️ `useRef` chỉ chặn hai lời gọi ĐANG BAY chồng nhau, KHÔNG phải chặn vĩnh
   * viễn "đã ack một lần rồi thôi". Chủ phòng bấm START GAME lần nữa thì
   * `GameStateHandler` chạy lại, đặt `IsClientReceivedFlow = false` và bắn lại
   * gói 50 - chặn vĩnh viễn là lần đó không ai ack và ván kẹt y như cũ.
   */
  const acking = useRef(false);

  const { snapshot, connState, connection } = useGameState({
    gameId: seat?.gameId ?? null,
    token: seat?.token ?? null,
    clientId,
    onPacket: (packet) => {
      if (packet.typeID !== TYPE_ID.PlayerStart) return;
      if (acking.current || !seat) return;
      acking.current = true;
      void ackFlow('PlayerStart', seat.token).finally(() => {
        acking.current = false;
      });
    },
  });

  /*
   * Nối xong thì hỏi server "còn flow nào đang treo không" - chép đúng nhịp của
   * `playerConnection.js` bản web (gửi ở lần nối đầu và mỗi lần nối lại).
   *
   * Cần thật, không phải cho đủ bộ: nếu gói `PlayerStart` bay qua đúng lúc máy
   * này chưa nối (mở app muộn, khoá màn hình, rớt sóng) thì không còn đường nào
   * khác để biết. Server tra `player.CurrentFlow` rồi phát lại - và vì chưa ack
   * nên nó phát lại thật.
   */
  useEffect(() => {
    if (connState !== 'connected') return;
    void connection.current?.send(TYPE_ID.HostResume);
  }, [connState, connection]);

  // K107: chỉ hiện ghế đã có người - ghế trống sẽ bị xoá lúc chủ phòng bấm START MATCH.
  const seats = (snapshot?.Players ?? []).filter((p) => p.IsSetupNickName);
  const joined = seats.length;
  const total = snapshot?.Game.NumberOfPlayers ?? seats.length;

  /*
   * Phép thử "phải ở bàn cờ chưa" nằm ở `shouldBeOnBoard` - màn Home dùng chung.
   *
   * K93: KHÔNG đợi vòng đua nổ mới đi. Chủ phòng bấm START là state có
   * `Timer.RaceCountdownEndsAt` (gói 50 làm nạp lại state) -> sang bàn cờ NGAY,
   * ở đó tấm "WHO GOES FIRST?" đếm tới mốc server. Nhờ vậy lúc câu 67 phát, mọi
   * máy đã đứng sẵn với kết nối sống và nhận cùng một lượt; trước đây mỗi máy
   * đổi màn + nối lại + HostResume lúc khác nhau nên câu hiện lệch vài giây.
   */
  const live = snapshot ? shouldBeOnBoard(snapshot.Game) : false;

  /*
   * K111 (Tony 18/9, ảnh mẫu 2): phòng chờ KHÁCH cùng khuôn với lobby chủ phòng - ROOM CODE + tấm
   * (logo game, "Game duration: …") thay cho QR/nút mời, KHÔNG có START MATCH; bên phải danh sách
   * ghế có tên. Nhãn thời lượng lấy từ cấu hình ("15 minutes" / "Leaderboard Challenge"…).
   */
  const [config, setConfig] = useState<GameConfig | null>(null);
  useEffect(() => {
    let alive = true;
    void getGameConfig().then((r) => {
      if (alive && r.isSuccess) setConfig(r.data);
    });
    return () => {
      alive = false;
    };
  }, []);
  const durationLabel = (() => {
    const m = snapshot?.Game.DurationMinutes;
    if (m == null) return '';
    const found = config?.Durations.find((d) => d.Duration === m);
    if (found) return found.Time;
    // K117: hàng đếm lượt có Duration = số overs; không tra được cấu hình thì in "{n} overs".
    if (m === 0) return t('waiting.leaderboard');
    return (snapshot?.Game.TotalRollDice ?? 0) > 0 ? t('waiting.overs', { n: m }) : t('waiting.minutes', { minutes: m });
  })();

  /*
   * Ván đã chạy (hoặc đang đếm ngược vòng đua) -> sang màn bàn cờ.
   *
   * `replace` chứ không `push`: back từ bàn cờ phải về màn hình chính, không
   * quay lại phòng chờ của một ván đã bắt đầu.
   *
   * Chuyển hướng nằm trong effect chứ không đặt thẳng trong thân component -
   * điều hướng lúc đang render là một side effect, React sẽ cảnh báo và có thể
   * chạy hai lần.
   */
  useEffect(() => {
    if (live) router.replace('/game-landscape');
  }, [live, router]);

  if (!seat) {
    return (
      <View style={styles.root}>
        <StageBackground />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.centerBlock}>
            <Text style={styles.note}>{t('waiting.noSeat')}</Text>
            <NeonButton
              label={t('waiting.backToJoin')}
              color={neon.blue}
              onPress={() => router.replace('/join')}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StageBackground />

      {/* Ngang thì tai thỏ nằm ở cạnh trái/phải - phải khai báo cả `left`/`right`. */}
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.body}>
          {/* Nút back nổi, cùng khuôn lobby (`lobby.tsx`). */}
          <Pressable
            onPress={() => router.replace('/')}
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

          <View style={styles.stack}>
            <View style={styles.header}>
              <Text style={styles.title}>{live ? t('waiting.liveTitle') : t('waiting.title')}</Text>
            </View>

            <View style={styles.middle}>
              {/* Trái: mã phòng + tấm game (logo, thời lượng). */}
              <View style={styles.col}>
                <SectionHeader title={t('lobby.roomCode')} />
                <View style={styles.codeRim}>
                  <View style={styles.codeInner}>
                    <Text style={styles.codeText} selectable>
                      {(seat.roomCode ?? '').split('').join(' ')}
                    </Text>
                  </View>
                </View>

                <View style={styles.gameCard}>
                  {snapshot?.Sponsor?.LogoUrl ? (
                    <Image source={{ uri: assetUrl(snapshot.Sponsor.LogoUrl) }} style={styles.gameLogo} resizeMode="contain" />
                  ) : (
                    <Text style={styles.gameName}>{snapshot?.Sponsor?.Name ?? ''}</Text>
                  )}
                  {durationLabel ? <Text style={styles.gameDuration}>{t('waiting.gameDuration', { duration: durationLabel })}</Text> : null}
                  {live ? <Text style={styles.liveNote}>{t('waiting.opening')}</Text> : null}
                </View>
              </View>

              {/* Phải: danh sách ghế có tên. */}
              <View style={styles.col}>
                <SectionHeader title={t('lobby.seats')} trailing={t('lobby.joinedCount', { joined, total })} />
                <ScrollView style={styles.rowsScroll} showsVerticalScrollIndicator={false}>
                  {seats.length === 0 ? (
                    <View style={styles.centerBlock}>
                      <ActivityIndicator color={lobbyColors.blue} size="large" />
                    </View>
                  ) : (
                    <View style={styles.rows}>
                      {seats.map((p, i) => (
                        <PlayerRow
                          key={p.Id}
                          height={44}
                          index={i + 1}
                          name={p.NickName}
                          colour={p.PlayerColor || lobbyColors.blue}
                          ready
                          isHost={p.IsHost}
                          hostLabel={t('lobby.host')}
                          statusLabel={t('lobby.statusReady')}
                        />
                      ))}
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04061A' },
  safe: { flex: 1 },
  scroll: { paddingVertical: 8 },
  spacer: { flex: 1 },

  /** Hàng ngoài: phần tĩnh bên trái | danh sách ghế bên phải. */
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 22,
  },
  leftCol: { flex: 1, justifyContent: 'center' },
  rightCol: { flex: 1.1 },

  // Chiếm trọn bề ngang + căn giữa: Android đo hụt bề rộng chữ nghiêng rồi cắt
  // cụt nếu để View bọc ngoài tự co (đã dính ở màn NEW GAME).
  title: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    fontStyle: 'italic',
    color: '#F2F6FF',
    textShadowColor: 'rgba(140,200,255,0.6)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: lobbyColors.dim,
    textAlign: 'center',
  },

  youCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(63,224,255,0.5)',
    backgroundColor: 'rgba(10,12,40,0.78)',
    alignItems: 'center',
    gap: 4,
    boxShadow: '0 0 12px rgba(47,143,255,0.35)',
  },
  youLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.3, color: lobbyColors.cyan },
  youName: { fontSize: 22, fontWeight: '800', color: text.primary },
  roomCode: { fontSize: 13, color: lobbyColors.dim, letterSpacing: 1 },

  progressRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  joinedText: { fontSize: 14, color: lobbyColors.dim },
  countText: { fontSize: 14, fontWeight: '700', color: text.primary },

  rows: { gap: 6, marginTop: 9 },

  /* K111: khuôn lobby. */
  body: { flex: 1 },
  stack: { flex: 1, paddingHorizontal: 20, paddingBottom: 10 },
  header: { height: 44, justifyContent: 'center' },
  middle: { flex: 1, flexDirection: 'row', gap: 22, paddingTop: 4 },
  col: { flex: 1 },
  backRow: { position: 'absolute', top: 4, left: 14, zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: lobbyColors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 10px rgba(47,143,255,0.55)',
  },
  backLabel: { color: text.primary, fontSize: 16, fontWeight: '700', letterSpacing: 2.4 },
  codeRim: { marginTop: 6, padding: 1.5, borderRadius: 13, backgroundColor: lobbyColors.purple, boxShadow: '0 0 18px rgba(200,107,255,0.6)' },
  codeInner: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(48,12,80,0.95)' },
  codeText: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: 4, textShadowColor: 'rgba(226,167,255,0.9)', textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 } },
  gameCard: {
    marginTop: 8,
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(63,224,255,0.55)',
    backgroundColor: 'rgba(10,12,40,0.78)',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 0 12px rgba(47,143,255,0.35)',
  },
  gameLogo: { width: 150, height: 96 },
  gameName: { fontSize: 20, fontWeight: '800', color: text.primary },
  gameDuration: { fontSize: 17, color: text.primary, textAlign: 'center' },
  rowsScroll: { flex: 1, marginTop: 8 },

  centerBlock: { marginTop: 40, gap: 18 },
  note: { color: lobbyColors.dim, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  liveNote: {
    marginTop: 18,
    color: lobbyColors.amber,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});
