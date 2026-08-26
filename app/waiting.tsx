import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CASE_ACTION, GAME_SETUP, getGameState, type GameSnapshot } from '../src/api/game';
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
 *
 * Nhịp poll giống lobby - xem ghi chú `POLL_MS` ở đó. Bỏ khi chuyển sang SignalR.
 */
const POLL_MS = 3000;

export default function WaitingScreen() {
  const router = useRouter();
  const player = usePlayer();
  const t = useT();

  const seat = player.status === 'ready' ? player.seat : null;

  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      if (!seat || !alive.current) return;

      const result = await getGameState(seat.gameId);
      if (!alive.current) return;

      // Lỗi mạng thì giữ danh sách cũ và thử lại nhịp sau, đừng nhấp nháy.
      if (result.isSuccess) setSnapshot({ Game: result.Game, Players: result.Players });

      timer = setTimeout(tick, POLL_MS);
    }

    void tick();
    return () => {
      alive.current = false;
      clearTimeout(timer);
    };
  }, [seat]);

  const seats = snapshot?.Players ?? [];
  const joined = seats.filter((p) => p.IsSetupNickName).length;
  const total = snapshot?.Game.NumberOfPlayers ?? seats.length;

  /*
   * Ván đã bắt đầu chưa.
   *
   * Hai tín hiệu khác nhau, cần cả hai:
   *   - CurrentAction = QuestionForTurn -> vòng đua "ai đi trước" ĐANG chạy
   *   - GameSetup = Started             -> vòng đua đã có người thắng, vào lượt
   *
   * Chỉ nhìn `GameSetup` thì suốt vòng đua màn hình vẫn nói "đang chờ", trong
   * khi điện thoại người chơi lẽ ra đang phải hiện câu hỏi.
   */
  const racing = snapshot?.Game.CurrentAction === CASE_ACTION.QuestionForTurn;
  const started = snapshot?.Game.GameSetup === GAME_SETUP.Started;
  const live = racing || started;

  if (!seat) {
    return (
      <View style={styles.root}>
        <StageBackground />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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

          {/*
            Ván đã chạy nhưng app CHƯA có màn bàn cờ - nói thẳng ra chỗ này thay
            vì để người dùng nhìn một danh sách ghế đứng im và tưởng app treo.
            Khi có `app/game.tsx` thì đổi khối này thành router.replace('/game').
          */}
          {live ? <Text style={styles.liveNote}>{t('waiting.noBoardYet')}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04061A' },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 30 },
  spacer: { flex: 1 },

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
