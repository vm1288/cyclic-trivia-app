import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useT } from '../i18n/I18nProvider';
import { getGameConfig, playersForDuration, type GameConfig, type GamePlayer } from '../api/game';
import { text } from '../theme/colors';

/**
 * CÂY HỎI "PLAY AGAIN" của chủ phòng — chép đúng bản web.
 *
 * Bản web rải cây này qua bốn hàm trong `playerHandlers.js` (`PlayAgainContent`,
 * `AskDuration`, `KeepDuration`, `KeepPlayers`) và hai Vue component
 * (`SelectDurations`, `SelectPlayers`). Gom lại thành một máy trạng thái:
 *
 *   host        "Do you still want to host the next game?"
 *     ├─ YES ──► duration   "Same game duration / format?"
 *     │            ├─ Yes ──► players   "Same players as the last game?"
 *     │            │            ├─ Yes ──► GỬI 73 KeepDurationAndPlayers { GameDuration }
 *     │            │            └─ No  ──► pickPlayers (SelectPlayers) ──► GỬI 75 SetupNewGame
 *     │            └─ No  ──► pickDuration (SelectDurations) ──► players (như trên)
 *     └─ NO  ──► assignHost (SelectPlayers startWithHost) ──► GỬI 76 ChangePlayerAsHost
 *
 * ⚠️ Đổi thời lượng KHÔNG có gói riêng. `SelectDurations.confirmSelection()` chỉ
 * đặt `playerFunc.GameDuration` rồi gọi `KeepDuration()` - tức quay về câu "Same
 * players?", và gói 73 mang thời lượng MỚI. Server tự xử (`DurationMinutes !=
 * request.GameDuration`).
 *
 * ⚠️ Tôi từng gọi hai nhánh NO là "stub" vì thấy `onConfirm: console.log` ở chỗ
 * gọi component. Sai: `SelectPlayers` tự gửi 75/76 bên trong, `onConfirm` chỉ là
 * prop thừa. Tony chỉ ra 2026-09-11 - đọc COMPONENT, đừng đọc chỗ gọi nó.
 *
 * `startAt = 'duration'` là cho máy vừa nhận gói 76 (thành chủ phòng mới): bản
 * web (`handleChangePlayerAsHost`) vào thẳng câu thời lượng, bỏ câu "còn muốn
 * làm chủ?".
 */

export type PlayAgainAction =
  | { kind: 'keep'; duration: number }
  | {
      kind: 'setup';
      duration: number;
      numberOfPlayers: number;
      selectedPlayerIds: string[];
      /** Rỗng = chủ phòng cũ vẫn là chủ. */
      hostId: string;
    }
  | { kind: 'assignHost'; hostId: string };

type Step =
  | 'host'
  | 'assignHost'
  | 'duration'
  | 'pickDuration'
  | 'players'
  | 'pickPlayers'
  | 'lessConfirm'
  | 'pickHost';

export function PlayAgainWizard({
  players,
  meId,
  currentDuration,
  currentPlayers,
  startAt = 'host',
  onSend,
  onCancel,
}: {
  players: GamePlayer[];
  meId: string | null;
  /** Thời lượng ván vừa xong, phút. 0 = Leaderboard Challenge. */
  currentDuration: number;
  currentPlayers: number;
  startAt?: 'host' | 'duration';
  onSend: (action: PlayAgainAction) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [step, setStep] = useState<Step>(startAt);

  /* Thời lượng đang chọn - đổi ở pickDuration, mang theo tới gói 73 hoặc 75. */
  const [duration, setDuration] = useState(currentDuration);

  const [config, setConfig] = useState<GameConfig | null>(null);
  const [configFailed, setConfigFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void getGameConfig().then((res) => {
      if (!alive) return;
      if (res.isSuccess) setConfig(res.data);
      else setConfigFailed(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const durationId = useMemo(
    () => config?.Durations.find((d) => d.Duration === duration)?.Id ?? null,
    [config, duration],
  );
  const playerOptions = useMemo(
    () => (config ? playersForDuration(config, durationId) : []),
    [config, durationId],
  );

  /* ---- pickPlayers: số người + ai giữ ghế ---- */
  const [numberOfPlayers, setNumberOfPlayers] = useState(currentPlayers);
  const hostId = players.find((p) => p.IsHost)?.Id ?? '';
  /* Bản web: chủ phòng được tick sẵn (`mounted()` của SelectPlayers). */
  const [selected, setSelected] = useState<string[]>(hostId ? [hostId] : []);
  const [newHost, setNewHost] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /* Đổi thời lượng thì trần số người có thể đổi - kéo lựa chọn về hợp lệ. */
    if (playerOptions.length && !playerOptions.some((o) => o.NumberOfPlayers === numberOfPlayers)) {
      setNumberOfPlayers(playerOptions[playerOptions.length - 1].NumberOfPlayers);
    }
  }, [playerOptions, numberOfPlayers]);

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  /*
   * `confirmSelection()` của SelectPlayers, đúng thứ tự kiểm:
   *   không ai      -> "Please tapped more players than one"
   *   nhiều hơn số  -> "Mmm… you've tapped more players…"
   *   ít hơn số     -> hỏi lại "You advised N players but just M… Is that right?"
   *   đủ            -> chủ phòng có trong danh sách? có -> gửi; không -> chọn chủ mới
   */
  const confirmPlayers = () => {
    setError(null);
    if (selected.length <= 0) return setError(t('again.none'));
    if (selected.length > numberOfPlayers) return setError(t('again.tooMany'));
    if (selected.length < numberOfPlayers) return setStep('lessConfirm');
    afterCount();
  };
  const afterCount = () => {
    if (hostId && selected.includes(hostId)) {
      onSend({ kind: 'setup', duration, numberOfPlayers, selectedPlayerIds: selected, hostId: '' });
    } else {
      setStep('pickHost');
    }
  };

  const others = players.filter((p) => p.Id !== hostId);

  const Choice = ({
    label,
    onPress,
    tone = 'one',
  }: {
    label: string;
    onPress: () => void;
    tone?: 'one' | 'two';
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.choice, tone === 'two' && styles.choiceTwo, pressed && styles.pressed]}
    >
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );

  const Pill = ({ label, active, onPress, disabled }: { label: string; active: boolean; onPress: () => void; disabled?: boolean }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      style={({ pressed }) => [styles.pill, active && styles.pillActive, disabled && styles.pillOff, pressed && styles.pressed]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );

  const needsConfig = step === 'pickDuration' || step === 'pickPlayers';
  if (needsConfig && !config) {
    return (
      <View style={styles.box}>
        {configFailed ? <Text style={styles.body}>{t('error.network')}</Text> : <ActivityIndicator color="#C7D2FE" />}
        <Choice label={t('again.back')} tone="two" onPress={() => setStep(step === 'pickDuration' ? 'duration' : 'players')} />
      </View>
    );
  }

  switch (step) {
    case 'host':
      return (
        <View style={styles.box}>
          <Text style={styles.q}>{t('again.hostQ')}</Text>
          <Text style={styles.hint}>{t('again.hostHint')}</Text>
          <Choice label={t('again.hostYes')} onPress={() => setStep('duration')} />
          <Choice label={t('again.hostNo')} tone="two" onPress={() => setStep('assignHost')} />
          <Pressable onPress={onCancel} accessibilityRole="button" style={styles.cancel}>
            <Text style={styles.cancelText}>{t('again.cancel')}</Text>
          </Pressable>
        </View>
      );

    case 'assignHost':
      return (
        <View style={styles.box}>
          <Text style={styles.q}>{t('again.assignTitle')}</Text>
          <View style={styles.wrapRow}>
            {others.map((p) => (
              <Pill key={p.Id} label={p.NickName} active={newHost === p.Id} onPress={() => setNewHost(p.Id)} />
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <Choice label={t('again.back')} tone="two" onPress={() => setStep('host')} />
            <Choice
              label={t('again.assign')}
              onPress={() => {
                /* Bản web: `alert("Please choose one")`. */
                if (!newHost) return setError(t('again.chooseOne'));
                onSend({ kind: 'assignHost', hostId: newHost });
              }}
            />
          </View>
        </View>
      );

    case 'duration':
      return (
        <View style={styles.box}>
          <Text style={styles.q}>{t('again.durationQ')}</Text>
          <Choice label={t('again.durationYes')} onPress={() => setStep('players')} />
          <Choice label={t('again.durationNo')} tone="two" onPress={() => setStep('pickDuration')} />
        </View>
      );

    case 'pickDuration':
      return (
        <View style={styles.box}>
          <Text style={styles.q}>{t('again.pickDuration')}</Text>
          <View style={styles.wrapRow}>
            {config!.Durations.map((d) => (
              <Pill key={d.Id} label={d.Time} active={d.Duration === duration} onPress={() => setDuration(d.Duration)} />
            ))}
          </View>
          <View style={styles.row}>
            <Choice label={t('again.back')} tone="two" onPress={() => setStep('duration')} />
            {/* `SelectDurations.confirmSelection()`: đặt thời lượng rồi về câu "Same players?" */}
            <Choice label={t('again.continue')} onPress={() => setStep('players')} />
          </View>
        </View>
      );

    case 'players':
      return (
        <View style={styles.box}>
          <Text style={styles.q}>{t('again.playersQ')}</Text>
          <Choice label={t('again.playersYes')} onPress={() => onSend({ kind: 'keep', duration })} />
          <Choice label={t('again.playersNo')} tone="two" onPress={() => setStep('pickPlayers')} />
        </View>
      );

    case 'pickPlayers':
      return (
        <View style={styles.box}>
          <Text style={styles.q}>{t('again.pickCount')}</Text>
          <View style={styles.wrapRow}>
            {playerOptions.map((o) => (
              <Pill
                key={o.Id}
                label={String(o.NumberOfPlayers)}
                active={o.NumberOfPlayers === numberOfPlayers}
                onPress={() => setNumberOfPlayers(o.NumberOfPlayers)}
              />
            ))}
          </View>
          <Text style={styles.q}>{t('again.pickWho')}</Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.wrapRow}>
            {players.map((p) => (
              <Pill
                key={p.Id}
                label={p.NickName + (p.IsHost ? ' ★' : '')}
                active={selected.includes(p.Id)}
                onPress={() => toggle(p.Id)}
              />
            ))}
          </ScrollView>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <Choice label={t('again.back')} tone="two" onPress={() => setStep('players')} />
            <Choice label={t('again.continue')} onPress={confirmPlayers} />
          </View>
        </View>
      );

    case 'lessConfirm':
      return (
        <View style={styles.box}>
          <Text style={styles.q}>
            {t('again.less', { count: String(numberOfPlayers), selected: String(selected.length) })}
          </Text>
          <Text style={styles.hint}>{t('again.lessHint')}</Text>
          <View style={styles.row}>
            <Choice label={t('again.back')} tone="two" onPress={() => setStep('pickPlayers')} />
            <Choice label={t('again.lessYes')} onPress={afterCount} />
          </View>
        </View>
      );

    case 'pickHost':
      return (
        <View style={styles.box}>
          <Text style={styles.q}>{t('again.optedOut')}</Text>
          <Text style={styles.hint}>{t('again.optedOutHint')}</Text>
          <View style={styles.wrapRow}>
            {players
              .filter((p) => selected.includes(p.Id))
              .map((p) => (
                <Pill key={p.Id} label={p.NickName} active={newHost === p.Id} onPress={() => setNewHost(p.Id)} />
              ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <Choice label={t('again.back')} tone="two" onPress={() => setStep('pickPlayers')} />
            <Choice
              label={t('again.continue')}
              onPress={() => {
                if (!newHost) return setError(t('again.chooseOne'));
                onSend({ kind: 'setup', duration, numberOfPlayers, selectedPlayerIds: selected, hostId: newHost });
              }}
            />
          </View>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  box: { gap: 8, alignItems: 'center', width: '100%' },
  q: { fontSize: 15, fontWeight: '900', textAlign: 'center', color: text.primary },
  hint: { fontSize: 12, lineHeight: 16, textAlign: 'center', color: 'rgba(226,232,255,0.7)' },
  body: { fontSize: 13, textAlign: 'center', color: text.primary },
  error: { fontSize: 12, textAlign: 'center', color: '#FCA5A5' },
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  list: { maxHeight: 96, width: '100%' },
  choice: {
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(22,163,74,0.9)',
  },
  choiceTwo: { backgroundColor: 'rgba(79,70,229,0.9)' },
  choiceText: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.4 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.4,
    borderColor: 'rgba(148,163,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pillActive: { borderColor: '#FDE68A', backgroundColor: 'rgba(253,230,138,0.16)' },
  pillOff: { opacity: 0.35 },
  pillText: { fontSize: 13, fontWeight: '700', color: text.primary },
  pillTextActive: { color: '#FDE68A' },
  pressed: { opacity: 0.7 },
  cancel: { paddingVertical: 4 },
  cancelText: { fontSize: 12, color: 'rgba(226,232,255,0.55)', textDecorationLine: 'underline' },
});
