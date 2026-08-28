import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import type { TurnCard } from '../api/game';
import { useT } from '../i18n/I18nProvider';
import { boardColors, CARD_STYLES, fill, type CardKey } from './GameBoardParts';
import { GlowDivider } from './GlowDivider';
import { text } from '../theme/colors';

/**
 * "Dùng thẻ bài trước khi trả lời?" - bước server luôn chèn giữa nước đi và câu
 * hỏi (`PlayerGetNextAction` với `Action = 5`).
 *
 * ⚠️ BẮT BUỘC phải trả lời bước này, kể cả khi người chơi không muốn dùng gì:
 * bấm SKIP gửi `ActionDone`, còn im lặng thì câu hỏi KHÔNG BAO GIỜ TỚI. Bản web
 * cũng vậy (hàm `skipCard` trong `ShowCardsBeforeQuestion.cshtml`), và hết giờ
 * thì nó tự skip - ở đây cũng thế.
 *
 * ⚠️ Chỉ hiện những thẻ dùng ĐƯỢC TRƯỚC câu hỏi: server đã lọc sẵn trong
 * `cardsToShow` (`ShowBeforeQuestion = true`), thực tế là Joker và Changer.
 * Skipper/Eliminator dùng TRONG lúc có câu hỏi, đi đường khác
 * (`UseCardInQuestion`), đừng nhét vào đây.
 *
 * Luật từng thẻ (GAME_RULES mục 6):
 *   Joker   - trả lời đúng thì NHÂN ĐÔI điểm. Cả ván chỉ có 1 lá.
 *   Changer - ĐỔI sang chủ đề khác. Server đổi xong mới gửi câu hỏi, nên có
 *             nhịp chờ ~3 giây trước khi màn câu hỏi hiện ra.
 */

/** Màu của thẻ ĐANG chọn - vàng nhấp nháy, cùng quy ước với màn câu hỏi. */
const PICKED = '#FFC61E';

const ClockIcon = ({ color }: { color: string }) => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}
       strokeLinecap="round">
    <Circle cx={12} cy={13} r={8} />
    <Path d="M12 9.5v4" />
    <Path d="M9.5 3.5h5" />
  </Svg>
);

/** Xem ghi chú `PickedPulse` ở `QuestionOverlay` - cùng lý do, cùng cách làm. */
const PickedPulse = ({ radius }: { radius: number }) => {
  const glow = useSharedValue(0.25);

  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [glow]);

  const style = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pickedPulse, { borderRadius: radius }, style]}
    />
  );
};

const mmss = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export function CardChoiceOverlay({
  cards,
  categoryTitle,
  durationSeconds,
  onUse,
  onSkip,
}: {
  cards: TurnCard[];
  /** Chủ đề của ô vừa tới - bản web cũng hiện nó ở đầu bước này. */
  categoryTitle: string;
  durationSeconds: number;
  onUse: (cardId: string) => void;
  /** Gọi cả khi hết giờ. */
  onSkip: () => void;
}) {
  const t = useT();

  const [left, setLeft] = useState(durationSeconds || 15);
  const [chosen, setChosen] = useState<string | null>(null);

  /** Một bước chỉ trả lời ĐÚNG MỘT LẦN - xem ghi chú ở `QuestionOverlay`. */
  const sent = useRef(false);
  const skip = useRef(onSkip);
  skip.current = onSkip;

  useEffect(() => {
    sent.current = false;
    setChosen(null);
    setLeft(durationSeconds || 15);
  }, [durationSeconds, cards]);

  useEffect(() => {
    const tick = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, [cards]);

  /* Hết giờ bắn trong EFFECT - xem ghi chú cùng lý do ở `QuestionOverlay`. */
  useEffect(() => {
    if (left > 0 || sent.current) return;
    sent.current = true;
    skip.current();
  }, [left]);

  const use = () => {
    if (sent.current || !chosen) return;
    sent.current = true;
    onUse(chosen);
  };

  const doSkip = () => {
    if (sent.current) return;
    sent.current = true;
    onSkip();
  };

  const urgent = left <= 5;
  const clockColor = urgent ? '#FF6B78' : boardColors.purple;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0D1030', '#06061A', '#03030C']}
        locations={[0, 0.55, 1]}
        style={fill}
      />

      <View style={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.bannerTag}>
            <Text style={styles.bannerText} numberOfLines={1}>
              {(categoryTitle || t('cards.title')).toUpperCase()}
            </Text>
          </View>

          <GlowDivider color="#1F6FD6" accent="#5FE6FF" height={1.5} flareWidth={70} style={styles.rule} />

          <View style={[styles.timerTag, urgent && styles.timerTagUrgent]}>
            <ClockIcon color={clockColor} />
            <Text style={[styles.timerText, { color: clockColor }]}>{mmss(left)}</Text>
          </View>

          <Pressable onPress={doSkip} style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}>
            <Text style={styles.skipText}>{t('cards.skip')}</Text>
          </Pressable>

          <Pressable
            onPress={use}
            disabled={!chosen}
            style={({ pressed }) => [
              styles.useBtn,
              chosen ? styles.useBtnOn : styles.useBtnOff,
              pressed && chosen && styles.pressed,
            ]}
          >
            <Text style={[styles.useText, !chosen && styles.useTextOff]}>{t('cards.use')}</Text>
          </Pressable>
        </View>

        <Text style={styles.prompt}>{t('cards.prompt')}</Text>

        <View style={styles.row}>
          {cards.map((card) => {
            const key = card.CardId as CardKey;
            const style = CARD_STYLES[key];
            if (!style) return null;

            const picked = chosen === card.Id;

            return (
              <Pressable
                key={card.Id}
                onPress={() => !sent.current && setChosen(picked ? null : card.Id)}
                style={({ pressed }) => [
                  styles.card,
                  { borderColor: picked ? PICKED : style.glow },
                  pressed && styles.pressedSm,
                ]}
              >
                <LinearGradient
                  colors={picked ? ['rgba(84,60,4,0.6)', '#090B1C'] : [style.tint, '#090B1C']}
                  style={[fill, styles.cardFill]}
                />

                {picked ? <PickedPulse radius={12} /> : null}

                <style.Icon size={34} />

                <Text style={[styles.cardName, picked && { color: PICKED }]} numberOfLines={1}>
                  {t(`game.card.${key}`)}
                </Text>

                <Text style={styles.cardBody} numberOfLines={3}>
                  {t(`cards.body.${key}`)}
                </Text>

                <Text style={[styles.cardCount, picked && { color: PICKED }]}>
                  ×{card.Quantity}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Phủ kín vùng bàn cờ và chặn chạm xuống dưới - xem `QuestionOverlay`. */
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: 'rgba(95,230,255,0.35)',
    backgroundColor: '#04040E',
    overflow: 'hidden',
    boxShadow: '0 0 20px rgba(31,111,214,0.35)',
  },

  content: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerTag: {
    height: 28,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    borderWidth: 1.3,
    borderColor: 'rgba(95,230,255,0.55)',
    backgroundColor: 'rgba(8,26,34,0.9)',
    boxShadow: '0 0 12px rgba(95,230,255,0.28)',
    maxWidth: '42%',
  },
  bannerText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#5FE6FF' },
  rule: { flex: 1 },

  timerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.3,
    borderColor: 'rgba(200,107,255,0.55)',
    backgroundColor: 'rgba(52,18,96,0.85)',
    boxShadow: '0 0 12px rgba(200,107,255,0.3)',
  },
  timerTagUrgent: {
    borderColor: 'rgba(255,59,78,0.6)',
    backgroundColor: 'rgba(70,8,20,0.85)',
    boxShadow: '0 0 12px rgba(255,59,78,0.3)',
  },
  timerText: { fontSize: 13, fontWeight: '800' },

  skipBtn: {
    height: 28,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.4,
    borderColor: 'rgba(150,170,215,0.5)',
    backgroundColor: 'rgba(12,15,34,0.9)',
  },
  skipText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1, color: boardColors.dim },

  useBtn: {
    height: 28,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.4,
  },
  /* Hai style tách rời chứ không ghi đè `boxShadow` - xem `QuestionOverlay`. */
  useBtnOn: {
    borderColor: PICKED,
    backgroundColor: 'rgba(74,54,4,0.95)',
    boxShadow: '0 0 14px rgba(255,198,30,0.45)',
  },
  useBtnOff: {
    borderColor: 'rgba(150,170,215,0.35)',
    backgroundColor: 'rgba(18,20,40,0.85)',
  },
  useText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1, color: text.primary },
  useTextOff: { color: 'rgba(255,255,255,0.45)' },

  pressed: { transform: [{ scale: 0.96 }] },
  pressedSm: { transform: [{ scale: 0.985 }] },

  prompt: { fontSize: 12, color: boardColors.dim },

  row: { flex: 1, flexDirection: 'row', gap: 12, justifyContent: 'center' },
  card: {
    flex: 1,
    maxWidth: 220,
    borderRadius: 12,
    borderWidth: 1.6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  cardFill: { borderRadius: 12 },
  cardName: { fontSize: 13, fontWeight: '800', letterSpacing: 1.1, color: text.primary },
  cardBody: { fontSize: 11, lineHeight: 14.5, color: '#D6E2FF', textAlign: 'center' },
  cardCount: { fontSize: 11, fontWeight: '800', color: boardColors.dim },

  pickedPulse: {
    position: 'absolute',
    top: -1.6,
    left: -1.6,
    right: -1.6,
    bottom: -1.6,
    borderWidth: 1.8,
    borderColor: PICKED,
    boxShadow: '0 0 12px rgba(255,198,30,0.9), 0 0 24px rgba(255,198,30,0.4)',
  },
});
