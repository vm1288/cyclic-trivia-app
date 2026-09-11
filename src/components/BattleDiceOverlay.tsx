import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../i18n/I18nProvider';
import { boardColors, fill } from './GameBoardParts';
import { text } from '../theme/colors';

/**
 * Trạng thái vòng tung xúc xắc phân định của battle - đúng hình gói 91 `BattleDice`.
 */
export type BattleDiceState = {
  phase: 'start' | 'rolled' | 'tie' | 'won' | 'rolling';
  attackerId: string;
  defenderId: string;
  attackerName: string;
  defenderName: string;
  attackerRoll: number | null;
  defenderRoll: number | null;
  /** Ai đang được tung; null khi đã có người thắng. */
  rollerId: string | null;
  round: number;
  winnerId: string | null;
};

/**
 * Vòng TUNG XÚC XẮC PHÂN ĐỊNH sau câu phụ mà vẫn hoà - chép bố cục mockup
 * "Battle - Tie-breaker" (Tony, 2026-09-11, K57):
 *
 *   Still tied! Both players must now roll a die, the player with the higher roll wins the battle.
 *   [Attacker's name]          [Defender's name]
 *   You go first!              Waiting...          <- chưa ai tung
 *   Rolling...                 Waiting...          <- attacker vừa bấm
 *   6                          It's your turn!     <- attacker xong, tới defender
 *   6                          4
 *              [Player's Name] won!                <- 3 giây rồi sang video/khung thắng
 *
 * Mockup vẽ cho bàn cờ chung (TV) nên chữ trạng thái là chữ CHUNG, không đổi theo
 * người xem: mọi máy đều thấy "You go first!" dưới tên attacker. Bằng nhau thì
 * "tie" - tung lại từ attacker (mockup không nói, tự chốt, ghi ở GAME_RULES 7e).
 *
 * Nút ROLL DICE của người tới lượt tung nằm ở cột phải như mọi lượt tung khác -
 * khung này chỉ để xem. Hiệu ứng xúc xắc lăn dùng lại `DiceRollOverlay`.
 */
export function BattleDiceOverlay({ state, meId }: { state: BattleDiceState; meId: string }) {
  const t = useT();

  const isAttackerTurn = state.rollerId === state.attackerId;
  const isDefenderTurn = state.rollerId === state.defenderId;

  const statusOf = (side: 'attacker' | 'defender') => {
    const rolled = side === 'attacker' ? state.attackerRoll : state.defenderRoll;
    if (state.winnerId) return null;
    if (rolled != null) return null;
    const myTurn = side === 'attacker' ? isAttackerTurn : isDefenderTurn;
    if (!myTurn) return t('battle.diceWaiting');
    if (state.phase === 'rolling') return t('battle.diceRolling');
    return side === 'attacker' && state.round === 1 ? t('battle.diceYouFirst') : t('battle.diceYourTurn');
  };

  const winnerName = state.winnerId
    ? state.winnerId === state.attackerId
      ? state.attackerName
      : state.defenderName
    : '';

  const column = (side: 'attacker' | 'defender') => {
    const name = side === 'attacker' ? state.attackerName : state.defenderName;
    const id = side === 'attacker' ? state.attackerId : state.defenderId;
    const roll = side === 'attacker' ? state.attackerRoll : state.defenderRoll;
    const status = statusOf(side);
    const isWinner = !!state.winnerId && state.winnerId === id;
    return (
      <View style={styles.col}>
        <Text style={[styles.name, isWinner && styles.nameWinner]} numberOfLines={1}>
          {name}
          {id === meId ? ` (${t('battle.diceYou')})` : ''}
        </Text>
        {roll != null ? (
          <Text style={[styles.roll, isWinner && styles.rollWinner]}>{roll}</Text>
        ) : (
          <Text style={styles.status}>{status ?? ''}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.card}>
        <LinearGradient
          colors={['rgba(40,10,40,0.97)', 'rgba(10,12,34,0.97)']}
          style={[fill, styles.cardFill]}
        />
        <Text style={styles.title}>{t('battle.diceTitle')}</Text>
        {state.round > 1 && !state.winnerId ? (
          <Text style={styles.again}>{t('battle.diceTie', { round: String(state.round) })}</Text>
        ) : null}

        <View style={styles.row}>
          {column('attacker')}
          <Text style={styles.vs}>VS</Text>
          {column('defender')}
        </View>

        {state.winnerId ? (
          <Text style={styles.won}>
            {state.winnerId === meId ? t('battle.diceWonYou') : t('battle.diceWon', { name: winnerName })}
          </Text>
        ) : null}
      </View>
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
    /* Trên câu hỏi (20) - câu phụ đã khép, khung này thay chỗ. */
    zIndex: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '92%',
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.6,
    borderColor: boardColors.purple,
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    boxShadow: '0 0 18px rgba(200,107,255,0.55)',
  },
  cardFill: { borderRadius: 16 },

  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    color: text.primary,
    textAlign: 'center',
  },
  again: { fontSize: 12, fontWeight: '800', color: boardColors.amber, letterSpacing: 0.5 },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  col: { flex: 1, alignItems: 'center', gap: 6 },
  vs: { fontSize: 13, fontWeight: '900', color: boardColors.dim, marginTop: 4 },
  name: { fontSize: 15, fontWeight: '900', letterSpacing: 0.6, color: boardColors.blueSoft },
  nameWinner: { color: boardColors.green },
  status: { fontSize: 13, fontWeight: '700', color: boardColors.amber, minHeight: 34, textAlignVertical: 'center' },
  roll: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '900',
    color: text.primary,
  },
  rollWinner: { color: boardColors.green },

  won: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: boardColors.green,
    textAlign: 'center',
  },
});
