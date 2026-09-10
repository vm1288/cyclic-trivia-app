import { useEffect, useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '../i18n/I18nProvider';
import { characterImageUrl, type GamePlayer } from '../api/game';
import { text } from '../theme/colors';

/**
 * MÀN KẾT THÚC VÁN — bảng xếp hạng cuối cùng.
 *
 * ⚠️ Trước bản này app KHÔNG HIỆN GÌ khi ván kết thúc. Server gửi gói `GameOver`
 * (39) cho **mọi** người chơi, `useGameState` nhận và nạp lại trạng thái... rồi
 * thôi: màn hình đứng nguyên ở bàn cờ, người chơi không biết ván đã xong. Đây là
 * chỗ hở duy nhất người chơi thật gặp **mỗi ván** (TEST_CASES ca **UI-7**).
 *
 * Phía server đã xong phần của nó từ lâu — đo được `van ket thuc dung han` ở
 * TEST_CASES mục **K42**.
 *
 * ⚠️ **Xếp theo `Point`, không theo `Rank`.** Server chỉ tính `Rank` ở một vài
 * đường (nhánh `TotalRollDice == 0` trong battle chẳng hạn), nên tin vào nó là
 * có ván hiện sai thứ tự. `Point` thì luôn đúng.
 *
 * ⚠️ Khung này CHẶN hết tương tác bên dưới, có chủ đích: ván đã xong thì mọi nút
 * trên bàn cờ đều vô nghĩa. Cùng lý do với khung "ghế bị mở ở máy khác".
 */
export function GameOverOverlay({
  players,
  meId,
  message,
  onLeave,
}: {
  players: GamePlayer[];
  meId: string | null;
  /** `GameOverMessage` server bốc ngẫu nhiên. Rỗng thì dùng câu mặc định. */
  message?: string | null;
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

  /*
   * Hoà điểm thì xếp theo `Ordering` cho ổn định - không có tiêu chí nào tốt hơn,
   * và quan trọng là MỌI MÁY phải ra cùng một thứ tự. Sắp xếp không ổn định thì
   * hai điện thoại cạnh nhau hiện hai bảng khác nhau, trông như lỗi.
   */
  const ranked = useMemo(
    () => [...players].sort((a, b) => b.Point - a.Point || a.Ordering - b.Ordering),
    [players],
  );

  const topPoint = ranked.length > 0 ? ranked[0].Point : 0;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.card, card]}>
        <LinearGradient
          colors={['rgba(24,20,60,0.98)', 'rgba(8,8,24,0.99)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <Text style={styles.title}>{t('gameOver.title')}</Text>
        <Text style={styles.message}>{message || t('gameOver.defaultMessage')}</Text>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listInner}
          showsVerticalScrollIndicator={false}
        >
          {ranked.map((p, i) => {
            const isMe = p.Id === meId;
            /*
             * Cùng điểm với người đứng đầu thì cùng là người thắng - kể cả khi
             * bảng phải xếp một người xuống dưới. Hoà mà chỉ vinh danh một người
             * là sai luật.
             */
            const isWinner = ranked.length > 0 && p.Point === topPoint;

            return (
              <View
                key={p.Id}
                style={[styles.row, isMe && styles.rowMe, isWinner && styles.rowWinner]}
              >
                <Text style={[styles.place, isWinner && styles.placeWinner]}>
                  {isWinner ? '★' : String(i + 1)}
                </Text>

                <Image
                  source={{ uri: characterImageUrl(p.CharacterId) }}
                  style={[styles.avatar, { borderColor: p.PlayerColor || 'rgba(255,255,255,0.25)' }]}
                  resizeMode="contain"
                />

                <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
                  {p.NickName}
                  {isMe ? t('gameOver.youSuffix') : ''}
                </Text>

                <Text style={[styles.point, isWinner && styles.pointWinner]}>{p.Point}</Text>
              </View>
            );
          })}
        </ScrollView>

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
  list: { flexGrow: 0 },
  listInner: { gap: 6, paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowMe: { borderColor: 'rgba(148,163,255,0.55)' },
  rowWinner: { backgroundColor: 'rgba(253,230,138,0.12)' },
  place: {
    width: 22,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(226,232,255,0.6)',
  },
  placeWinner: { color: '#FDE68A', fontSize: 17 },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.6 },
  name: { flex: 1, fontSize: 14.5, fontWeight: '700', color: text.primary },
  nameMe: { color: '#C7D2FE' },
  point: { fontSize: 17, fontWeight: '900', color: text.primary, minWidth: 40, textAlign: 'right' },
  pointWinner: { color: '#FDE68A' },
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
