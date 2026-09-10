import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../i18n/I18nProvider';
import { fill } from './GameBoardParts';
import { GlowDivider } from './GlowDivider';

/**
 * BATTLE - lời dẫn trước trận, phủ vùng bàn cờ.
 *
 * Chữ chép từ `Views/Public/Html/PlayerBattleInstruction.cshtml` (bản dẫn trên
 * bàn cờ) và `PlayerBattleStartPartialHtml.cshtml` (khung có nút START trên máy
 * người bị thách).
 *
 * ⚠️ HAI VAI, MỘT GÓI. Server gửi cùng gói 55 cho cả hai bên; phân vai bằng
 * `IncumbentId`/`ChallengerId`. **Chỉ incumbent có nút START** - đó là bản web,
 * và cũng là điều `WaitStartBattle` đang đợi.
 *
 * ⚠️ NÚT NÀY LÀ MẮT XÍCH TREO VÁN. Không bấm (hoặc app không dựng khung này)
 * thì server nhắc lại một lần bằng gói 27 rồi thôi - xem GAME_RULES mục 7b.
 * Từ 2026-09-10 server có thêm fallback tự chạy sau 20 giây nữa, nhưng đừng
 * dựa vào nó: fallback chạy nghĩa là người chơi mất quyền bấm.
 *
 * ⚠️ Điểm cược CHỈ chuyển ở ván không tính leaderboard. `isLeaderBoard` bật thì
 * hai bên chỉ tranh ô và tranh lượt, không ai mất điểm - phải đổi hẳn câu chữ,
 * đừng hiện số điểm cho vui.
 */
export function BattleOverlay({
  challengerName,
  incumbentName,
  challengerPoint,
  incumbentPoint,
  isLeaderBoard,
  amIncumbent,
  unit,
  oneUnit,
  onStart,
}: {
  challengerName: string;
  incumbentName: string;
  /** Điểm người đi thách sẽ mất nếu thua. */
  challengerPoint: number;
  /** Điểm người đang đứng ở ô sẽ mất nếu thua. */
  incumbentPoint: number;
  isLeaderBoard: boolean;
  /** Máy này có phải người BỊ thách không - chỉ vai đó mới có nút START. */
  amIncumbent: boolean;
  /** "runs" / "goals" / "points" - theo bàn cờ, xem `handlePlayerBattleStart`. */
  unit: string;
  oneUnit: string;
  onStart: () => void;
}) {
  const t = useT();

  /*
   * Bấm một lần là khoá. Bản web đặt `isSubmitting` rồi mới `invoke` - hai cú
   * bấm liền tay là hai gói 56, mà gói thứ hai chạy `PlayerBattleStartHandler`
   * lần nữa và phát cho mỗi bên một câu hỏi KHÁC nhau.
   */
  const [sent, setSent] = useState(false);

  const press = () => {
    if (sent) return;
    setSent(true);
    onStart();
  };

  const u = (n: number) => (n <= 1 ? oneUnit : unit);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(60,10,16,0.97)', 'rgba(6,8,26,0.97)']}
        style={fill}
      />

      <View style={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.bannerTag}>
            <Text style={styles.bannerText} numberOfLines={1}>
              {t('battle.title')}
            </Text>
          </View>
          <GlowDivider color="#F43F5E" accent="#FFC61E" height={1.5} flareWidth={70} style={styles.rule} />
        </View>

        <Text style={styles.headline} numberOfLines={2}>
          {amIncumbent
            ? t('battle.challengedYou', { name: challengerName })
            : t('battle.youChallenge', { name: incumbentName })}
        </Text>

        <Text style={styles.body}>{t('battle.rules')}</Text>

        {isLeaderBoard ? (
          <>
            <Text style={styles.body}>{t('battle.leaderWin')}</Text>
            <Text style={styles.body}>{t('battle.leaderLose')}</Text>
          </>
        ) : (
          <>
            <Text style={styles.body}>
              {t('battle.win', {
                points: String(amIncumbent ? challengerPoint : incumbentPoint),
                unit: u(amIncumbent ? challengerPoint : incumbentPoint),
              })}
            </Text>
            <Text style={styles.body}>
              {t('battle.lose', {
                points: String(amIncumbent ? incumbentPoint : challengerPoint),
                unit: u(amIncumbent ? incumbentPoint : challengerPoint),
              })}
            </Text>
          </>
        )}

        {amIncumbent ? (
          <Pressable
            onPress={press}
            disabled={sent}
            style={({ pressed }) => [styles.start, sent && styles.startSent, pressed && styles.pressed]}
          >
            <Text style={styles.startText}>{sent ? t('battle.starting') : t('battle.start')}</Text>
          </Pressable>
        ) : (
          <Text style={styles.waiting} numberOfLines={2}>
            {t('battle.waiting', { name: incumbentName })}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Phủ kín vùng bàn cờ và CHẶN chạm xuống dưới - cùng khuôn `YourChoiceOverlay`. */
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 12,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: 'rgba(244,63,94,0.45)',
    backgroundColor: '#04040E',
    overflow: 'hidden',
    boxShadow: '0 0 20px rgba(244,63,94,0.3)',
  },

  content: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    justifyContent: 'center',
  },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerTag: {
    height: 28,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    borderWidth: 1.3,
    borderColor: 'rgba(244,63,94,0.65)',
    backgroundColor: 'rgba(48,6,16,0.9)',
    boxShadow: '0 0 12px rgba(244,63,94,0.3)',
  },
  bannerText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#FB7185' },
  rule: { flex: 1 },

  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: '#FFC61E',
    textAlign: 'center',
    marginTop: 2,
  },
  body: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(226,232,255,0.86)',
    textAlign: 'center',
  },

  start: {
    alignSelf: 'center',
    marginTop: 6,
    minWidth: 160,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.6,
    borderColor: '#FFC61E',
    backgroundColor: 'rgba(84,60,4,0.85)',
    boxShadow: '0 0 16px rgba(255,198,30,0.5)',
  },
  startSent: { opacity: 0.45 },
  startText: { fontSize: 14, fontWeight: '900', letterSpacing: 1.2, color: '#FFC61E' },

  waiting: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#FB7185',
    textAlign: 'center',
  },

  pressed: { opacity: 0.85 },
});
