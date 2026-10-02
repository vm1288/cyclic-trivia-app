import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { getLeaderboard, getLeaderboardGames, type LeaderboardEntry, type LeaderboardGame } from '../src/api/profile';
import { lobbyColors } from '../src/components/LobbyParts';
import { Avatar, ScreenShell, profileStyles } from '../src/components/ProfileParts';
import { useT } from '../src/i18n/I18nProvider';
import { useProfile } from '../src/session/ProfileSession';
import { text } from '../src/theme/colors';

/**
 * Leaderboards (mockup V6 slide 10, Tony 2/10): xem bảng xếp hạng LÚC NÀO CŨNG ĐƯỢC, không chỉ
 * cuối ván Leaderboard. Mỗi game một tab; "Your Ranking" (hoặc Unranked) + Top 100 (Tony chốt 100).
 * Điểm = ván Leaderboard điểm cao nhất của mỗi người (server `ProfileService.GetLeaderboardAsync`).
 */
export default function LeaderboardsScreen() {
  const t = useT();
  const profile = useProfile();
  const [games, setGames] = useState<LeaderboardGame[]>([]);
  const [tab, setTab] = useState<string | null>(null);
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [me, setMe] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await getLeaderboardGames();
      if (!r.ok) {
        setFailed(true);
        setLoading(false);
        return;
      }
      /* CricTriv ra trước (Tony 23/9) → tab đầu, còn lại theo tên. */
      const sorted = [...r.games].sort((a, b) =>
        a.name === 'CricTriv' ? -1 : b.name === 'CricTriv' ? 1 : a.name.localeCompare(b.name),
      );
      setGames(sorted);
      setTab(sorted[0]?.sponsorId ?? null);
    })();
  }, []);

  const load = useCallback(async (sponsorId: string) => {
    setLoading(true);
    setFailed(false);
    const r = await getLeaderboard(sponsorId, profile.token);
    setLoading(false);
    if (!r.ok) {
      setFailed(true);
      return;
    }
    setRows(r.top);
    setMe(r.me);
  }, [profile.token]);

  useEffect(() => {
    if (tab) void load(tab);
  }, [tab, load]);

  const mine = me ?? (profile.profile ? { rank: null, nickName: profile.profile.nickName, avatarUrl: profile.profile.avatarUrl, score: null, isMe: true } : null);

  return (
    <ScreenShell title={t('lb.title')}>
      <View style={styles.tabs}>
        {games.map((g) => {
          const on = g.sponsorId === tab;
          return (
            <Pressable key={g.sponsorId} onPress={() => setTab(g.sponsorId)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={styles.tab}>
              <Text style={[styles.tabText, on && styles.tabOn]}>{g.name}</Text>
              {on ? <View style={styles.tabLine} /> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={profileStyles.sectionBar}>
        <Text style={profileStyles.sectionText}>{t('lb.yourRanking')}</Text>
      </View>
      {mine ? <Row entry={mine} unranked={t('lb.unranked')} /> : <View style={styles.rowGap} />}

      <View style={profileStyles.sectionBar}>
        <Text style={profileStyles.sectionText}>{t('lb.top', { n: 100 })}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={lobbyColors.cyan} style={styles.spinner} />
      ) : failed ? (
        <Text style={styles.empty}>{t('lb.loadFailed')}</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>{t('lb.empty')}</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => `${r.rank}-${r.nickName}-${i}`}
          renderItem={({ item }) => <Row entry={item} unranked={t('lb.unranked')} />}
          style={styles.list}
        />
      )}
    </ScreenShell>
  );
}

function Row({ entry, unranked }: { entry: LeaderboardEntry; unranked: string }) {
  const top = entry.rank !== null && entry.rank <= 3;
  return (
    <View style={[styles.row, entry.isMe && styles.rowMe]}>
      <Text style={[styles.rank, entry.rank === null && styles.unranked]} numberOfLines={1}>
        {entry.rank === null ? unranked : `#${entry.rank}`}
      </Text>
      <Avatar url={entry.avatarUrl} size={38} />
      <Text style={styles.name} numberOfLines={1}>{entry.nickName}</Text>
      {entry.score !== null ? (
        <View style={[styles.score, top ? styles.scoreTop : entry.isMe ? styles.scoreMe : null]}>
          <Text style={styles.scoreText}>{entry.score}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 26, paddingHorizontal: 8, marginBottom: 10 },
  tab: { paddingVertical: 4 },
  tabText: { color: text.primary, fontSize: 17, fontWeight: '800' },
  tabOn: { color: lobbyColors.amber },
  tabLine: { height: 2, backgroundColor: lobbyColors.amber, marginTop: 4, borderRadius: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 7 },
  rowMe: { backgroundColor: 'rgba(63,224,255,0.08)', borderRadius: 10 },
  rowGap: { height: 8 },
  rank: { width: 92, color: text.primary, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  unranked: { fontSize: 15, fontWeight: '600', color: lobbyColors.dim },
  name: { flex: 1, color: text.primary, fontSize: 17, fontWeight: '700' },
  score: { minWidth: 76, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(160,160,170,0.55)', alignItems: 'center' },
  scoreTop: { backgroundColor: '#D9620F' },
  scoreMe: { backgroundColor: 'rgba(160,160,170,0.75)' },
  scoreText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  list: { flex: 1 },
  spinner: { marginTop: 24 },
  empty: { color: lobbyColors.dim, fontSize: 14, textAlign: 'center', marginTop: 24 },
});
