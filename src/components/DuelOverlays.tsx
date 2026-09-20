import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { GameQuestion } from '../api/game';
import { useT } from '../i18n/I18nProvider';
import { boardColors, CARD_STYLES, fill, type CardKey } from './GameBoardParts';
import { GlowDivider } from './GlowDivider';
import { text } from '../theme/colors';

/**
 * DUEL V8 (K119, mockup "Changes for battle V8", Tony 2026-09-20) - mọi tấm của trận đấu tay đôi
 * TRỪ câu hỏi (vẫn là `QuestionOverlay` kind 'battle'), xúc xắc phân định (`BattleDiceOverlay`)
 * và video (`BattleVideoOverlay`). Chữ chép mockup; xem GAME_RULES mục 7h.
 *
 *   DuelCard          - tấm chữ chung, không chặn chạm (cùng khuôn `RaceNobodyOverlay`).
 *   DuelSetupOverlay  - gói 95: người thách đặt cược / người giữ ô chọn chủ đề / người khác xem
 *                       trạng thái; rồi "Duel ready" và hai tấm mở màn.
 *   DuelSummaryOverlay- gói 84: "The answers & results" → chiếu lại từng câu với tick/cross →
 *                       "We have a result." Xong thì báo (máy gửi 84 lên; server gate ghế đầu).
 *   DuelRewardOverlay - gói 96: người thắng chọn điểm hay thẻ (+ hộp "Card limit reached").
 */

const GOLD = '#FFC61E';
const GREEN = '#4DE84D';
const RED = '#FF5A6E';
const BLUE = '#5FE6FF';

const useCountdown = (seconds: number, key: unknown) => {
  const [left, setLeft] = useState(Math.max(0, seconds));
  useEffect(() => {
    setLeft(Math.max(0, seconds));
    const tick = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, key]);
  return left;
};

const Enter = ({ children, style }: { children: React.ReactNode; style?: object }) => {
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.back(1.3)) });
  }, [enter]);
  const anim = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.9 + enter.value * 0.1 }],
  }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
};

/* ─── Tấm chữ chung ────────────────────────────────────────────────────────── */

export function DuelCard({
  title,
  lines,
  accent = GOLD,
  footer,
  block = false,
}: {
  title?: string;
  /** Mỗi phần tử một dòng; `{ text, color }` để đổi màu từng dòng. */
  lines: (string | { text: string; color?: string; big?: boolean })[];
  accent?: string;
  footer?: string;
  /** Chặn chạm xuống dưới (bước mà người này KHÔNG được bấm gì khác). */
  block?: boolean;
}) {
  return (
    <View style={[styles.root, block && styles.rootBlock]} pointerEvents={block ? 'auto' : 'none'}>
      <Enter style={[styles.card, { borderColor: accent }]}>
        <LinearGradient colors={['rgba(58,8,16,0.97)', 'rgba(10,12,34,0.97)']} style={[fill, styles.cardFill]} />
        {title ? (
          <Text style={[styles.cardTitle, { color: accent }]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {lines.map((l, i) => {
          const item = typeof l === 'string' ? { text: l } : l;
          return (
            <Text
              key={i}
              style={[styles.cardLine, item.big && styles.cardLineBig, item.color ? { color: item.color } : null]}
              numberOfLines={3}
            >
              {item.text}
            </Text>
          );
        })}
        {footer ? <Text style={styles.cardFooter}>{footer}</Text> : null}
      </Enter>
    </View>
  );
}

/* ─── Bước đặt cược & chọn chủ đề (gói 95) ─────────────────────────────────── */

export type DuelSetupState = {
  phase: 'setup' | 'stake' | 'category' | 'timeout' | 'ready' | 'intro';
  attackerId: string;
  defenderId: string;
  attackerName: string;
  defenderName: string;
  isLeaderboard: boolean;
  maxStake: number;
  attackerPoints: number;
  defenderPoints: number;
  stakeDone: boolean;
  categoryDone: boolean;
  stake: number | null;
  categoryId: string | null;
  categoryName: string;
  categories: { Id: string; Title: string }[];
  duration: number;
  /** Mốc nhận gói - để đếm lùi đúng dù render lại. */
  seq: number;
};

export function DuelSetupOverlay({
  state,
  meId,
  unit,
  onStake,
  onCategory,
}: {
  state: DuelSetupState;
  meId: string;
  unit: (n: number) => string;
  onStake: (n: number) => void;
  onCategory: (id: string) => void;
}) {
  const t = useT();
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const amAttacker = same(meId, state.attackerId);
  const amDefender = same(meId, state.defenderId);
  const left = useCountdown(state.duration, state.seq);

  const [stake, setStake] = useState(0);
  const [pickedCat, setPickedCat] = useState<string | null>(null);
  const sentStake = useRef(false);
  const sentCat = useRef(false);

  /* Tấm mở màn: "[A] vs [B] / A duel" 3 s rồi thêm "The questions". */
  const [introSecond, setIntroSecond] = useState(false);
  useEffect(() => {
    if (state.phase !== 'intro') return;
    setIntroSecond(false);
    const id = setTimeout(() => setIntroSecond(true), Math.max(1000, (state.duration * 1000) / 2));
    return () => clearTimeout(id);
  }, [state.phase, state.seq, state.duration]);

  const stakeUnit = (n: number) => unit(n);

  /* ── ready ── */
  if (state.phase === 'ready') {
    const cat = state.categoryName.toUpperCase();
    const n = state.stake ?? 0;
    if (amAttacker || amDefender) {
      const opponent = amAttacker ? state.defenderName : state.attackerName;
      const lines = state.isLeaderboard
        ? [
            t('duel.readyCategory', { category: cat }),
            { text: t('duel.readyWinLeaderboard', { name: opponent }), color: GREEN },
            { text: t('duel.readyLoseLeaderboard'), color: RED },
          ]
        : [
            t('duel.readyCategory', { category: cat }),
            t('duel.readyStake', { n: String(n), unit: stakeUnit(n) }),
            { text: t('duel.readyWin', { n: String(n), unit: stakeUnit(n), name: opponent }), color: GREEN },
            { text: t('duel.readyLose', { n: String(n), unit: stakeUnit(n) }), color: RED },
          ];
      return <DuelCard title={t('duel.ready')} lines={lines} footer={t('duel.startsIn', { n: String(left) })} block />;
    }
    return (
      <DuelCard
        title={t('duel.readyCategory', { category: cat })}
        lines={[
          t('duel.readyBoardBody'),
          state.isLeaderboard
            ? t('duel.readyBoardRewardLeaderboard')
            : t('duel.readyBoardReward', { n: String(n), unit: stakeUnit(n) }),
          { text: t('duel.getReady', { n: String(left) }), color: GREEN },
        ]}
      />
    );
  }

  /* ── intro ── */
  if (state.phase === 'intro') {
    return (
      <View style={[styles.root, styles.rootBlock]} pointerEvents="auto">
        <Enter style={styles.stage}>
          <LinearGradient colors={['#0B2A66', '#061640', '#03081E']} locations={[0, 0.6, 1]} style={[fill, styles.stageFill]} />
          <Text style={styles.stageBig} numberOfLines={2}>
            {t('duel.introVs', { a: state.attackerName, b: state.defenderName })}
          </Text>
          <Text style={styles.stageSmall}>{t('duel.introDuel')}</Text>
          {introSecond ? <Text style={styles.stageGold}>{t('duel.introQuestions')}</Text> : null}
        </Enter>
      </View>
    );
  }

  /* ── setup: người thách đặt cược ── */
  if (amAttacker && !state.isLeaderboard && !state.stakeDone) {
    const confirm = () => {
      if (sentStake.current) return;
      sentStake.current = true;
      onStake(Math.min(Math.max(0, stake), state.maxStake));
    };
    return (
      <View style={styles.panel}>
        <LinearGradient colors={['#0D1030', '#06061A', '#03030C']} locations={[0, 0.55, 1]} style={fill} />
        <View style={styles.panelContent}>
          <Header title={t('duel.confirmStake')} left={left} />
          <View style={styles.vsRow}>
            <VsSide label={t('duel.you')} name="" points={state.attackerPoints} unit={unit} />
            <Text style={styles.vsText}>VS</Text>
            <VsSide label="" name={state.defenderName} points={state.defenderPoints} unit={unit} />
          </View>
          <Text style={styles.maxStake}>{t('duel.maxStake', { n: String(state.maxStake) })}</Text>
          <Text style={styles.hint}>{t('duel.maxStakeHint')}</Text>
          <Text style={styles.label}>{t('duel.chooseStake')}</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setStake((n) => Math.max(0, n - 1))}
              style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.stakeValue}>{stake}</Text>
            <Pressable
              onPress={() => setStake((n) => Math.min(state.maxStake, n + 1))}
              style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
          <Pressable onPress={confirm} style={({ pressed }) => [styles.confirm, pressed && styles.pressed]}>
            <Text style={styles.confirmText}>{t('duel.confirm')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ── setup: người giữ ô chọn chủ đề ── */
  if (amDefender && !state.categoryDone) {
    const confirm = () => {
      if (sentCat.current || !pickedCat) return;
      sentCat.current = true;
      onCategory(pickedCat);
    };
    return (
      <View style={styles.panel}>
        <LinearGradient colors={['#0D1030', '#06061A', '#03030C']} locations={[0, 0.55, 1]} style={fill} />
        <View style={styles.panelContent}>
          <Header title={t('duel.selectCategory')} left={left} />
          <View style={styles.vsRow}>
            <VsSide label={t('duel.bowler')} name={state.attackerName} points={state.attackerPoints} unit={unit} />
            <Text style={styles.vsText}>VS</Text>
            <VsSide label={t('duel.batter')} name={`${state.defenderName} (${t('duel.you').toLowerCase()})`} points={state.defenderPoints} unit={unit} />
          </View>
          <View style={styles.catList}>
            {state.categories.map((c) => {
              const on = pickedCat === c.Id;
              return (
                <Pressable
                  key={c.Id}
                  onPress={() => setPickedCat(c.Id)}
                  style={({ pressed }) => [styles.catBtn, on && styles.catBtnOn, pressed && styles.pressed]}
                >
                  <Text style={[styles.catText, on && styles.catTextOn]} numberOfLines={2}>
                    {c.Title.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={confirm}
            disabled={!pickedCat}
            style={({ pressed }) => [styles.confirm, !pickedCat && styles.confirmOff, pressed && pickedCat && styles.pressed]}
          >
            <Text style={styles.confirmText}>{t('duel.confirm')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ── đấu thủ đã xong phần mình - đợi bên kia ── */
  if (amAttacker || amDefender) {
    const lines: (string | { text: string; color?: string })[] = [];
    if (amAttacker) {
      if (!state.isLeaderboard && state.stake != null)
        lines.push({ text: t('duel.stakeConfirmed', { n: String(state.stake), unit: stakeUnit(state.stake) }), color: GREEN });
      lines.push(t('duel.waitingCategory', { name: state.defenderName }));
    } else {
      lines.push({ text: t('duel.categorySelected', { category: state.categoryName.toUpperCase() }), color: GREEN });
      if (!state.isLeaderboard) lines.push(t('duel.waitingStake', { name: state.attackerName }));
    }
    return <DuelCard title={t('duel.setupTitle')} lines={lines} footer={t('duel.closeIn', { n: String(left) })} block />;
  }

  /* ── người ngoài cuộc: trạng thái như bàn cờ ── */
  const status: (string | { text: string; color?: string })[] = state.isLeaderboard
    ? [t('duel.statusCheckPhoneLeaderboard', { name: state.defenderName })]
    : [t('duel.statusCheckPhone', { a: state.attackerName, b: state.defenderName })];
  if (!state.isLeaderboard) {
    status.push(
      state.stakeDone
        ? { text: t('duel.statusStakeDone', { name: state.attackerName, n: String(state.stake ?? 0), unit: stakeUnit(state.stake ?? 0) }), color: GREEN }
        : { text: t('duel.statusStake', { name: state.attackerName }), color: GOLD },
    );
  }
  status.push(
    state.categoryDone
      ? { text: t('duel.statusCategoryDone', { name: state.defenderName, category: state.categoryName.toUpperCase() }), color: GREEN }
      : { text: t('duel.statusCategory', { name: state.defenderName }), color: GOLD },
  );
  return (
    <DuelCard
      title={state.isLeaderboard ? t('duel.statusSettingLeaderboard') : t('duel.statusSetting')}
      lines={status}
      footer={t('duel.statusRandom', { n: String(left) })}
    />
  );
}

const Header = ({ title, left }: { title: string; left: number }) => {
  const t = useT();
  return (
    <View style={styles.topBar}>
      <View style={styles.bannerTag}>
        <Text style={styles.bannerText} numberOfLines={1}>
          {title.toUpperCase()}
        </Text>
      </View>
      <GlowDivider color="#F43F5E" accent={GOLD} height={1.5} flareWidth={70} style={styles.rule} />
      <Text style={styles.closeIn}>{t('duel.closeIn', { n: String(left) })}</Text>
    </View>
  );
};

const VsSide = ({ label, name, points, unit }: { label: string; name: string; points: number; unit: (n: number) => string }) => (
  <View style={styles.vsSide}>
    {label ? <Text style={styles.vsLabel}>{label.toUpperCase()}</Text> : null}
    {name ? (
      <Text style={styles.vsName} numberOfLines={1}>
        {name}
      </Text>
    ) : null}
    <Text style={styles.vsPoints}>
      {points} {unit(points)}
    </Text>
  </View>
);

/* ─── Tổng kết có tick/cross (gói 84) ──────────────────────────────────────── */

export type DuelSummaryData = {
  questions: GameQuestion[];
  correct: string[];
  challengeAnswers: string[];
  incumbentAnswers: string[];
  challengeId: string;
  incumbentId: string;
  challengeName: string;
  incumbentName: string;
  isTieBreaker: boolean;
  foundWinner: boolean;
  seq: number;
};

const INTRO_MS = 5000;
const PER_QUESTION_MS = 4000;
const RESULT_MS = 4000;

export function DuelSummaryOverlay({ data, onDone }: { data: DuelSummaryData; onDone: () => void }) {
  const t = useT();
  const same = (a: string, b: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
  /* Câu phụ: chỉ chiếu lại câu thứ tư (index 3), không mở màn lại. */
  const startIndex = data.isTieBreaker ? Math.min(3, Math.max(0, data.questions.length - 1)) : 0;
  const [step, setStep] = useState<'intro' | number | 'result'>(data.isTieBreaker ? startIndex : 'intro');
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    setStep(data.isTieBreaker ? startIndex : 'intro');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.seq]);

  useEffect(() => {
    let ms = PER_QUESTION_MS;
    if (step === 'intro') ms = INTRO_MS;
    if (step === 'result') ms = RESULT_MS;
    const id = setTimeout(() => {
      if (step === 'intro') setStep(startIndex);
      else if (step === 'result') done.current();
      else setStep(step + 1 < data.questions.length ? step + 1 : 'result');
    }, ms);
    return () => clearTimeout(id);
  }, [step, startIndex, data.questions.length]);

  const count = (list: string[], upTo: number) =>
    list.reduce((n, id, i) => (i <= upTo && data.correct[i] && same(id, data.correct[i]) ? n + 1 : n), 0);

  if (step === 'intro') {
    return (
      <View style={[styles.root, styles.rootBlock]} pointerEvents="auto">
        <Enter style={styles.stage}>
          <LinearGradient colors={['#0B2A66', '#061640', '#03081E']} locations={[0, 0.6, 1]} style={[fill, styles.stageFill]} />
          <Text style={styles.stageBig} numberOfLines={2}>
            {t('duel.introVs', { a: data.challengeName, b: data.incumbentName })}
          </Text>
          <Text style={styles.stageSmall}>{t('duel.introDuel')}</Text>
          <Text style={styles.stageGold}>{t('duel.introResults')}</Text>
        </Enter>
      </View>
    );
  }

  const total = data.questions.length - 1;
  if (step === 'result') {
    const a = count(data.challengeAnswers, total);
    const b = count(data.incumbentAnswers, total);
    const winner = a === b ? '' : a > b ? data.challengeName : data.incumbentName;
    const lines: (string | { text: string; color?: string; big?: boolean })[] = [
      t('duel.resultLine', { name: data.challengeName, n: String(a) }),
      t('duel.resultLine', { name: data.incumbentName, n: String(b) }),
    ];
    let title = t('duel.resultTitle');
    if (data.foundWinner && winner) lines.push({ text: t('duel.resultWon', { name: winner }), color: GOLD, big: true });
    else if (data.isTieBreaker) title = t('battle.noWinner');
    else title = t('battle.tieBreakerTime');
    return <DuelCard title={title} lines={lines} accent={BLUE} block />;
  }

  const q = data.questions[step];
  const correctId = data.correct[step] ?? '';
  const letter = (i: number) => String.fromCharCode(65 + i);
  const pick = (list: string[]) => {
    const id = list[step] ?? '';
    const idx = q?.Answers.findIndex((an) => same(an.Id, id)) ?? -1;
    return { idx, ok: idx >= 0 && same(id, correctId) };
  };
  const a = pick(data.challengeAnswers);
  const b = pick(data.incumbentAnswers);
  const label = step >= 3 ? t('battle.tieBreaker') : t('duel.question', { index: String(step + 1) });

  return (
    <View style={[styles.root, styles.rootBlock]} pointerEvents="auto">
      <Enter style={styles.replay}>
        <LinearGradient colors={['#0B2A66', '#061640', '#03081E']} locations={[0, 0.6, 1]} style={[fill, styles.stageFill]} />
        <Text style={styles.replayLabel}>{label}</Text>
        <Text style={styles.replayQuestion} numberOfLines={3}>
          {q?.Title ?? ''}
        </Text>
        <View style={styles.replayAnswers}>
          {(q?.Answers ?? []).map((an, i) => {
            const ok = same(an.Id, correctId);
            return (
              <View key={an.Id} style={[styles.replayAnswer, ok && styles.replayAnswerOk]}>
                <Text style={[styles.replayLetter, ok && { color: '#062A10' }]}>{letter(i)}</Text>
                <Text style={[styles.replayContent, ok && { color: '#062A10' }]} numberOfLines={2}>
                  {an.Content}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.boxes}>
          <PlayerBox name={data.challengeName} letter={a.idx >= 0 ? letter(a.idx) : '–'} ok={a.ok} score={count(data.challengeAnswers, step)} color={GOLD} />
          <PlayerBox name={data.incumbentName} letter={b.idx >= 0 ? letter(b.idx) : '–'} ok={b.ok} score={count(data.incumbentAnswers, step)} color={boardColors.purple} />
        </View>
      </Enter>
    </View>
  );
}

const PlayerBox = ({ name, letter, ok, score, color }: { name: string; letter: string; ok: boolean; score: number; color: string }) => {
  const t = useT();
  return (
    <View style={[styles.box, { borderColor: color }]}>
      <Text style={[styles.boxName, { color }]} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.boxRow}>
        <Text style={styles.boxLetter}>{letter}</Text>
        <Text style={[styles.boxMark, { color: ok ? GREEN : RED }]}>{ok ? '✓' : '✗'}</Text>
      </View>
      <Text style={styles.boxScore}>
        {t('duel.score')} {score}
      </Text>
    </View>
  );
};

/* ─── Người thắng chọn thưởng (gói 96) ─────────────────────────────────────── */

export type DuelRewardState = {
  phase: 'choose' | 'done';
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
  stake: number;
  isLeaderboard: boolean;
  loserCards: { CardId: string; Name: string; Quantity: number; WinnerQuantity: number; Cap: number }[];
  duration: number;
  choice: string;
  cardId: string;
  cardName: string;
  discarded: boolean;
  seq: number;
};

export function DuelRewardOverlay({
  state,
  meId,
  unit,
  onChoose,
}: {
  state: DuelRewardState;
  meId: string;
  unit: (n: number) => string;
  onChoose: (choice: 'points' | 'card', cardId?: string, discard?: boolean) => void;
}) {
  const t = useT();
  const same = (a: string, b: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
  const amWinner = same(meId, state.winnerId);
  const amLoser = same(meId, state.loserId);
  const left = useCountdown(state.duration, state.seq);
  const [mode, setMode] = useState<'points' | 'card' | null>(state.isLeaderboard ? 'card' : null);
  const [card, setCard] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const sent = useRef(false);

  const cardUnit = (n: number) => unit(n);

  /* ── done: tấm chuyển điểm/thẻ cho cả phòng, người thua có câu riêng ── */
  if (state.phase === 'done') {
    let line = '';
    if (state.choice === 'points') {
      line = amLoser
        ? t('duel.pointsLost', { n: String(state.stake), unit: cardUnit(state.stake), name: state.winnerName })
        : t('duel.pointsFrom', { n: String(state.stake), unit: cardUnit(state.stake), name: state.loserName });
    } else if (state.choice === 'card') {
      line = amLoser
        ? t('duel.cardLost', { card: state.cardName, name: state.winnerName })
        : t('duel.cardFrom', { card: state.cardName, name: state.loserName }) + (state.discarded ? ` ${t('duel.cardDiscarded')}` : '');
    } else {
      line = t('duel.nothing');
    }
    return (
      <DuelCard
        title={amLoser ? undefined : `${t('duel.winner')}: ${state.winnerName}`}
        lines={[{ text: line, color: amLoser ? RED : GREEN, big: true }]}
        accent={amLoser ? RED : GREEN}
      />
    );
  }

  if (!amWinner) {
    return (
      <DuelCard
        title={`${t('duel.winner')}: ${state.winnerName}`}
        lines={[t('duel.winnerChoosing')]}
        footer={t('duel.closeIn', { n: String(left) })}
      />
    );
  }

  const cards = state.loserCards.filter((c) => c.Quantity > 0);
  const picked = cards.find((c) => c.CardId === card) ?? null;
  const pickedFull = !!picked && picked.WinnerQuantity >= picked.Cap;
  const canSelect = mode === 'points' || (mode === 'card' && !!picked);

  const send = (discard: boolean) => {
    if (sent.current) return;
    sent.current = true;
    if (mode === 'points') onChoose('points');
    else if (picked) onChoose('card', picked.CardId, discard);
  };
  const select = () => {
    if (!canSelect) return;
    if (mode === 'card' && pickedFull) {
      setConfirmDiscard(true);
      return;
    }
    send(false);
  };

  return (
    <View style={styles.panel}>
      <LinearGradient colors={['#0D1030', '#06061A', '#03030C']} locations={[0, 0.55, 1]} style={fill} />
      <ScrollView contentContainerStyle={styles.panelContent} bounces={false}>
        <Header title={t('duel.victory')} left={left} />

        {!state.isLeaderboard ? (
          <>
            <Pressable
              onPress={() => {
                setMode('points');
                setCard(null);
              }}
              style={({ pressed }) => [styles.choice, styles.choiceGreen, mode === 'points' && styles.choiceOn, pressed && styles.pressed]}
            >
              <Text style={styles.choiceText}>{t('duel.claimPoints', { n: String(state.stake), unit: cardUnit(state.stake) })}</Text>
            </Pressable>
            <Text style={styles.or}>{t('duel.or')}</Text>
          </>
        ) : null}

        <Pressable
          onPress={() => cards.length > 0 && setMode('card')}
          disabled={cards.length === 0}
          style={({ pressed }) => [
            styles.choice,
            styles.choiceRed,
            mode === 'card' && styles.choiceOn,
            cards.length === 0 && styles.choiceOff,
            pressed && cards.length > 0 && styles.pressed,
          ]}
        >
          <Text style={styles.choiceText}>{t('duel.claimCard')}</Text>
        </Pressable>
        {cards.length === 0 ? (
          <Text style={styles.noCard}>{t('duel.loserNoCard', { name: state.loserName })}</Text>
        ) : mode === 'card' ? (
          <>
            <Text style={styles.hint}>{t('duel.chooseCard')}</Text>
            <View style={styles.cardRow}>
              {cards.map((c) => {
                const key = c.CardId as CardKey;
                const style = CARD_STYLES[key];
                if (!style) return null;
                const on = card === c.CardId;
                return (
                  <Pressable
                    key={c.CardId}
                    onPress={() => setCard(c.CardId)}
                    style={({ pressed }) => [styles.cardTile, { borderColor: on ? GOLD : style.glow }, pressed && styles.pressed]}
                  >
                    <LinearGradient colors={on ? ['rgba(84,60,4,0.6)', '#090B1C'] : [style.tint, '#090B1C']} style={[fill, styles.cardTileFill]} />
                    <style.Icon size={28} />
                    <Text style={[styles.cardTileName, on && { color: GOLD }]} numberOfLines={1}>
                      {t(`game.card.${key}`)}
                    </Text>
                    <Text style={styles.cardTileCount}>×{c.Quantity}</Text>
                  </Pressable>
                );
              })}
            </View>
            {picked ? (
              <Text style={[styles.capacity, pickedFull && { color: RED }]}>
                {pickedFull
                  ? t('duel.capacityFull', { have: String(picked.WinnerQuantity), cap: String(picked.Cap) })
                  : t('duel.cardCount', { have: String(picked.WinnerQuantity), cap: String(picked.Cap) })}
              </Text>
            ) : null}
          </>
        ) : null}

        <Pressable
          onPress={select}
          disabled={!canSelect}
          style={({ pressed }) => [styles.confirm, !canSelect && styles.confirmOff, pressed && canSelect && styles.pressed]}
        >
          <Text style={styles.confirmText}>{t('duel.select')}</Text>
        </Pressable>
      </ScrollView>

      {confirmDiscard ? (
        <View style={styles.dialogRoot}>
          <View style={styles.dialog}>
            <LinearGradient colors={['rgba(58,8,16,0.98)', 'rgba(10,12,34,0.98)']} style={[fill, styles.cardFill]} />
            <Text style={styles.dialogTitle}>{t('duel.limitTitle')}</Text>
            <Text style={styles.dialogBody}>{t('duel.limitBody')}</Text>
            <View style={styles.dialogRow}>
              <Pressable onPress={() => setConfirmDiscard(false)} style={({ pressed }) => [styles.dialogBtn, styles.dialogNo, pressed && styles.pressed]}>
                <Text style={styles.dialogBtnText}>{t('duel.no')}</Text>
              </Pressable>
              <Pressable onPress={() => send(true)} style={({ pressed }) => [styles.dialogBtn, styles.dialogYes, pressed && styles.pressed]}>
                <Text style={styles.dialogBtnText}>{t('duel.yes')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rootBlock: { backgroundColor: 'rgba(3,4,14,0.55)', borderRadius: 14 },

  card: {
    maxWidth: '88%',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.6,
    alignItems: 'center',
    gap: 5,
    overflow: 'hidden',
  },
  cardFill: { borderRadius: 16 },
  cardTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },
  cardLine: { fontSize: 13, lineHeight: 17, fontWeight: '600', color: text.primary, textAlign: 'center' },
  cardLineBig: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  cardFooter: { marginTop: 4, fontSize: 12, fontWeight: '700', color: 'rgba(226,232,255,0.7)', textAlign: 'center' },

  stage: {
    width: '86%',
    paddingHorizontal: 24,
    paddingVertical: 22,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(95,230,255,0.7)',
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden',
    boxShadow: '0 0 24px rgba(31,111,214,0.5)',
  },
  stageFill: { borderRadius: 18 },
  stageBig: { fontSize: 20, lineHeight: 26, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  stageSmall: { fontSize: 14, fontWeight: '600', color: 'rgba(226,232,255,0.85)', textAlign: 'center' },
  stageGold: { marginTop: 4, fontSize: 18, fontWeight: '900', color: GOLD, textAlign: 'center' },

  replay: {
    width: '96%',
    height: '96%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(95,230,255,0.7)',
    overflow: 'hidden',
    gap: 4,
  },
  replayLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: BLUE },
  replayQuestion: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: '#FFFFFF' },
  replayAnswers: { gap: 4, marginTop: 2 },
  replayAnswer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: 'rgba(200,220,255,0.45)',
    backgroundColor: 'rgba(8,12,40,0.7)',
  },
  replayAnswerOk: { backgroundColor: GREEN, borderColor: GREEN },
  replayLetter: { width: 16, fontSize: 12, fontWeight: '900', color: BLUE },
  replayContent: { flex: 1, fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 'auto' },
  box: {
    minWidth: 110,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: 'rgba(8,12,40,0.85)',
    alignItems: 'center',
    gap: 1,
  },
  boxName: { fontSize: 11, fontWeight: '800' },
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  boxLetter: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  boxMark: { fontSize: 22, fontWeight: '900' },
  boxScore: { fontSize: 11, fontWeight: '700', color: 'rgba(226,232,255,0.85)' },

  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 16,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: 'rgba(244,63,94,0.45)',
    backgroundColor: '#04040E',
    overflow: 'hidden',
    boxShadow: '0 0 20px rgba(244,63,94,0.3)',
  },
  panelContent: { flexGrow: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerTag: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
    borderWidth: 1.3,
    borderColor: 'rgba(244,63,94,0.65)',
    backgroundColor: 'rgba(48,6,16,0.9)',
    maxWidth: '60%',
  },
  bannerText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: '#FB7185' },
  rule: { flex: 1 },
  closeIn: { fontSize: 11, fontWeight: '700', color: 'rgba(226,232,255,0.7)' },

  vsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  vsSide: { alignItems: 'center', minWidth: 90 },
  vsLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: boardColors.dim },
  vsName: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  vsPoints: { fontSize: 12, fontWeight: '700', color: GOLD },
  vsText: { fontSize: 14, fontWeight: '900', color: '#FB7185' },
  maxStake: { fontSize: 14, fontWeight: '900', color: GOLD, textAlign: 'center' },
  hint: { fontSize: 10.5, lineHeight: 13, color: boardColors.dim, textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  stepBtn: {
    width: 40,
    height: 34,
    borderRadius: 8,
    borderWidth: 1.4,
    borderColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,26,34,0.9)',
  },
  stepText: { fontSize: 20, fontWeight: '900', color: BLUE, lineHeight: 24 },
  stakeValue: { minWidth: 60, fontSize: 26, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },

  confirm: {
    alignSelf: 'center',
    marginTop: 4,
    minWidth: 150,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.6,
    borderColor: GOLD,
    backgroundColor: 'rgba(84,60,4,0.85)',
    boxShadow: '0 0 16px rgba(255,198,30,0.5)',
  },
  confirmOff: { opacity: 0.4 },
  confirmText: { fontSize: 13, fontWeight: '900', letterSpacing: 1.2, color: GOLD },

  catList: { gap: 6, marginTop: 2 },
  catBtn: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1.4,
    borderColor: 'rgba(95,230,255,0.5)',
    backgroundColor: 'rgba(8,26,34,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  catBtnOn: { borderColor: GOLD, backgroundColor: 'rgba(84,60,4,0.6)' },
  catText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: BLUE, textAlign: 'center' },
  catTextOn: { color: GOLD },

  choice: {
    height: 36,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  choiceGreen: { borderColor: GREEN, backgroundColor: 'rgba(8,60,20,0.8)' },
  choiceRed: { borderColor: '#FB7185', backgroundColor: 'rgba(70,8,20,0.8)' },
  choiceOn: { borderColor: GOLD, boxShadow: '0 0 14px rgba(255,198,30,0.5)' },
  choiceOff: { opacity: 0.35 },
  choiceText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.6, color: '#FFFFFF' },
  or: { fontSize: 11, fontWeight: '700', color: boardColors.dim, textAlign: 'center' },
  noCard: { fontSize: 11, fontWeight: '700', color: boardColors.dim, textAlign: 'center' },
  cardRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  cardTile: {
    width: 74,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.4,
    alignItems: 'center',
    gap: 2,
    overflow: 'hidden',
  },
  cardTileFill: { borderRadius: 10 },
  cardTileName: { fontSize: 9.5, fontWeight: '800', color: '#FFFFFF' },
  cardTileCount: { fontSize: 10, fontWeight: '800', color: boardColors.dim },
  capacity: { fontSize: 11, fontWeight: '800', color: GREEN, textAlign: 'center' },

  dialogRoot: {
    ...fill,
    zIndex: 30,
    backgroundColor: 'rgba(3,4,14,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    width: '80%',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.6,
    borderColor: RED,
    gap: 8,
    overflow: 'hidden',
  },
  dialogTitle: { fontSize: 15, fontWeight: '900', color: RED, textAlign: 'center' },
  dialogBody: { fontSize: 12, lineHeight: 16, color: '#FFFFFF', textAlign: 'center' },
  dialogRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 4 },
  dialogBtn: { minWidth: 90, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.4 },
  dialogNo: { borderColor: RED, backgroundColor: 'rgba(70,8,20,0.85)' },
  dialogYes: { borderColor: GREEN, backgroundColor: 'rgba(8,60,20,0.85)' },
  dialogBtnText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },

  pressed: { opacity: 0.85 },
});
