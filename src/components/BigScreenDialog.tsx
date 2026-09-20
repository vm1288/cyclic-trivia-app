import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { NeonSheet, SheetButton } from './NeonSheet';
import { useT } from '../i18n/I18nProvider';
import { tvAvailable, useTvScreen } from '../tv/tvScreen';

/**
 * "Go big!" (K107 → K118 → K120, Tony 2026-09-20) - nút "Play on the Big screen" ở phòng chờ.
 *
 * Hai đường lên TV, đường 1 là chính:
 *   1. **App TV (LG webOS, trang `/tv` của server)** - TV hiện mã 4 số, nhập vào đây → server ghép TV
 *      làm GƯƠNG của ghế chủ phòng (K120). TV tự vẽ → mượt, animation đầy đủ.
 *   2. **Mirror màn hình phụ** (K118) - Cast screen / Smart View; TV nhận `TvBoardView`; chấp nhận
 *      nhòe khi chuyển động. Báo "TV connected ✓" khi thấy màn phụ.
 */
export function BigScreenDialog({
  visible,
  onClose,
  onLinkTv,
}: {
  visible: boolean;
  onClose: () => void;
  /** Gửi mã TV lên server; trả chuỗi lỗi hoặc null khi xong. */
  onLinkTv?: (code: string) => Promise<string | null>;
}) {
  const t = useT();
  const tv = useTvScreen();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const steps = Platform.OS === 'ios' ? ['bigScreen.ios1', 'bigScreen.ios2', 'bigScreen.ios3'] : ['bigScreen.android1', 'bigScreen.android2', 'bigScreen.android3'];

  useEffect(() => {
    if (!visible) {
      setCode('');
      setBusy(false);
      setError(null);
      setLinked(false);
    }
  }, [visible]);

  const link = async () => {
    if (!onLinkTv || code.length !== 4 || busy) return;
    setBusy(true);
    setError(null);
    const err = await onLinkTv(code);
    setBusy(false);
    if (err) setError(err);
    else setLinked(true);
  };

  return (
    <NeonSheet visible={visible} onClose={onClose} maxWidth={500} closeButton>
      <Text style={styles.title}>{t('bigScreen.title')}</Text>

      {linked ? (
        <View style={styles.status}>
          <Text style={styles.statusOk}>{t('bigScreen.tvLinked')}</Text>
          <Text style={styles.statusSub}>{t('bigScreen.tvLinkedBody')}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.body}>{t('bigScreen.tvCodeBody')}</Text>
          <View style={styles.codeRow}>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor="rgba(200,212,240,0.35)"
              style={styles.codeInput}
              returnKeyType="done"
              onSubmitEditing={link}
            />
            {busy ? (
              <ActivityIndicator color="#3CE87A" />
            ) : (
              <SheetButton label={t('bigScreen.tvLink')} onPress={link} disabled={code.length !== 4} style={styles.linkBtn} />
            )}
          </View>
          {error ? <Text style={styles.warn}>{error}</Text> : null}
        </>
      )}

      <Text style={styles.or}>{t('bigScreen.orMirror')}</Text>
      {!tvAvailable() ? (
        <Text style={styles.warn}>{t('bigScreen.unavailable')}</Text>
      ) : tv ? (
        <Text style={styles.statusOk}>{t('bigScreen.connected')}</Text>
      ) : (
        <View style={styles.steps}>
          {steps.map((k, i) => (
            <View key={k} style={styles.step}>
              <Text style={styles.stepNo}>{i + 1}</Text>
              <Text style={styles.stepText}>{t(k as Parameters<typeof t>[0])}</Text>
            </View>
          ))}
        </View>
      )}

      <SheetButton label={linked || tv ? t('bigScreen.done') : t('bigScreen.close')} onPress={onClose} style={styles.btn} />
    </NeonSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '500', color: '#FFFFFF', textAlign: 'center' },
  body: { fontSize: 13.5, lineHeight: 18, color: '#FFFFFF', textAlign: 'center' },
  warn: { fontSize: 13, lineHeight: 18, color: '#FF7A88', textAlign: 'center' },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  codeInput: {
    width: 130,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(160,200,255,0.6)',
    backgroundColor: 'rgba(8,12,40,0.8)',
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
  },
  linkBtn: { minWidth: 120 },
  or: { marginTop: 4, fontSize: 11.5, fontWeight: '700', color: 'rgba(200,212,240,0.65)', textAlign: 'center', letterSpacing: 0.5 },
  steps: { alignSelf: 'stretch', gap: 4 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 11,
    fontWeight: '900',
    color: '#062A10',
    backgroundColor: '#3CE87A',
  },
  stepText: { flex: 1, fontSize: 12, lineHeight: 16, color: 'rgba(230,236,255,0.9)' },
  status: { alignSelf: 'stretch', alignItems: 'center', gap: 4, paddingVertical: 4 },
  statusOk: { fontSize: 16, fontWeight: '800', color: '#3CE87A', textAlign: 'center' },
  statusSub: { fontSize: 13, color: 'rgba(200,212,240,0.8)', textAlign: 'center' },
  btn: { alignSelf: 'stretch', marginTop: 2 },
});
