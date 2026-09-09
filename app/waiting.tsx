import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ackFlow, isGameLive } from '../src/api/game';
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
  const router = useRouter();
  const player = usePlayer();
  const t = useT();

  const seat = player.status === 'ready' ? player.seat : null;

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

  const seats = snapshot?.Players ?? [];
  const joined = seats.filter((p) => p.IsSetupNickName).length;
  const total = snapshot?.Game.NumberOfPlayers ?? seats.length;

  /* Phép thử "ván đã vào cuộc chưa" nằm ở `isGameLive` - màn Home dùng chung. */
  const live = snapshot ? isGameLive(snapshot.Game) : false;

  /*
   * Ván đã chạy -> sang màn bàn cờ.
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
        {/*
          Cột trái là phần TĨNH (tiêu đề + thẻ "bạn là ai"), cột phải là danh
          sách ghế - thứ duy nhất thay đổi theo thời gian thực và cần cuộn.
        */}
        <View style={styles.row}>
          <View style={styles.leftCol}>
            <Text style={styles.title}>{live ? t('waiting.liveTitle') : t('waiting.title')}</Text>
            <Text style={styles.subtitle}>
              {live ? t('waiting.liveSubtitle') : t('waiting.subtitle')}
            </Text>

            <View style={styles.youCard}>
              <Text style={styles.youLabel}>{t('waiting.you')}</Text>
              <Text style={styles.youName}>{seat.nickname ?? '—'}</Text>
              {seat.roomCode ? (
                <Text style={styles.roomCode}>
                  {t('waiting.room', { code: seat.roomCode })}
                </Text>
              ) : null}
            </View>

            {live ? <Text style={styles.liveNote}>{t('waiting.opening')}</Text> : null}
          </View>

          <ScrollView
            style={styles.rightCol}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
          <SectionHeader title={t('lobby.seats')} />

          <View style={styles.progressRow}>
            <Text style={styles.joinedText}>{t('lobby.joinedCount', { joined, total })}</Text>
            <View style={styles.spacer} />
            <Text style={styles.countText}>
              {joined}/{total}
            </Text>
          </View>

          {seats.length === 0 ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color={lobbyColors.blue} size="large" />
            </View>
          ) : (
            <View style={styles.rows}>
              {seats.map((p, i) => (
                <PlayerRow
                  key={p.Id}
                  index={i + 1}
                  name={p.IsSetupNickName ? p.NickName : t('lobby.seatEmpty')}
                  colour={p.PlayerColor || lobbyColors.blue}
                  ready={p.IsSetupNickName}
                  isHost={p.IsHost}
                  hostLabel={t('lobby.host')}
                  statusLabel={
                    p.IsSetupNickName ? t('lobby.statusReady') : t('lobby.statusWaiting')
                  }
                />
              ))}
            </View>
          )}
          </ScrollView>
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
