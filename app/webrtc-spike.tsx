import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
  type MediaStream,
} from 'react-native-webrtc';

/**
 * K145 — MÀN SPIKE, KHÔNG PHẢI TÍNH NĂNG. Xoá khi xong.
 *
 * Câu hỏi đắt nhất của video call: `react-native-webrtc` có chạy trên **New Architecture**
 * (`newArchEnabled=true`) + RN 0.86 không? Thư viện KHÔNG khai `codegenConfig`, tức nó vẫn là
 * native module kiểu cũ và phải đi qua lớp interop của Fabric - chỗ hay vỡ nhất là `RTCView`
 * (ViewManager cũ dưới Fabric).
 *
 * Màn này trả lời bằng cách chạy TRỌN VẸN một cuộc gọi trong CHÍNH MỘT MÁY:
 *
 *   1. `getUserMedia` - xin quyền, mở camera + mic
 *   2. `RTCView` vẽ hình local   -> chứng minh ViewManager sống dưới Fabric
 *   3. pc1 ↔ pc2 trao offer/answer/ICE ngay trong app (loopback)
 *   4. `RTCView` vẽ hình REMOTE  -> chứng minh cả đường media chạy thật
 *
 * Qua được bước 4 là toàn bộ tầng dưới đã ổn; phần còn lại chỉ là signalling qua SignalR.
 *
 * Mở bằng: adb shell am start -a android.intent.action.VIEW -d "cyclic://webrtc-spike"
 */
export default function WebrtcSpike() {
  const [log, setLog] = useState<string[]>([]);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const pcs = useRef<RTCPeerConnection[]>([]);

  const say = (line: string) => setLog((l) => [...l, `${new Date().toISOString().slice(11, 19)}  ${line}`]);

  useEffect(() => {
    return () => {
      pcs.current.forEach((pc) => pc.close());
      local?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    setLog([]);
    setRemote(null);
    try {
      say('1. getUserMedia…');
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: { width: 320, height: 320, frameRate: 15, facingMode: 'user' },
      });
      setLocal(stream);
      say(`   OK — ${stream.getVideoTracks().length} video, ${stream.getAudioTracks().length} audio`);

      say('2. dựng pc1 + pc2 (loopback)…');
      const cfg = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      const pc1 = new RTCPeerConnection(cfg);
      const pc2 = new RTCPeerConnection(cfg);
      pcs.current = [pc1, pc2];

      stream.getTracks().forEach((t) => pc1.addTrack(t, stream));

      // @ts-expect-error - react-native-webrtc dùng sự kiện kiểu DOM, kiểu TS của nó chưa khớp
      pc2.addEventListener('track', (e: { streams: MediaStream[] }) => {
        say(`   pc2 nhận track: ${e.streams.length} stream`);
        if (e.streams[0]) setRemote(e.streams[0]);
      });
      // @ts-expect-error - như trên
      pc1.addEventListener('icecandidate', (e: { candidate: unknown }) => {
        if (e.candidate) void pc2.addIceCandidate(e.candidate as never);
      });
      // @ts-expect-error - như trên
      pc2.addEventListener('icecandidate', (e: { candidate: unknown }) => {
        if (e.candidate) void pc1.addIceCandidate(e.candidate as never);
      });
      // @ts-expect-error - như trên
      pc1.addEventListener('connectionstatechange', () => say(`   pc1 = ${pc1.connectionState}`));
      // @ts-expect-error - như trên
      pc2.addEventListener('connectionstatechange', () => say(`   pc2 = ${pc2.connectionState}`));

      say('3. offer / answer…');
      const offer = await pc1.createOffer({});
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(new RTCSessionDescription(answer));
      say('   đã trao xong SDP, chờ ICE…');
    } catch (e) {
      say(`LỖI: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>K145 · WebRTC spike</Text>

      <View style={styles.row}>
        <View style={styles.tileWrap}>
          <Text style={styles.tileLabel}>local 50dp</Text>
          <View style={styles.tile50}>
            {local ? <RTCView streamURL={local.toURL()} style={styles.fill} objectFit="cover" mirror /> : null}
          </View>
        </View>

        <View style={styles.tileWrap}>
          <Text style={styles.tileLabel}>remote 50dp</Text>
          <View style={styles.tile50}>
            {remote ? <RTCView streamURL={remote.toURL()} style={styles.fill} objectFit="cover" /> : null}
          </View>
        </View>

        <View style={styles.tileWrap}>
          <Text style={styles.tileLabel}>local to</Text>
          <View style={styles.tileBig}>
            {local ? <RTCView streamURL={local.toURL()} style={styles.fill} objectFit="cover" mirror /> : null}
          </View>
        </View>

        <Pressable onPress={run} style={styles.btn}>
          <Text style={styles.btnText}>CHẠY</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.logBox}>
        {log.map((l, i) => (
          <Text key={i} style={styles.logLine}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07051A', padding: 12, gap: 10 },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  tileWrap: { alignItems: 'center', gap: 4 },
  tileLabel: { color: '#8FA3C8', fontSize: 10 },
  /* Đúng cỡ ô nhân vật của dải người chơi - để nhìn xem 50dp có đủ rõ mặt không. */
  tile50: { width: 50, height: 50, borderRadius: 8, overflow: 'hidden', backgroundColor: '#12102E' },
  tileBig: { width: 120, height: 120, borderRadius: 10, overflow: 'hidden', backgroundColor: '#12102E' },
  fill: { width: '100%', height: '100%' },
  btn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, backgroundColor: '#18B65A' },
  btnText: { color: '#FFFFFF', fontWeight: '900', letterSpacing: 1 },
  logBox: { flex: 1, backgroundColor: '#0C0A22', borderRadius: 8, padding: 8 },
  logLine: { color: '#C9D6F0', fontSize: 11, fontFamily: 'monospace' },
});
