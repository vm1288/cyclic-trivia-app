import { Image, StyleSheet, Text, View } from 'react-native';
import { RTCView, type MediaStream } from 'react-native-webrtc';
import Svg, { Path } from 'react-native-svg';

/**
 * K145 — ô VUÔNG trong khung người chơi: có video thì chiếu video, không thì giữ nhân vật như cũ.
 *
 * Tony chốt 24/9: video **thay đúng ô nhân vật hình vuông**, không lấp cả khung — khung là hình
 * chữ nhật có tên và điểm, kéo video full sẽ méo mặt hoặc phải cắt rất mạnh.
 *
 * Ba trạng thái, và **không bao giờ để ô đen**:
 *   có stream           -> video (cắt giữa về vuông, `objectFit="cover"`)
 *   nối hỏng            -> nhân vật + dấu ⚠, người chơi hiểu là mạng chứ không tưởng app hỏng
 *   không bật / chỉ xem -> nhân vật như trước
 *
 * Mic tắt thì hiện dấu micro gạch chéo ở góc — vì mic và camera là hai nút riêng, có thể lên hình
 * mà không nói, hoặc nói mà không lên hình.
 */
export function CallTile({
  size,
  stream,
  characterUri,
  failed,
  micOff,
  mirror,
}: {
  size: number;
  stream: MediaStream | null;
  characterUri: string;
  /** Kết nối tới người này hỏng — hiện nhân vật kèm cảnh báo, KHÔNG để trống. */
  failed?: boolean;
  /** Người này đang trong cuộc gọi nhưng tắt mic. `undefined` = không ở trong cuộc gọi. */
  micOff?: boolean;
  /** Ô của chính mình phải LẬT GƯƠNG, nếu không giơ tay phải lại thấy tay trái. */
  mirror?: boolean;
}) {
  const box = { width: size, height: size };

  return (
    <View style={[styles.root, box]}>
      {stream ? (
        <RTCView
          streamURL={stream.toURL()}
          style={styles.fill}
          objectFit="cover"
          mirror={mirror}
          zOrder={0}
        />
      ) : (
        <Image source={{ uri: characterUri }} style={styles.fill} resizeMode="contain" />
      )}

      {failed ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>⚠</Text>
        </View>
      ) : micOff ? (
        <View style={styles.badge}>
          <Svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round">
            <Path d="M9 9v3a3 3 0 004.6 2.5" />
            <Path d="M15 11.5V5a3 3 0 00-5.1-2.1" />
            <Path d="M5 11a7 7 0 0010.5 6" />
            <Path d="M3 3l18 18" />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /* `overflow: hidden` là BẮT BUỘC: video không tự bo góc theo khung cha trên Android. */
  root: { borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(8,6,26,0.55)' },
  fill: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: 'rgba(10,8,28,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFC61E', fontSize: 9, lineHeight: 11 },
});

/** Nút MIC ở hàng dưới. Tắt thì có gạch chéo - nhìn là biết ngay, không phải đoán theo màu. */
export function MicIcon({ size = 20, on }: { size?: number; on: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={on ? '#7CF6A8' : 'rgba(198,212,240,0.7)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" />
      <Path d="M5 11a7 7 0 0014 0" />
      <Path d="M12 18v3" />
      {on ? null : <Path d="M3 3l18 18" />}
    </Svg>
  );
}

/** Nút CAMERA. Cùng quy ước với mic: tắt = gạch chéo. */
export function CamIcon({ size = 20, on }: { size?: number; on: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={on ? '#7CF6A8' : 'rgba(198,212,240,0.7)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 7.5h11v9H3z" />
      <Path d="M14 12l7-3.5v7L14 12z" />
      {on ? null : <Path d="M3 3l18 18" />}
    </Svg>
  );
}
