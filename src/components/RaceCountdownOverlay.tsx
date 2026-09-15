import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useT } from '../i18n/I18nProvider';
import { fill } from './GameBoardParts';
import { lobbyColors } from './LobbyParts';

/**
 * "WHO GOES FIRST?" đếm ngược - hiện GIỮA BÀN CỜ từ lúc chủ phòng bấm START tới
 * lúc câu vòng đua tới (K93, Tony 2026-09-14: "đếm ngược phải đồng bộ mọi máy").
 *
 * Bản web: bàn cờ hiện đúng tấm này (`PlayersReady.cshtml`, `beginCountdown` 10 giây)
 * rồi gửi `QuestionForTurn`; điện thoại chỉ đứng ở trang "get ready". App là
 * "mỗi điện thoại một bàn cờ" nên tấm này hiện ở mọi máy.
 *
 * ⚠️ KHÔNG tự đếm 10 giây từ lúc nhận gói. Đếm tới `endsAt` do SERVER ghi
 * (`Timer.RaceCountdownEndsAt`), trừ theo `serverNow` như `GameClock` (K87) -
 * mọi máy về 0 cùng một giây server, và server (watchdog Hangfire, poll 1 s) nổ
 * vòng đua trong ~1,5 giây sau mốc. Về 0 rồi mà câu chưa tới thì đứng ở "get
 * ready" với vòng xoay - đừng đếm âm, đừng tự làm gì: gói 67 sẽ tới.
 */
export function RaceCountdownOverlay({
  endsAt,
  serverNow,
  fetchedAt,
}: {
  /** ISO, giờ server. */
  endsAt: string;
  /** ISO, giờ server lúc trả state - `Timer.ServerNow`. */
  serverNow: string;
  /** `Date.now()` lúc nhận state - để cộng phần đã trôi qua từ đó. */
  fetchedAt: number;
}) {
  const t = useT();
  const [, tick] = useState(0);
  useEffect(() => {
    /* 250 ms để con số đổi đúng giây server, không trễ tới gần một giây như nhịp 1000. */
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  const now = Date.parse(serverNow) + (Date.now() - fetchedAt);
  const left = Math.ceil((Date.parse(endsAt) - now) / 1000);
  const counting = left > 0;

  return (
    <View style={styles.root} pointerEvents="none">
      <LinearGradient colors={['rgba(4,6,26,0.94)', 'rgba(10,12,40,0.94)']} style={fill} />
      <Text style={styles.title}>{t('lobby.whoGoesFirst')}</Text>
      <Text style={styles.body}>{t('lobby.whoGoesFirstBody')}</Text>
      {counting ? (
        <Text style={styles.count}>{t('lobby.startingIn', { seconds: String(left) })}</Text>
      ) : (
        <View style={styles.spinner}>
          <ActivityIndicator color={lobbyColors.amber} size="large" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /* Phủ kín cột bàn cờ, nền gần đặc: lúc này nhìn đồng hồ, không nhìn bàn cờ. */
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    fontStyle: 'italic',
    color: '#F2F6FF',
    textShadowColor: 'rgba(140,200,255,0.6)',
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    color: lobbyColors.dim,
    textAlign: 'center',
  },
  count: {
    fontSize: 44,
    fontWeight: '800',
    color: lobbyColors.amber,
    textShadowColor: 'rgba(255,198,30,0.55)',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  spinner: { marginTop: 4 },
});
