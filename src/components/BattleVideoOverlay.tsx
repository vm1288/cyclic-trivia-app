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

export function battleVideoUrl(kind: 'battle' | 'winner', name: string) {
  return {
    primary: `${CDN}/images/${kind}/${name}`,
    fallback: `${API_BASE_URL}/images/${kind}/${name}`,
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
 * hỏng, hay quá 12 giây đều gọi `onDone` ĐÚNG MỘT LẦN: đó là đường duy nhất báo server,
 * y như bàn cờ web ghi ở `video.onerror` - "video lỗi thì PHẢI đi tiếp".
 *
 * File mp4 có sẵn tiếng (bàn cờ web tắt tiếng video và phát mp3 rời để đồng bộ với
 * audio context của nó; app không cần trò đó). Hỏng ở CDN thì thử `wwwroot` của
 * server một lần rồi thôi.
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
    const end = player.addListener('playToEnd', () => finishRef.current());
    const status = player.addListener('statusChange', ({ status }) => {
      if (status !== 'error') return;
      if (!triedFallback.current) {
        triedFallback.current = true;
        // `replace` đồng bộ thì expo-video cảnh báo (toast vàng trên máy, đo 20:39 11/9).
        void player.replaceAsync(urls.fallback).then(() => player.play()).catch(() => finishRef.current());
        return;
      }
      finishRef.current();
    });
    const giveUp = setTimeout(() => finishRef.current(), GIVE_UP_MS);
    return () => {
      end.remove();
      status.remove();
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
