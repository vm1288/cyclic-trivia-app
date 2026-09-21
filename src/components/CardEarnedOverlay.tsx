import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RewardGlyph } from './RewardGlyph';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { CARD_STYLES, type CardKey } from './GameBoardParts';
import { useT } from '../i18n/I18nProvider';

/**
 * "Đủ 5 sao — bạn được thưởng {lá}" (K86, Tony 2026-09-14): tấm nổi giữa bàn cờ, lá bài
 * to ở giữa, sống `ms` rồi gọi `onDone` — màn ván lúc đó mới bắn `FlyingReward` bay về ô lá
 * ở cột phải. Trước đây chỉ có một dòng `notice` nhỏ trên đỉnh, hiện 2,5 s trong lúc tấm
 * kết quả câu hỏi còn che - Tony không thấy.
 */
export function CardEarnedOverlay({ card, name, ms, onDone }: { card: CardKey; name: string; ms: number; onDone: () => void }) {
  const t = useT();
  const style = CARD_STYLES[card];
  const Icon = style.Icon;
  const scale = useSharedValue(0.6);
  const fade = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.08, { duration: 260, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 160 }),
    );
    fade.value = withTiming(1, { duration: 200 });
    const done = setTimeout(onDone, ms);
    return () => clearTimeout(done);
  }, [scale, fade, ms, onDone]);

  const anim = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.card, anim]}>
        <LinearGradient
          colors={[style.tint, '#07051A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.fill, { borderColor: style.accent, boxShadow: `0 0 28px ${style.glow}` }]}
        />
        <View style={styles.stars}>{[0, 1, 2, 3, 4].map((i) => <RewardGlyph key={i} size={16} color="#FFC61E" />)}</View>
        <Text style={styles.title}>{t('cards.earnedTitle')}</Text>
        <Text style={styles.sub}>{t('cards.earnedBody', { name })}</Text>
        <View style={styles.glyph}>
          <Icon size={44} />
        </View>
        <Text style={[styles.name, { color: style.accent }]}>{t(`game.card.${card}` as 'game.card.Joker').toUpperCase()}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 40 },
  card: { width: 300, paddingVertical: 18, paddingHorizontal: 22, alignItems: 'center', borderRadius: 20 },
  fill: { borderRadius: 20, borderWidth: 1.6 },
  stars: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 1.2 },
  glyph: { marginTop: 10, marginBottom: 8 },
  name: { fontSize: 22, fontWeight: '900', letterSpacing: 1.6 },
  sub: { marginTop: 6, color: 'rgba(198,212,240,0.85)', fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
});
