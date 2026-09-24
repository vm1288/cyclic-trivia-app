import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

/**
 * VIDEO "SÁU ĐIỂM" SAU KHI TRẢ LỜI ĐÚNG CÓ JOKER (K141, Tony 24/9).
 *
 * Yêu cầu: *"AFTER A CORRECT ANSWER WITH A JOKER … khi player submit đáp án đúng sẽ phát video
 * trước và sau đó mới hiện thông báo giải thích đáp án đúng và cộng điểm"*. Nên đây là một tấm
 * CHẶN ĐƯỜNG: chiếu xong (hoặc hỏng, hoặc quá giờ) mới gọi `onDone`, và `onDone` chính là chỗ
 * dựng tấm kết quả như cũ.
 *
 * ⚠️ File nằm TRONG APK (`assets/videos/joker-six.mp4`, 5,3 MB) chứ không tải từ server như video
 * battle. Lý do: tấm kết quả PHẢI hiện ngay sau đó - tải mạng giữa chừng là người chơi ngồi nhìn
 * màn đen vài giây, mà WiFi hội trường thì không tin được. Đổi video = thay file đó rồi build lại.
 *
 * ⚠️ `onDone` phải chạy ĐÚNG MỘT LẦN dù đường nào: xong, lỗi, hay hết giờ. Bỏ sót một nhánh là
 * người chơi không bao giờ thấy điểm của mình - đúng bài học của `BattleVideoOverlay` (K61).
 */

/** Video dài ~5 s. Quá mốc này coi như hỏng và đi tiếp - không để ai chờ mãi. */
const GIVE_UP_MS = 12000;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SOURCE = require('../../assets/videos/joker-six.mp4');

export function JokerSixOverlay({ onDone }: { onDone: () => void }) {
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const player = useVideoPlayer(SOURCE, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  useEffect(() => {
    const end = player.addListener('playToEnd', () => finishRef.current());
    const status = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') finishRef.current();
    });
    const giveUp = setTimeout(() => finishRef.current(), GIVE_UP_MS);
    return () => {
      end.remove();
      status.remove();
      clearTimeout(giveUp);
    };
  }, [player]);

  return (
    <View style={styles.root} pointerEvents="auto">
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="contain"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /* Đè lên TẤT CẢ, kể cả tấm kết quả - nó là thứ phải hiện SAU. */
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 60,
  },
});
