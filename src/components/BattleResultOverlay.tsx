import { useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '../i18n/I18nProvider';
import { fill } from './GameBoardParts';
import { text } from '../theme/colors';

/**
 * "X thắng trận đấu" - hiện giữa bàn cờ khi battle ngã ngũ.
 *
 * Cùng lý do tồn tại với `RaceWinnerOverlay`: bản web hiện câu này trên bàn cờ
 * chung bằng video người thắng, còn máy người chơi không nhận gì cả. App không
 * có bàn cờ chung, nên không có khung này thì trận đấu kết thúc trong im lặng -
 * quân cờ tự lùi một ô mà không ai hiểu vì sao.
 *
 * Dữ liệu tới qua gói `PlayerBattleWinner` (58), nay được server phát cho cả
 * phòng (2026-09-10) chứ không chỉ cho bàn cờ. Xem GAME_RULES mục 7b.
 *
 * ⚠️ KHÔNG hiện điểm chuyển tay ở đây. Điểm chỉ đổi chủ ở ván không tính
 * leaderboard, và con số đó về bằng gói `PlayerRank` (24) riêng - hàng điểm ở
 * cột phải tự cập nhật. Vẽ lại ở đây là hai nguồn số, dễ lệch.
 */
export function BattleResultOverlay({ name, isMe }: { name: string; isMe: boolean }) {
  const t = useT();

  const enter = useSharedValue(0);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.back(1.6)) });
    glow.value = withDelay(
      260,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.4, { duration: 620, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [enter, glow]);

  const card = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.86 + enter.value * 0.14 }],
  }));
  const halo = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    /* Không chặn chạm: ngay sau khung này là lượt chơi đi tiếp. */
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.card, card]}>
        <LinearGradient
          colors={['rgba(60,10,16,0.96)', 'rgba(10,12,34,0.96)']}
          style={[fill, styles.cardFill]}
        />
        <Animated.View style={[styles.halo, halo]} pointerEvents="none" />

        <Text style={styles.title} numberOfLines={2}>
          {isMe ? t('battle.wonYou') : t('battle.won', { name })}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {isMe ? t('battle.wonBody') : t('battle.lostBody')}
        </Text>
      </Animated.View>
    </View>
  );
}

const BATTLE_RED = '#FB7185';

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    maxWidth: '84%',
    paddingHorizontal: 26,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.6,
    borderColor: BATTLE_RED,
    alignItems: 'center',
    gap: 5,
    overflow: 'hidden',
  },
  cardFill: { borderRadius: 16 },
  halo: {
    position: 'absolute',
    top: -1.6,
    left: -1.6,
    right: -1.6,
    bottom: -1.6,
    borderRadius: 16,
    borderWidth: 1.6,
    borderColor: BATTLE_RED,
    boxShadow: '0 0 18px rgba(251,113,133,0.85), 0 0 34px rgba(251,113,133,0.35)',
  },

  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: '#FFC61E',
    textAlign: 'center',
  },
  body: { fontSize: 13, fontWeight: '600', color: text.primary, textAlign: 'center' },
});
