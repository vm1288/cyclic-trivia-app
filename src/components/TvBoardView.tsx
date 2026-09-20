import { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  characterImageUrl,
  type DirectionPacket,
  type GameBoard,
  type GamePlayer,
  type GameQuestion,
  type GameSnapshot,
} from '../api/game';
import { useT } from '../i18n/I18nProvider';
import { BattleDiceOverlay, type BattleDiceState } from './BattleDiceOverlay';
import { BattleVideoOverlay } from './BattleVideoOverlay';
import { BoardCanvas, type PendingMove } from './BoardCanvas';
import { CurveBallOverlay } from './CurveBallOverlay';
import { DiceRollOverlay } from './DiceRollOverlay';
import {
  DuelCard,
  DuelRewardOverlay,
  DuelSetupOverlay,
  DuelSummaryOverlay,
  type DuelRewardState,
  type DuelSetupState,
  type DuelSummaryData,
} from './DuelOverlays';
import { boardColors, fill, Stars } from './GameBoardParts';
import { GameOverOverlay } from './GameOverOverlay';
import { MoveDirectionOverlay } from './MoveDirectionOverlay';
import { PauseOverlay } from './PauseOverlay';
import { QuestionOverlay } from './QuestionOverlay';
import { RaceCountdownOverlay } from './RaceCountdownOverlay';
import { RaceNobodyOverlay } from './RaceNobodyOverlay';
import { RaceWinnerOverlay } from './RaceWinnerOverlay';
import { StageBackground } from './StageBackground';
import { TenSecondsChallengeOverlay, type ChallengePhase } from './TenSecondsChallengeOverlay';
import { TurnResultOverlay, type TurnResult } from './TurnResultOverlay';

/**
 * BÀN CỜ CHÍNH TRÊN TV (K118, Tony chốt 2026-09-20) - vẽ vào MÀN HÌNH PHỤ của phone chủ phòng
 * (`react-native-external-display`), hệ điều hành mirror lên TV. Không còn bản web.
 *
 * Đây là "ghế khán giả": cùng state với `game-landscape` của chủ phòng, nhưng mọi tấm ở dạng
 * CHỈ XEM (không nút, không gửi gói nào) - câu hỏi của chính chủ phòng cũng hiện như câu của
 * người khác (đáp án không lộ, không chọn được). Chủ phòng vẫn thao tác trên màn phone.
 *
 * ⚠️ Kích thước phải là của MÀN HÌNH PHỤ (`useTvScreen`), không phải `Dimensions` của phone:
 * lib gắn con vào một `ReactRootView` riêng trên Presentation, không có bố cục cha.
 *
 * ⚠️ Không đặt state riêng ở đây (mọi thứ đến từ `scene`) - tấm nào có đồng hồ nội bộ
 * (QuestionOverlay, DuelSetupOverlay…) tự chạy y như trên phone vì nhận cùng props.
 */
export type TvScene = {
  board: GameBoard | null;
  players: GamePlayer[];
  snapshot: GameSnapshot | null;
  pendingMove: PendingMove | null;
  currentTurnPlayerId: string;
  boardGameId: string;
  roomCode: string;
  unit: string;
  oneUnit: string;
  unitFor: (n: number) => string;
  isLeaderboard: boolean;
  /** Đồng hồ ván: "{n} overs left" / mm:ss - chữ đã tính ở game-landscape. */
  clockLabel: string;

  dice: { value: number | null; rolledBy?: string | null } | null;
  question: { question: GameQuestion; categories: string[]; duration: number; banner: string | null } | null;
  direction: { packet: DirectionPacket; ownerName: string } | null;
  raceWinner: { name: string } | null;
  raceNobody: { seconds: number } | null;
  raceCountdown: { endsAt: string; serverNow: string; fetchedAt: number } | null;
  curveBall: { message: string } | null;
  turnResult: { result: TurnResult; name: string } | null;
  challenge: {
    phase: ChallengePhase;
    words: string[];
    readerNumber: number;
    totalReaders: number;
    title: string;
    studyText: string;
    appendixType: string;
    challengedName: string;
    judgeName: string;
    totalPlayers: number;
    countdownSeconds: number;
  } | null;
  battleDice: BattleDiceState | null;
  battleVideo: { seq: number; kind: 'battle' | 'winner'; name: string } | null;
  duelTime: { a: string; b: string } | null;
  duel: DuelSetupState | null;
  duelSummary: DuelSummaryData | null;
  duelReward: DuelRewardState | null;
  turnBanner: string | null;
  notice: string | null;
  paused: boolean;
  gameOver: { message: string | null } | null;
};

const noop = () => {};

export const TvBoardView = memo(function TvBoardView({
  width,
  height,
  scene,
}: {
  width: number;
  height: number;
  scene: TvScene;
}) {
  const t = useT();
  const s = scene;
  /*
   * Vẽ trên KHUNG THIẾT KẾ 1000 dp rộng rồi co theo màn phụ (transform scale) - TV nào cũng cùng
   * bố cục, chữ tỉ lệ đúng. Mirror Android dùng density của phone nên màn 720p chỉ ~455 dp, 1080p
   * ~683 dp: không co thì cột phải chật, tên cắt "T…" (đo A17 14:53 20/9 với màn phụ giả lập).
   */
  const DESIGN_W = 1000;
  const scale = width / DESIGN_W;
  const dw = DESIGN_W;
  const dh = Math.round(height / scale);
  const pad = 24;
  const sideW = 230;
  const boardW = dw - sideW - pad * 3;
  const boardH = dh - pad * 2;

  return (
    <View style={[styles.root, { width, height }]}>
      <View
        style={{
          width: dw,
          height: dh,
          transform: [{ translateX: (width - dw) / 2 }, { translateY: (height - dh) / 2 }, { scale }],
        }}
      >
      <StageBackground />

      <View style={[styles.row, { padding: pad, gap: pad }]}>
        {/* ── Bàn cờ + mọi tấm chỉ-xem đè lên đúng vùng bàn cờ (cùng khuôn cột trái của phone) ── */}
        <View style={[styles.boardCol, { width: boardW, height: boardH }]}>
          {s.board ? (
            <BoardCanvas
              board={s.board}
              players={s.players}
              pendingMove={s.pendingMove}
              currentTurnPlayerId={s.currentTurnPlayerId}
            />
          ) : null}

          {s.direction ? (
            <MoveDirectionOverlay packet={s.direction.packet} onSelect={noop} readOnly ownerName={s.direction.ownerName} />
          ) : null}
          {s.raceWinner ? <RaceWinnerOverlay name={s.raceWinner.name} isMe={false} /> : null}
          {s.raceNobody ? <RaceNobodyOverlay seconds={s.raceNobody.seconds} /> : null}
          {s.raceCountdown && !s.question ? (
            <RaceCountdownOverlay endsAt={s.raceCountdown.endsAt} serverNow={s.raceCountdown.serverNow} fetchedAt={s.raceCountdown.fetchedAt} />
          ) : null}
          {s.curveBall ? <CurveBallOverlay boardGameId={s.boardGameId} message={s.curveBall.message} /> : null}
          {s.turnResult ? (
            <TurnResultOverlay result={s.turnResult.result} name={s.turnResult.name} unit={s.unit} oneUnit={s.oneUnit} compact />
          ) : null}
          {s.challenge ? (
            <TenSecondsChallengeOverlay
              phase={s.challenge.phase}
              words={s.challenge.words}
              isJudge={false}
              isChallenger={false}
              readerNumber={s.challenge.readerNumber}
              totalReaders={s.challenge.totalReaders}
              title={s.challenge.title}
              studyText={s.challenge.studyText}
              appendixType={s.challenge.appendixType}
              challengedName={s.challenge.challengedName}
              judgeName={s.challenge.judgeName}
              totalPlayers={s.challenge.totalPlayers}
              countdownSeconds={s.challenge.countdownSeconds}
              onStart={noop}
              onCountdownDone={noop}
              onVerdict={noop}
            />
          ) : null}
          {s.question ? (
            <QuestionOverlay
              question={s.question.question}
              categories={s.question.categories}
              durationSeconds={s.question.duration}
              banner={s.question.banner}
              onAnswer={noop}
              onTimeout={noop}
              readOnly
            />
          ) : null}

          {s.duelTime && !s.battleVideo ? (
            <DuelCard
              title={t('duel.timeTitle')}
              lines={[
                { text: `${t('duel.bowler')}: ${s.duelTime.a}   ·   ${t('duel.batter')}: ${s.duelTime.b}`, color: '#5FE6FF' },
                t('duel.timeBody', { a: s.duelTime.a, b: s.duelTime.b }),
              ]}
            />
          ) : null}
          {/* meId rỗng = khán giả: thấy trạng thái "[A]: Setting the stake…", không có form. */}
          {s.duel && !s.question && !s.battleVideo && !s.duelTime ? (
            <DuelSetupOverlay state={s.duel} meId="" unit={s.unitFor} onStake={noop} onCategory={noop} />
          ) : null}
          {s.duelSummary && !s.battleVideo ? <DuelSummaryOverlay data={s.duelSummary} onDone={noop} /> : null}
          {s.duelReward && !s.battleVideo ? (
            <DuelRewardOverlay state={s.duelReward} meId="" unit={s.unitFor} onChoose={noop} />
          ) : null}
          {s.battleDice && !s.dice ? <BattleDiceOverlay state={s.battleDice} meId="" /> : null}

          {s.turnBanner && !s.raceWinner && !s.turnResult && !s.dice && !s.gameOver ? (
            <View style={styles.turnBanner} pointerEvents="none">
              <Text style={styles.turnBannerText} numberOfLines={2}>
                {s.turnBanner}
              </Text>
            </View>
          ) : null}
          {s.notice ? (
            <View style={styles.notice} pointerEvents="none">
              <Text style={styles.noticeText} numberOfLines={1}>
                {s.notice}
              </Text>
            </View>
          ) : null}
          {s.paused && !s.gameOver ? <PauseOverlay isHost={false} /> : null}
        </View>

        {/* ── Cột phải: mã phòng, đồng hồ, dải người chơi ── */}
        <View style={[styles.sideCol, { width: sideW }]}>
          <Text style={styles.room} numberOfLines={1}>
            {s.roomCode ? t('waiting.room', { code: s.roomCode }) : t('game.title')}
          </Text>
          {s.clockLabel ? (
            <Text style={styles.clock} numberOfLines={1}>
              {s.clockLabel}
            </Text>
          ) : null}
          <View style={styles.players}>
            {s.players.map((p) => {
              const isTurn = p.Id.toLowerCase() === s.currentTurnPlayerId.toLowerCase();
              const cards = (p.Cards ?? []).reduce((n, c) => n + Math.max(0, c.Quantity), 0);
              const color = p.PlayerColor || boardColors.blue;
              return (
                <View key={p.Id} style={[styles.pill, { borderColor: isTurn ? color : 'rgba(110,140,210,0.35)' }, isTurn && styles.pillTurn]}>
                  <LinearGradient colors={['rgba(10,13,34,0.92)', 'rgba(9,11,28,0.8)']} style={[fill, styles.pillFill]} />
                  <Image source={{ uri: characterImageUrl(p.CharacterId) }} style={styles.avatar} resizeMode="contain" />
                  <View style={styles.pillBody}>
                    <Text style={[styles.pillName, { color }]} numberOfLines={1}>
                      {p.NickName}
                    </Text>
                    <View style={styles.pillMeta}>
                      <Stars filled={p.Stars} size={11} />
                      <Text style={styles.pillCards}>{t('tv.cards', { n: String(cards) })}</Text>
                    </View>
                  </View>
                  <Text style={[styles.pillScore, { color }]} numberOfLines={1}>
                    {p.Point}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Xúc xắc, video, kết thúc ván: ở GỐC khung như trên phone. */}
      {s.dice ? <DiceRollOverlay value={s.dice.value} rolledBy={s.dice.rolledBy} /> : null}
      {s.battleVideo ? <BattleVideoOverlay key={s.battleVideo.seq} kind={s.battleVideo.kind} name={s.battleVideo.name} onDone={noop} /> : null}
      {s.gameOver ? (
        <GameOverOverlay
          gameId={null}
          meId={null}
          message={s.gameOver.message}
          isLeaderboard={s.isLeaderboard}
          players={s.players}
          unit={s.unit}
          oneUnit={s.oneUnit}
          onLeave={noop}
        />
      ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { backgroundColor: '#070B1F', overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row' },
  boardCol: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(4,4,14,0.35)',
  },
  sideCol: { gap: 8 },
  room: { fontSize: 18, fontWeight: '800', letterSpacing: 1.2, color: '#DCF6FF' },
  clock: { fontSize: 15, fontWeight: '700', color: boardColors.amber },
  players: { gap: 8, marginTop: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  pillTurn: { boxShadow: '0 0 14px rgba(255,198,30,0.45)' },
  pillFill: { borderRadius: 12 },
  avatar: { width: 34, height: 34 },
  pillBody: { flex: 1, minWidth: 0 },
  pillName: { fontSize: 14, fontWeight: '800' },
  pillMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillCards: { fontSize: 10.5, fontWeight: '700', color: boardColors.dim },
  pillScore: { fontSize: 20, fontWeight: '900' },
  turnBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 9,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(8,12,40,0.85)',
    borderWidth: 1.2,
    borderColor: 'rgba(95,230,255,0.45)',
  },
  turnBannerText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  notice: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 10,
    zIndex: 9,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(8,12,40,0.85)',
  },
  noticeText: { fontSize: 13, fontWeight: '700', color: boardColors.amber, textAlign: 'center' },
});
