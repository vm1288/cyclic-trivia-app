import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { assetUrl } from '../src/api/game';
import { getMe, getProfileGames, type ProfileGameStats } from '../src/api/profile';
import { useConfirm } from '../src/components/ConfirmDialog';
import { lobbyColors } from '../src/components/LobbyParts';
import { MyGamesSheet } from '../src/components/MyGamesSheet';
import { NeonField } from '../src/components/NeonField';
import { NeonSheet, SheetButton } from '../src/components/NeonSheet';
import { Avatar, ScreenShell, profileErrorKey, profileStyles } from '../src/components/ProfileParts';
import { useT } from '../src/i18n/I18nProvider';
import { useLicense } from '../src/session/LicenseSession';
import { useProfile } from '../src/session/ProfileSession';
import { neon, text } from '../src/theme/colors';

/**
 * Profile (mockup V6 slide 5, Tony 2/10). Cột trái: ảnh đại diện (chọn trong 12 nhân vật CricTriv),
 * nickname (bút sửa - không trùng ai), Account, Subscriptions (= bảng My Games cũ). Cột phải: các game
 * đã chơi - Played / Won mọi thể thức, hạng + điểm nếu đã chơi ván Leaderboard, nút NEW MATCH.
 */
export default function ProfileScreen() {
  const t = useT();
  const router = useRouter();
  const confirm = useConfirm();
  const profile = useProfile();
  const license = useLicense();
  const [games, setGames] = useState<ProfileGameStats[] | null>(null);
  const [avatars, setAvatars] = useState<{ id: string; url: string }[]>([]);
  const [pickAvatar, setPickAvatar] = useState(false);
  const [editName, setEditName] = useState(false);
  const [draft, setDraft] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [subs, setSubs] = useState(false);

  const owned = license.all.filter((g) => g.activated);
  const activated = license.status === 'active';

  useFocusEffect(
    useCallback(() => {
      if (!profile.token) return;
      void getProfileGames(profile.token).then((r) => setGames(r.ok ? r.games : []));
      void getMe(profile.token).then((r) => r.ok && setAvatars(r.avatars));
    }, [profile.token]),
  );

  const newMatch = async (hostId: string) => {
    if (!activated || license.session.hostId !== hostId) await license.switchTo(hostId);
    license.setCurrentGame(null);
    router.push('/new-game');
  };

  /* NEW MATCH của một game: máy có licence game đó thì mở ván; chưa có thì sang EXPLORE GAMES. */
  const newMatchFor = (g: ProfileGameStats) => {
    const s = owned.find((x) => x.sponsorId === g.sponsorId || (!x.sponsorId && x.sponsorName === g.name));
    if (s) void newMatch(s.hostId);
    else router.push('/purchase');
  };

  const cancelSubscription = async () => {
    const store = t(Platform.OS === 'ios' ? 'purchase.storeApple' : 'purchase.storeGoogle');
    const ok = await confirm({
      title: t('games.cancelTitle'),
      message: t('games.cancelBody', { store }),
      cancelLabel: t('common.cancel').toUpperCase(),
      confirmLabel: t('games.cancelOpen').toUpperCase(),
    });
    if (!ok) return;
    const url = Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions';
    void Linking.openURL(url).catch(() => {});
  };

  const saveName = async () => {
    setSaving(true);
    const err = await profile.setNickName(draft);
    setSaving(false);
    if (err) setNameError(t(profileErrorKey(err), { min: 3, max: 12 }));
    else setEditName(false);
  };

  const p = profile.profile;

  return (
    <ScreenShell title={t('profile.title')}>
      <View style={styles.cols}>
        <View style={styles.left}>
          <Pressable onPress={() => setPickAvatar(true)} accessibilityRole="button" accessibilityLabel={t('profile.changeAvatar')}>
            <Avatar url={p?.avatarUrl} size={88} />
            <View style={styles.plus}>
              <Ionicons name="add" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
          <Pressable
            style={styles.nameRow}
            onPress={() => {
              setDraft(p?.nickName ?? '');
              setNameError(null);
              setEditName(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('profile.editName')}
          >
            <Text style={styles.name} numberOfLines={1}>{p?.nickName ?? '…'}</Text>
            <View style={styles.pencil}>
              <Ionicons name="pencil" size={13} color="#FFFFFF" />
            </View>
          </Pressable>

          <Pressable style={styles.link} onPress={() => router.push('/account')} accessibilityRole="button">
            <Text style={styles.linkText}>{t('profile.account')}</Text>
            <Ionicons name="chevron-forward" size={18} color={lobbyColors.dim} />
          </Pressable>
          <Pressable
            style={styles.link}
            onPress={() => (owned.length === 0 ? router.push('/purchase') : setSubs(true))}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>{t('profile.subscriptions')}</Text>
            <Ionicons name="chevron-forward" size={18} color={lobbyColors.dim} />
          </Pressable>
        </View>

        <View style={styles.right}>
          <Text style={styles.myGames}>{t('profile.myGames')}</Text>
          <ScrollView style={[profileStyles.card, styles.gamesCard]} contentContainerStyle={styles.gamesInner}>
            {games === null ? null : games.length === 0 ? (
              <Text style={styles.empty}>{t('profile.noGames')}</Text>
            ) : (
              games.map((g, i) => (
                <View key={g.sponsorId} style={[styles.game, i > 0 && styles.gameSep]}>
                  {g.logoUrl ? <Image source={{ uri: assetUrl(g.logoUrl) }} style={styles.logo} resizeMode="contain" /> : <View style={styles.logo} />}
                  <View style={styles.gameText}>
                    <Text style={styles.gameName}>{g.name}</Text>
                    <Text style={styles.stat}>{t('profile.playedWon', { played: g.played, won: g.won })}</Text>
                    {g.rank !== null && g.score !== null ? (
                      <View style={styles.rankRow}>
                        <Text style={styles.stat}>{t('profile.ranked', { rank: g.rank })}</Text>
                        <View style={styles.points}>
                          <Text style={styles.pointsText}>{g.score}</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                  <Pressable onPress={() => newMatchFor(g)} accessibilityRole="button" style={({ pressed }) => [styles.newMatch, pressed && styles.pressed]}>
                    <Text style={styles.newMatchText}>{t('games.newMatch')}</Text>
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>

      <NeonSheet visible={pickAvatar} onClose={() => setPickAvatar(false)} closeButton maxWidth={560}>
        <Text style={styles.sheetTitle}>{t('profile.pickAvatar')}</Text>
        <View style={styles.avatarGrid}>
          {avatars.map((a) => {
            const on = a.id === p?.avatarId;
            return (
              <Pressable
                key={a.id}
                onPress={async () => {
                  setPickAvatar(false);
                  if (!on) await profile.setAvatar(a.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Avatar url={a.url} size={64} style={on ? styles.avatarOn : undefined} />
              </Pressable>
            );
          })}
        </View>
      </NeonSheet>

      <NeonSheet visible={editName} onClose={() => setEditName(false)} closeButton maxWidth={460}>
        <Text style={styles.sheetTitle}>{t('profile.editName')}</Text>
        <View style={styles.field}>
          <NeonField
            label={t('profile.nickname')}
            color={neon.blue}
            value={draft}
            onChangeText={(v) => {
              setDraft(v);
              if (nameError) setNameError(null);
            }}
            error={nameError}
            maxLength={12}
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={() => void saveName()}
          />
          <Text style={styles.hint}>{t('profile.nameRule')}</Text>
        </View>
        <SheetButton label={t('profile.save')} onPress={() => void saveName()} busy={saving} disabled={saving || draft.trim().length === 0} />
      </NeonSheet>

      <MyGamesSheet
        visible={subs}
        mode="manage"
        sessions={owned}
        activeHostId={activated ? license.session.hostId : null}
        onClose={() => setSubs(false)}
        onNewMatch={async (hostId) => {
          setSubs(false);
          await newMatch(hostId);
        }}
        onCancelSubscription={() => {
          setSubs(false);
          void cancelSubscription();
        }}
        onBuyAnother={() => {
          setSubs(false);
          router.push('/purchase');
        }}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  cols: { flex: 1, flexDirection: 'row', gap: 22 },
  left: { width: 230, alignItems: 'center', paddingTop: 4 },
  plus: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B6CE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 14 },
  name: { color: text.primary, fontSize: 20, fontWeight: '800', maxWidth: 180 },
  pencil: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1FB6F0', alignItems: 'center', justifyContent: 'center' },
  link: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 6 },
  linkText: { color: text.primary, fontSize: 18, fontWeight: '600' },
  right: { flex: 1 },
  myGames: { color: text.primary, fontSize: 18, fontWeight: '700', marginBottom: 8, marginLeft: 4 },
  gamesCard: { flex: 1 },
  gamesInner: { padding: 12 },
  game: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  gameSep: { borderTopWidth: 1, borderTopColor: 'rgba(190,205,255,0.18)' },
  logo: { width: 60, height: 60 },
  gameText: { flex: 1, gap: 3 },
  gameName: { color: text.primary, fontSize: 18, fontWeight: '800' },
  stat: { color: text.primary, fontSize: 14.5 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  points: { backgroundColor: lobbyColors.amber, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 1 },
  pointsText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  newMatch: { borderWidth: 1.5, borderColor: lobbyColors.amber, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  newMatchText: { color: text.primary, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.75 },
  empty: { color: lobbyColors.dim, fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  sheetTitle: { color: text.primary, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  avatarOn: { borderColor: '#FFFFFF', borderWidth: 3 },
  field: { alignSelf: 'stretch', gap: 6 },
  hint: { color: lobbyColors.dim, fontSize: 12.5 },
});
