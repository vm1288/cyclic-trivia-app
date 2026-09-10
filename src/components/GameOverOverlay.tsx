import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '../i18n/I18nProvider';
import { getLeaderboard, type LeaderboardRow } from '../api/game';
import { LeaderboardStage } from './LeaderboardStage';
import { text } from '../theme/colors';

/**
 * MÀN KẾT THÚC VÁN.
 *
 * ⚠️ Trước bản này app KHÔNG HIỆN GÌ khi ván kết thúc. Server gửi gói `GameOver`
 * (39) cho **mọi** người chơi, `useGameState` nhận và nạp lại trạng thái... rồi
 * thôi: màn hình đứng nguyên ở bàn cờ, người chơi không biết ván đã xong. Đây là
 * chỗ hở duy nhất người chơi thật gặp **mỗi ván** (TEST_CASES ca **UI-7**).
 *
 * ⚠️⚠️ **BẢNG XẾP HẠNG CHỈ THUỘC VỀ THỂ THỨC LEADERBOARD CHALLENGE.** Bản đầu
 * tôi dựng một bảng "điểm ván này" và hiện nó ở MỌI ván - tự nghĩ ra, bản web
 * không có thứ đó ở đâu cả. Đúng luật là:
 *
 * | Ván | Bàn cờ web hiện | Máy người chơi web hiện |
 * |---|---|---|
 * | tính giờ (15/60 phút) | "Game Over" + câu ngẫu nhiên + *"Waiting for host…"* | đúng câu ngẫu nhiên đó, **không bảng** |
 * | Leaderboard Challenge | thêm nút **Leaderboard** mở màn xếp hạng | như trên |
 *
 * Chỗ chốt trong mã:
 *   - `PublicController.Game.cs` — `if (gameData.TotalRollDice > 0)` mới **ghi**
 *     `RecordScores`. Ván tính giờ không ghi gì, nên chẳng có gì để xếp hạng.
 *   - `mainControl.js` — `classGameOver = 'noleaderboard'` trừ khi
 *     `TotalRollDice > 0`, và CSS `.noleaderboard .btnGameOverLeaderboard
 *     { display:none }` giấu nút đi.
 *   - `MainBoard.cshtml` — `<div id="fullscreen-leaderboard" v-if="IsGameOver &&
 *     IsLeaderBoard">`.
 *
 * Màn xếp hạng gồm **HAI phần**, đúng như bản web dựng:
 *   1. **Global leaderboard** — top 6 toàn giải (`global` từ endpoint).
 *   2. **Current match result** — người trong ván này, nhưng mang **thứ hạng và
 *      điểm TOÀN CỤC** (`data`), không phải hạng trong ván.
 *
 * ⚠️ App vẽ hai phần này thành danh sách; bản web vẽ top 6 lên một tấm hình sân
 * vận động (`leaderboard-img-map4.png` + image map). Khác cách vẽ, cùng dữ liệu.
 *
 * ⚠️ Chưa có **End game / Play again** của chủ phòng (bản web hiện hai nút đó
 * cho `data.isHost`) — đó là ca **UI-9**, chưa làm. Nút VỀ MÀN CHÍNH ở đây chỉ
 * là đường ra cho máy này, không thay hai nút kia.
 */
export function GameOverOverlay({
  gameId,
  meId,
  message,
  isLeaderboard,
  onLeave,
}: {
  gameId: string | null;
  meId: string | null;
  /** `GameOverMessage` server bốc ngẫu nhiên. Rỗng thì dùng câu mặc định. */
  message?: string | null;
  /**
   * Ván này có phải **Leaderboard Challenge** không — đọc từ
   * `Game.TotalRollDice > 0`, đúng cờ mà server và bản web dùng.
   *
   * ⚠️ Đừng suy từ `DurationMinutes === 0`: hai trường đi cùng nhau lúc tạo ván
   * (`TotalRollDice = NumberOfPlayers * 15` khi thời lượng là loại đếm lượt
   * tung), nhưng `TotalRollDice` mới là thứ cả server lẫn bàn cờ đọc.
   */
  isLeaderboard: boolean;
  onLeave: () => void;
}) {
  const t = useT();

  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.back(1.4)) });
  }, [enter]);

  const card = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.9 + enter.value * 0.1 }],
  }));

  const [board, setBoard] = useState<{
    global: LeaderboardRow[];
    current: LeaderboardRow[];
  } | null>(null);
  const [failed, setFailed] = useState(false);

  /*
   * Chỉ gọi cho thể thức Leaderboard Challenge. Ván tính giờ mà gọi thì endpoint
   * vẫn trả 200 nhưng toàn số 0 - hiện lên là nói dối người chơi.
   */
  useEffect(() => {
    if (!isLeaderboard || !gameId) return;
    let alive = true;

    (async () => {
      const result = await getLeaderboard(gameId);
      if (!alive) return;
      if (!result.isSuccess) {
        setFailed(true);
        return;
      }
      /* Bản web sắp cả hai danh sách theo điểm giảm dần (`mainControl.js`). */
      const byScore = (rows: LeaderboardRow[]) => [...rows].sort((a, b) => b.Score - a.Score);
      setBoard({ global: byScore(result.global), current: byScore(result.data) });
    })();

    return () => {
      alive = false;
    };
  }, [isLeaderboard, gameId]);

  const hasBoard = useMemo(
    () => !!board && (board.global.length > 0 || board.current.length > 0),
    [board],
  );

  const row = (item: LeaderboardRow, index: number, showRank: boolean) => {
    const isMe = item.PlayerId === meId;
    return (
      <View
        key={item.PlayerId + '-' + index}
        style={[styles.row, isMe && styles.rowMe, item.IsTopGlobal && styles.rowTop]}
      >
        <Text style={[styles.place, item.IsTopGlobal && styles.placeTop]} numberOfLines={1}>
          {showRank ? item.Rank : String(index + 1)}
        </Text>

        <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
          {item.PlayerName}
          {isMe ? t('gameOver.youSuffix') : ''}
        </Text>

        <Text style={styles.point}>{item.Score.toLocaleString()}</Text>
      </View>
    );
  };

  /*
   * Thể thức Leaderboard Challenge có MÀN RIÊNG, dựng trên bộ tranh sân khấu -
   * xem `LeaderboardStage`. Khung chữ dưới đây chỉ còn dành cho ván tính giờ,
   * đúng như bản web: "Game Over" + câu ngẫu nhiên, không bảng nào.
   */
  if (isLeaderboard && board && hasBoard) {
    return (
      <LeaderboardStage
        global={board.global}
        current={board.current}
        meId={meId}
        onLeave={onLeave}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.card, isLeaderboard && styles.cardWide, card]}>
        <LinearGradient
          colors={['rgba(24,20,60,0.98)', 'rgba(8,8,24,0.99)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <Text style={styles.title}>{t('gameOver.title')}</Text>
        <Text style={styles.message}>{message || t('gameOver.defaultMessage')}</Text>

        {/*
          Tới được đây thì hoặc là ván tính giờ (không có bảng nào, đúng bản
          web), hoặc là ván Leaderboard Challenge mà bảng chưa tải xong / tải
          hỏng - lúc đó vẫn phải nói cho người chơi biết VÁN ĐÃ XONG.
        */}
        {isLeaderboard ? (
          failed ? (
            <Text style={styles.note}>{t('gameOver.boardFailed')}</Text>
          ) : (
            <ActivityIndicator color="#C7D2FE" style={styles.spinner} />
          )
        ) : null}

        <Pressable
          onPress={onLeave}
          accessibilityRole="button"
          accessibilityLabel={t('gameOver.leave')}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>{t('gameOver.leave')}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(3,3,12,0.82)',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.4,
    borderColor: 'rgba(148,163,255,0.45)',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 8,
  },
  /* Hai bảng cạnh nhau thì cần rộng; ván tính giờ chỉ có hai dòng chữ. */
  cardWide: { maxWidth: 720, flex: 1 },
  columns: { flex: 1, flexDirection: 'row', gap: 14, minHeight: 0 },
  column: { flex: 1, minHeight: 0 },
  title: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    color: '#FDE68A',
  },
  message: {
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
    color: 'rgba(226,232,255,0.78)',
  },
  note: {
    fontSize: 12,
    textAlign: 'center',
    color: 'rgba(226,232,255,0.5)',
    paddingVertical: 8,
  },
  spinner: { paddingVertical: 14 },
  listInner: { gap: 4, paddingVertical: 2, paddingBottom: 6 },
  section: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: 'rgba(148,163,255,0.9)',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    /* Đủ khít để SÁU dòng top 6 vào trọn một màn ngang, không phải cuộn. */
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowMe: { borderColor: 'rgba(148,163,255,0.55)' },
  /* Bản web tô sáng người nằm trong top 6 toàn cục (`class inGlobalTop`). */
  rowTop: { backgroundColor: 'rgba(253,230,138,0.12)' },
  place: {
    minWidth: 46,
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(226,232,255,0.6)',
  },
  placeTop: { color: '#FDE68A' },
  name: { flex: 1, fontSize: 13.5, fontWeight: '700', color: text.primary },
  nameMe: { color: '#C7D2FE' },
  point: { fontSize: 15, fontWeight: '900', color: text.primary, minWidth: 52, textAlign: 'right' },
  button: {
    marginTop: 2,
    alignSelf: 'center',
    paddingHorizontal: 26,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(99,102,241,0.9)',
  },
  buttonPressed: { opacity: 0.75 },
  buttonText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.6, color: '#fff' },
});
