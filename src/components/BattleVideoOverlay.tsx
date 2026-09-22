import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

import { API_BASE_URL } from '../api/config';

/**
 * Nơi bàn cờ web lấy video (`mainHandlers.js`: `sourceURL`). Server cũng có đủ file
 * trong `wwwroot/images/{battle,winner}/` nên máy thật vẫn xem được khi CDN lệch.
 */
const CDN = 'https://cdn.fintechsolutions.vn';

/** Video dài 3,4–5,1 giây (đo trong wwwroot); quá mốc này là coi như hỏng và đi tiếp. */
const GIVE_UP_MS = 12000;

/**
 * CDN không trả lời (DNS treo, WiFi hội trường không có internet) thì expo-video KHÔNG
 * bao giờ báo `error` - nó cứ "loading" mãi, và ta ngồi hết 12 giây rồi bỏ qua mà chưa
 * thử server LAN một lần nào. Đo trên emulator DNS hỏng, K63: hai video đen 12 s trong
 * khi `{API}/images/…` ở ngay cạnh. Chưa `readyToPlay` sau mốc này thì đổi nguồn.
 */
const STALL_MS = 4000;

/*
 * K123 (Tony 22/9): video tải lên từ dashboard "Battle Videos" nằm ở wwwroot của SERVER, CDN không có
 * (hoặc có sau) → SERVER là nguồn chính, CDN là dự phòng (đảo lại so với K61). Mọi ảnh/bàn cờ vốn đã lấy
 * từ server nên không thêm phụ thuộc mới; CDN chỉ còn để cứu khi server chậm hoặc thiếu file cũ.
 */
export function battleVideoUrl(kind: 'battle' | 'winner', name: string) {
  return {
    primary: `${API_BASE_URL}/images/${kind}/${name}`,
    fallback: `${CDN}/images/${kind}/${name}`,
  };
}

/**
 * VIDEO BATTLE - chép `handlePlayerBattle` / `handlePlayerBattleWinner` của bàn cờ web
 * (`mainHandlers.js`), Tony yêu cầu 2026-09-11 (K61):
 *
 *   gói 54 `PlayerBattle`        -> video mở màn (`BattleVideoName`)  -> gửi 55
 *   gói 58 `PlayerBattleWinner`  -> video người thắng (`WinnerVideoName`) -> gửi 58 lên
 *
 * Bàn cờ web chỉ có MỘT máy chiếu rồi báo server; app thì mọi ghế cùng chiếu và cùng
 * báo - server chỉ nhận ghế đầu tiên (cổng `IsArmed`, GAME_RULES 7g). Chiếu xong,
 * hỏng, kẹt, hay quá 12 giây đều gọi `onDone` ĐÚNG MỘT LẦN: đó là đường duy nhất báo server,
 * y như bàn cờ web ghi ở `video.onerror` - "video lỗi thì PHẢI đi tiếp".
 *
 * File mp4 có sẵn tiếng (bàn cờ web tắt tiếng video và phát mp3 rời để đồng bộ với
 * audio context của nó; app không cần trò đó). CDN hỏng - HOẶC KẸT quá `STALL_MS`,
 * xem ghi chú ở đó - thì thử `wwwroot` của server một lần rồi thôi.
 */
export function BattleVideoOverlay({
  name,
  kind,
  onDone,
}: {
  name: string;
  kind: 'battle' | 'winner';
  onDone: () => void;
}) {
  const urls = battleVideoUrl(kind, name);
  const done = useRef(false);
  const triedFallback = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const player = useVideoPlayer(urls.primary, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  useEffect(() => {
    let stall: ReturnType<typeof setTimeout> | null = null;
    const armStall = () => {
      if (stall) clearTimeout(stall);
      stall = setTimeout(() => nextSource(), STALL_MS);
    };
    // Nguồn hiện tại hỏng hoặc kẹt: thử server một lần, hết đường thì đi tiếp.
    const nextSource = () => {
      if (triedFallback.current) {
        finishRef.current();
        return;
      }
      triedFallback.current = true;
      // `replace` đồng bộ thì expo-video cảnh báo (toast vàng trên máy, đo 20:39 11/9).
      void player
        .replaceAsync(urls.fallback)
        .then(() => {
          player.play();
          armStall();
        })
        .catch(() => finishRef.current());
    };
    const end = player.addListener('playToEnd', () => finishRef.current());
    const status = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && stall) {
        clearTimeout(stall);
        stall = null;
        return;
      }
      if (status === 'error') nextSource();
    });
    armStall();
    const giveUp = setTimeout(() => finishRef.current(), GIVE_UP_MS);
    return () => {
      end.remove();
      status.remove();
      if (stall) clearTimeout(stall);
      clearTimeout(giveUp);
    };
    // `urls` đổi là component đổi key ở nơi gọi - không phụ thuộc ở đây.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  return (
    <View style={styles.root} pointerEvents="none">
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    /* Trên mọi khung trong ván (xúc xắc 20, kết quả battle 15, Game Over 60 ở gốc). */
    zIndex: 70,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: { width: '100%', height: '100%' },
});
