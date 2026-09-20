import { Platform, StyleSheet, Text, View } from 'react-native';

import { NeonSheet, SheetButton } from './NeonSheet';
import { useT } from '../i18n/I18nProvider';
import { tvAvailable, useTvScreen } from '../tv/tvScreen';

/**
 * "Go big!" (K107 → K118, Tony chốt 2026-09-20) - nút "Play on the Big screen" ở phòng chờ.
 *
 * Không còn Cast receiver, không còn bản web: TV là GƯƠNG của màn hình phụ mà phone chủ phòng vẽ
 * (`react-native-external-display`). Hộp này chỉ hướng dẫn bật mirror của hệ điều hành (Android
 * "Cast screen" / Samsung Smart View / iPhone AirPlay) và báo khi đã thấy màn hình phụ:
 * "TV is connected — the board is showing on it".
 *
 * ⚠️ Bản build thiếu native module (`tvAvailable()` false) → nói thẳng là bản này chưa hỗ trợ.
 */
export function BigScreenDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const tv = useTvScreen();
  const steps = Platform.OS === 'ios' ? ['bigScreen.ios1', 'bigScreen.ios2', 'bigScreen.ios3'] : ['bigScreen.android1', 'bigScreen.android2', 'bigScreen.android3'];

  return (
    <NeonSheet visible={visible} onClose={onClose} maxWidth={480} closeButton>
      <Text style={styles.title}>{t('bigScreen.title')}</Text>
      <Text style={styles.body}>{t('bigScreen.body')}</Text>

      {!tvAvailable() ? (
        <Text style={styles.warn}>{t('bigScreen.unavailable')}</Text>
      ) : tv ? (
        <View style={styles.status}>
          <Text style={styles.statusOk}>{t('bigScreen.connected')}</Text>
          <Text style={styles.statusSub}>{t('bigScreen.connectedBody', { w: String(Math.round(tv.width)), h: String(Math.round(tv.height)) })}</Text>
        </View>
      ) : (
        <View style={styles.steps}>
          {steps.map((k, i) => (
            <View key={k} style={styles.step}>
              <Text style={styles.stepNo}>{i + 1}</Text>
              <Text style={styles.stepText}>{t(k as Parameters<typeof t>[0])}</Text>
            </View>
          ))}
          <Text style={styles.waiting}>{t('bigScreen.waiting')}</Text>
        </View>
      )}

      <SheetButton label={tv ? t('bigScreen.done') : t('bigScreen.close')} onPress={onClose} style={styles.btn} />
    </NeonSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '500', color: '#FFFFFF', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 19, color: '#FFFFFF', textAlign: 'center' },
  warn: { fontSize: 14, lineHeight: 20, color: '#FF7A88', textAlign: 'center' },
  steps: { alignSelf: 'stretch', gap: 5, marginTop: 2 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 12,
    fontWeight: '900',
    color: '#062A10',
    backgroundColor: '#3CE87A',
  },
  stepText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#FFFFFF' },
  waiting: { marginTop: 4, fontSize: 12.5, color: 'rgba(200,212,240,0.75)', textAlign: 'center' },
  status: { alignSelf: 'stretch', alignItems: 'center', gap: 4, paddingVertical: 6 },
  statusOk: { fontSize: 17, fontWeight: '800', color: '#3CE87A', textAlign: 'center' },
  statusSub: { fontSize: 13, color: 'rgba(200,212,240,0.8)', textAlign: 'center' },
  btn: { alignSelf: 'stretch', marginTop: 2 },
});
