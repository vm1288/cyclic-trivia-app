import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { sendToBigScreen, useBigScreenDevices, type BigScreenDevice } from '../cast/bigScreen';
import { useT } from '../i18n/I18nProvider';

/**
 * "Go big!" (K107, Tony 18/9) - nút "Play on the Big screen" ở phòng chờ.
 *
 *   intro    → tấm đen theo ảnh mẫu: tiêu đề, một đoạn, CANCEL (viền đỏ) / CAST (viền xanh)
 *   devices  → CAST: xin vé ở server (`getUrl`) + quét thiết bị Cast; chạm một thiết bị
 *              để gửi; dưới cùng "SHARE LINK" cho PC / tablet (bảng chia sẻ hệ thống)
 *   sending  → đang nối
 *   done     → "Board is on <TV>" rồi tự đóng
 *
 * Đường link chỉ xin MỘT lần khi vào bước devices và giữ trong state: mỗi vé sống 30 phút,
 * xin lại mỗi lần chạm thiết bị là rác vé.
 */
export function BigScreenDialog({
  visible,
  getUrl,
  onClose,
}: {
  visible: boolean;
  /** Xin link `/cast/{ticket}` ở server; null = lỗi (đã báo ở nơi gọi hoặc trả về chữ). */
  getUrl: () => Promise<{ url: string } | { error: string }>;
  onClose: () => void;
}) {
  const t = useT();
  const [phase, setPhase] = useState<'intro' | 'devices' | 'sending' | 'done'>('intro');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string>('');
  const { devices, available } = useBigScreenDevices(visible && phase !== 'intro');

  useEffect(() => {
    if (!visible) {
      setPhase('intro');
      setUrl(null);
      setError(null);
      setTarget('');
    }
  }, [visible]);

  async function goDevices() {
    setPhase('devices');
    setError(null);
    if (url) return;
    const r = await getUrl();
    if ('url' in r) setUrl(r.url);
    else setError(r.error);
  }

  async function pick(d: BigScreenDevice) {
    if (!url) return;
    setPhase('sending');
    setTarget(d.friendlyName);
    const err = await sendToBigScreen(d.deviceId, url);
    if (err) {
      setError(err);
      setPhase('devices');
      return;
    }
    setPhase('done');
    setTimeout(onClose, 1800);
  }

  async function shareLink() {
    if (!url) return;
    await Share.share({ message: t('bigScreen.shareMessage', { url }), title: t('bigScreen.shareTitle') });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button">
        <Pressable style={styles.card} onPress={() => {}}>
          {phase === 'intro' ? (
            <>
              <Text style={styles.title}>{t('bigScreen.title')}</Text>
              <Text style={styles.body}>{t('bigScreen.body')}</Text>
              <View style={styles.row}>
                <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && styles.pressed]}>
                  <Text style={styles.btnText}>{t('bigScreen.cancel')}</Text>
                </Pressable>
                <Pressable onPress={goDevices} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.btnCast, pressed && styles.pressed]}>
                  <Text style={styles.btnText}>{t('bigScreen.cast')}</Text>
                </Pressable>
              </View>
            </>
          ) : phase === 'done' ? (
            <>
              <Text style={styles.title}>{t('bigScreen.doneTitle')}</Text>
              <Text style={styles.body}>{t('bigScreen.doneBody', { name: target })}</Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>{phase === 'sending' ? t('bigScreen.sending', { name: target }) : t('bigScreen.pickTitle')}</Text>
              {phase === 'sending' ? (
                <ActivityIndicator color="#3CE87A" size="large" style={styles.spinner} />
              ) : (
                <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
                  {!available ? (
                    <Text style={styles.body}>{t('bigScreen.unavailable')}</Text>
                  ) : devices.length === 0 ? (
                    <View style={styles.scanRow}>
                      <ActivityIndicator color="#9FB0D8" />
                      <Text style={styles.body}>{t('bigScreen.scanning')}</Text>
                    </View>
                  ) : (
                    devices.map((d) => (
                      <Pressable
                        key={d.deviceId}
                        onPress={() => pick(d)}
                        disabled={!url}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.device, pressed && styles.pressed, !url && styles.deviceOff]}
                      >
                        <Text style={styles.deviceName} numberOfLines={1}>{d.friendlyName}</Text>
                        <Text style={styles.deviceModel} numberOfLines={1}>{d.modelName}</Text>
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              )}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {phase === 'devices' ? (
                <View style={styles.row}>
                  <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && styles.pressed]}>
                    <Text style={styles.btnText}>{t('bigScreen.cancel')}</Text>
                  </Pressable>
                  <Pressable onPress={shareLink} disabled={!url} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.btnShare, pressed && styles.pressed, !url && styles.deviceOff]}>
                    <Text style={styles.btnText}>{t('bigScreen.share')}</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  /* Đen đặc, chữ trắng - đúng ảnh mẫu "Go big!" của Tony. */
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    borderRadius: 14,
    backgroundColor: '#000000',
    paddingHorizontal: 22,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '500', color: '#FFFFFF', textAlign: 'center' },
  body: { fontSize: 16.5, lineHeight: 23, color: '#FFFFFF', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 22, marginTop: 6 },
  btn: { minWidth: 118, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 2.5, alignItems: 'center' },
  btnCancel: { borderColor: '#D9262E' },
  btnCast: { borderColor: '#1FC85A' },
  btnShare: { borderColor: '#3AA5FF' },
  btnText: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.4 },
  pressed: { opacity: 0.7 },
  spinner: { marginVertical: 10 },
  list: { alignSelf: 'stretch', maxHeight: 190 },
  listInner: { gap: 8, paddingVertical: 2 },
  scanRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 8 },
  device: { borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(160,200,255,0.5)', paddingHorizontal: 14, paddingVertical: 9 },
  deviceOff: { opacity: 0.45 },
  deviceName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  deviceModel: { fontSize: 12.5, color: 'rgba(200,212,240,0.75)' },
  error: { color: '#FF7A88', fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
});
