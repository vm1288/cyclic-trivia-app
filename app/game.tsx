import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  characterImageUrl,
  getGameState,
  type GameBoard,
  type GamePlayer,
  type GameSnapshot,
} from '../src/api/game';
import { BoardCanvas } from '../src/components/BoardCanvas';
import {
  boardColors,
  CARD_ORDER,
  ChatIcon,
  countCards,
  Dice3D,
  HandTile,
  LockIcon,
  PlayerTile,
  Stars,
  TurnPulse,
} from '../src/components/GameBoardParts';
import { NeonButton } from '../src/components/NeonButton';
import { SectionHeader } from '../src/components/SectionHeader';
import { StageBackground } from '../src/components/StageBackground';
import { useT } from '../src/i18n/I18nProvider';
import { usePlayer } from '../src/session/PlayerSession';
import { neon, text } from '../src/theme/colors';

/**
 * Màn trong ván - dựng theo `designs/GameBoardScreen.tsx`.
 *
 * MÁY NÀY LÀ MỘT NGƯỜI CHƠI. Khác với lúc mới có mỗi lobby: giờ mọi thiết bị
 * đều giữ một ghế (`usePlayer().seat`), kể cả máy của người tạo phòng. Nhờ vậy
 * khối "You" và bộ bài trong thiết kế ánh xạ thẳng được, không phải bịa.
 *
 * ⚠️ CHƯA có tương tác. Tung xúc xắc, dùng bài, chat, tạm dừng - tất cả đều
 * cần SignalR (chúng là packet `Pub`, không phải REST). Màn này hiện đúng
 * trạng thái ván theo thời gian thực và **khoá** các nút đó lại, thay vì vẽ nút
 * bấm được rồi không có gì xảy ra.
 *
 * Ba thứ trong thiết kế chưa có gì chống lưng ở server, nên KHÔNG vẽ:
 * video/mic từng người, chat, và số tin chưa đọc.
 */

/** Cùng nhịp với lobby/waiting. Bỏ khi chuyển sang SignalR. */
const POLL_MS = 3000;

/** Chữ ký của đúng những gì màn này vẽ - xem chỗ dùng trong vòng poll. */
function signature(snapshot: GameSnapshot | null): string {
  if (!snapshot) return '';
  const g = snapshot.Game;
  const players = snapshot.Players.map(
    (p) => `${p.Id}:${p.NickName}:${p.CurrentStepIndex}:${p.Point}:${p.Stars}:${p.PlayerColor}:${p.Cards.length}`,
  ).join('|');
  return `${g.CurrentTurnPlayerId}:${g.GameSetup}:${g.CurrentAction}:${g.IsGameOver}:${g.IsGamePause}|${players}`;
}

export default function GameScreen() {
  const router = useRouter();
  const player = usePlayer();
  const t = useT();

  const seat = player.status === 'ready' ? player.seat : null;

  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [board, setBoard] = useState<GameBoard | null>(null);

  /*
   * Hình bàn cờ tải MỘT LẦN, trạng thái ván thì poll.
   *
   * `Board` là 40 polygon + 21 ô kèm URL icon - vài chục KB không bao giờ đổi
   * giữa chừng. Kéo nó về mỗi 3 giây là phí băng thông và làm `<Svg>` dựng lại
   * toàn bộ, gây nháy hình.
   */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout>;
    let hasBoard = false;

    async function tick() {
      if (!seat || !alive.current) return;

      const result = await getGameState(seat.gameId, !hasBoard);
      if (!alive.current) return;

      if (result.isSuccess) {
        /*
         * Chỉ cập nhật khi có gì đó THẬT SỰ đổi.
         *
         * Mỗi lượt poll trả về object mới, nên `setSnapshot` vô điều kiện sẽ
         * render lại cả màn 3 giây một lần dù ván đứng yên - vừa phí, vừa là
         * một nửa nguyên nhân làm bàn cờ chớp (nửa kia đã xử ở `BoardCanvas`).
         *
         * So bằng chữ ký gọn thay vì deep-compare: chỉ lấy đúng những trường
         * màn này vẽ ra. Thêm trường mới vào giao diện thì nhớ thêm vào đây,
         * không thì màn hình sẽ không cập nhật theo trường đó.
         */
        const next = { Game: result.Game, Players: result.Players };
        setSnapshot((prev) => (signature(prev) === signature(next) ? prev : next));

        if (!hasBoard && result.Board) {
          setBoard(result.Board);
          hasBoard = true;
        }
      }

      timer = setTimeout(tick, POLL_MS);
    }

    void tick();
    return () => {
      alive.current = false;
      clearTimeout(timer);
    };
  }, [seat]);

  const players = snapshot?.Players ?? [];
  const me: GamePlayer | null = players.find((p) => p.Id === seat?.playerId) ?? null;
  const others = players.filter((p) => p.Id !== seat?.playerId);

  const currentTurnPlayerId = snapshot?.Game.CurrentTurnPlayerId ?? '';
  const isMyTurn = !!me && currentTurnPlayerId === me.Id;

  const cards = countCards(me?.Cards ?? []);

  if (!seat) {
    return (
      <View style={styles.root}>
        <StageBackground variant="alt" />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.centerBlock}>
            <Text style={styles.note}>{t('game.noSeat')}</Text>
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
      <StageBackground variant="alt" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── header ─────────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.roomText} numberOfLines={1}>
                {seat.roomCode ? t('waiting.room', { code: seat.roomCode }) : t('game.title')}
              </Text>
            </View>

            {/*
              Tạm dừng: server CÓ đường (`IsGamePause`, `HostResumeHandler`)
              nhưng gửi được thì cần SignalR. Khoá lại kèm ổ khoá, đúng như
              thiết kế - vẽ nút bấm được rồi không có gì xảy ra thì tệ hơn.
            */}
            <View style={styles.pauseBtn}>
              <View style={styles.pauseBars}>
                <View style={styles.pauseBar} />
                <View style={styles.pauseBar} />
              </View>
              <Text style={styles.pauseText}>{t('game.pause')}</Text>
              <LockIcon />
            </View>
          </View>

          {/* ── dải người chơi khác ────────────────────────────────── */}
          <View style={styles.playerStrip}>
            {others.map((p) => (
              <View key={p.Id} style={styles.playerSlot}>
                <PlayerTile
                  player={p}
                  isTurn={p.Id === currentTurnPlayerId}
                  emptyLabel={t('lobby.seatEmpty')}
                />
              </View>
            ))}
          </View>

          {/* ── bàn cờ ─────────────────────────────────────────────── */}
          {/*
            Tràn sát hai mép: lề ngang âm đúng bằng `paddingHorizontal` của
            ScrollView. Bàn cờ là thứ đáng chiếm chỗ nhất trên màn này.
          */}
          {board ? (
            <View style={styles.boardBleed}>
            <BoardCanvas
              board={board}
              players={players}
              currentTurnPlayerId={currentTurnPlayerId}
            />
            </View>
          ) : (
            <View style={styles.boardLoading}>
              <ActivityIndicator color={boardColors.blue} size="large" />
            </View>
          )}

          {/* ── bạn ────────────────────────────────────────────────── */}
          {/*
            Tới lượt ai thì KHUNG TÊN người đó phát sáng - không còn hàng "Your
            turn" riêng nữa. Ô người khác ở dải trên cũng sáng theo cùng cách
            (`PlayerTile isTurn`), nên cả hai trường hợp đều thấy rõ mà không
            tốn thêm một hàng chiếm chỗ.
          */}
          {me ? (
            <View style={styles.youBlock}>
            <View style={[styles.youRow, isMyTurn && styles.youRowTurn]}>
              {isMyTurn ? <TurnPulse radius={12} /> : null}

              {/*
                Ảnh nhân vật để TRẦN, không viền tròn: bản thân nhân vật đã đủ
                nhận diện, thêm vòng tròn chỉ làm rối và cắt mất chân hình.
              */}
              <Image
                source={{ uri: characterImageUrl(me.CharacterId) }}
                style={styles.avatarImage}
                resizeMode="contain"
              />
              <View style={styles.youInfo}>
                <Text style={styles.youText} numberOfLines={1}>
                  {me.NickName}
                  {me.IsHost ? <Text style={styles.youMeta}> ({t('lobby.host')})</Text> : null}
                </Text>
                <View style={styles.youStars}>
                  <Stars filled={me.Stars} size={20} />
                  <Text style={styles.youScore}>{me.Point}</Text>
                </View>
              </View>
            </View>

            {/*
              Nút chat, màu theo `designs/GameBoardScreen.tsx`.

              KHÔNG hiện số tin chưa đọc: server chưa có bảng tin nhắn nào, nên
              một con số ở đây là bịa ra dữ liệu không tồn tại.
            */}
            <View style={styles.chatBtn}>
              <ChatIcon size={27} />
            </View>
            </View>
          ) : null}

          {/* ── bài của bạn ────────────────────────────────────────── */}
          {/* Bù `marginTop: 22` của SectionHeader - nó dùng chung cho nhiều
              màn nên không sửa ở đó, kéo lại tại chỗ. */}
          <View style={styles.cardsHeader}>
            <SectionHeader title={t('game.yourCards')} />
          </View>
          <View style={styles.hand}>
            {CARD_ORDER.map((key) => (
              <HandTile
                key={key}
                cardKey={key}
                label={t(`game.card.${key}` as 'game.card.Joker')}
                count={cards[key]}
                // Mờ hết: dùng bài là packet `Pub`, chưa gửi được.
                dimmed
              />
            ))}
          </View>

          {/* ── xúc xắc ────────────────────────────────────────────── */}
          <View style={styles.diceBlock}>
            <View style={[styles.diceBtn, isMyTurn && styles.diceBtnLive]}>
              <Dice3D />
            </View>
            <Text style={[styles.diceLabel, isMyTurn && styles.diceLabelLive]}>
              {t('game.rollDice')}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04040E' },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 28, gap: 9 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { flex: 1 },
  roomText: { fontSize: 15, fontWeight: '700', color: text.primary, letterSpacing: 1 },
  metaDim: { fontSize: 11.5, color: boardColors.dim, marginTop: 2 },

  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,59,78,0.45)',
    backgroundColor: 'rgba(48,6,14,0.6)',
    opacity: 0.65,
  },
  pauseBars: { flexDirection: 'row', gap: 2 },
  pauseBar: { width: 2.5, height: 10, borderRadius: 1.5, backgroundColor: boardColors.red },
  pauseText: { fontSize: 10.5, fontWeight: '600', color: '#FF6B78' },

  /*
   * Mỗi ô người chơi chiếm ĐÚNG 20% bề ngang, dù bàn có mấy người - thiếu
   * người thì cả dải dồn vào giữa.
   *
   * Cho ô co giãn theo số người (`flex: 1`) thì bàn 2 người sẽ có hai ô to gấp
   * đôi bàn 5 người, ảnh nhân vật phình ra và dải trên nuốt mất chỗ của bàn cờ.
   * Cố định 20% giữ bố cục ổn định ở mọi số người.
   */
  playerStrip: { flexDirection: 'row', justifyContent: 'center' },
  playerSlot: { width: '20%', paddingHorizontal: 2.5 },

  boardLoading: {
    width: '100%',
    aspectRatio: 1536 / 1024,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(110,140,210,0.26)',
    backgroundColor: '#07160D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  boardBleed: { marginHorizontal: -14 },

  avatarImage: { width: 52, height: 52 },

  youRow: {
    // `flex: 1` để nút chat bên phải chiếm phần còn lại của hàng.
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 64,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: boardColors.hair,
    backgroundColor: boardColors.panel,
  },
  // KHÔNG đổi màu viền ở đây - xem cảnh báo trong `TurnPulse`. Viền giữ trung
  // tính để nhịp sáng xanh nổi hẳn lên.
  youRowTurn: {},
  youInfo: { flex: 1, gap: 0 },
  youText: { fontSize: 15, lineHeight: 19, fontWeight: '700', color: text.primary },
  youMeta: { fontWeight: '400', color: boardColors.dim },
  // Kéo hàng sao sát vào tên: lineHeight 1.45 của ★ vốn đã chừa sẵn khoảng
  // trống phía trên, cộng thêm `gap` nữa là hở ra một khoảng thừa.
  youStars: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -3 },
  youScore: { fontSize: 20, fontWeight: '800', color: boardColors.amber },

  youBlock: { flexDirection: 'row', alignItems: 'stretch', gap: 7 },
  // Màu lấy đúng theo thiết kế; nền ĐẶC để nền chấm phía sau không xuyên qua.
  chatBtn: {
    width: 64,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(47,143,255,0.6)',
    backgroundColor: '#081A40',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 14px rgba(47,143,255,0.35)',
  },

  cardsHeader: { marginTop: -14 },
  hand: { flexDirection: 'row', gap: 7 },

  diceBlock: { alignItems: 'center', gap: 7, marginTop: 4 },
  diceBtn: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: 'rgba(140,160,210,0.3)',
    backgroundColor: 'rgba(12,16,42,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.55,
  },
  // Tới lượt mình thì sáng lên - vẫn chưa bấm được, nhưng phải thấy được là
  // "đang chờ mình" chứ không phải "đang chờ người khác".
  diceBtnLive: {
    opacity: 1,
    borderColor: neon.purple.stroke,
    boxShadow: `0 0 18px rgba(${neon.purple.rgb},0.55)`,
  },
  diceLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(198,212,240,0.5)',
  },
  diceLabelLive: { color: text.primary },

  centerBlock: { marginTop: 60, gap: 18, paddingHorizontal: 24 },
  note: {
    marginTop: 6,
    color: boardColors.amber,
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: 'center',
  },
});
