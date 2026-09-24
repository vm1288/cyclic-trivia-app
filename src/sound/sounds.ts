import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * ÂM THANH CỦA VÁN (K137, Tony 24/9) - chép đúng bộ tiếng của bản web
 * (`wwwroot/js/sounds.js` + `wwwroot/sounds/*`), để app, TV và web nghe giống nhau.
 *
 * Tony chốt 24/9: **lobby KHÔNG có tiếng**; `game-music` chỉ bật khi ván BẮT ĐẦU và lặp tới lúc
 * hết ván.
 *
 * Vì sao mỗi tiếng một `AudioPlayer` dựng sẵn thay vì tạo lúc cần: tạo player rồi mới giải mã
 * mất vài trăm ms - tiếng "đúng/sai" mà tới sau khi tấm kết quả đã đóng thì thà đừng có. Bản web
 * cũng nạp trước hết vào `soundBuffers` từ lúc mở trang.
 *
 * ⚠️ File nguồn nằm ở **server** (`wwwroot/sounds/`) và đã được CHÉP sang `assets/sounds/`.
 * Sửa tiếng thì sửa cả hai chỗ, nếu không web một kiểu app một kiểu.
 */

/** Tên tiếng - trùng khoá của `soundFiles` trong `wwwroot/js/sounds.js`. */
export type SoundName =
  | 'select'
  | 'selectCard'
  | 'correctAnswer'
  | 'correct'
  | 'wrongAnswer'
  | 'timerLast'
  | 'gameOver'
  | 'yourChoice'
  | 'giveItUp'
  | 'challenge'
  | 'curveBall'
  | 'star'
  | 'bell'
  | 'gun'
  | 'firework'
  | 'tap'
  | 'move'
  | 'gameMusic'
  /* K138 (Tony 24/9): ba tiếng RIÊNG của trận battle - Tony gửi file 24/9. */
  | 'duelDramatic'
  | 'duelCorrect'
  | 'duelWrong'
  | 'duelCheer';

/* eslint-disable @typescript-eslint/no-require-imports */
const FILES: Record<SoundName, number> = {
  select: require('../../assets/sounds/select.mp3'),
  selectCard: require('../../assets/sounds/special-card.mp3'),
  correctAnswer: require('../../assets/sounds/correct-answer.mp3'),
  correct: require('../../assets/sounds/correct.mp3'),
  wrongAnswer: require('../../assets/sounds/wrong-answer.mp3'),
  timerLast: require('../../assets/sounds/timer-last.mp3'),
  gameOver: require('../../assets/sounds/game-over.mp3'),
  yourChoice: require('../../assets/sounds/your-choice.mp3'),
  giveItUp: require('../../assets/sounds/give-it-up.mp3'),
  challenge: require('../../assets/sounds/challenge.mp3'),
  curveBall: require('../../assets/sounds/curve-ball.mp3'),
  star: require('../../assets/sounds/star.mp3'),
  bell: require('../../assets/sounds/bell.mp3'),
  gun: require('../../assets/sounds/gun.mp3'),
  firework: require('../../assets/sounds/firework.mp3'),
  tap: require('../../assets/sounds/tap.mp3'),
  move: require('../../assets/sounds/move.wav'),
  gameMusic: require('../../assets/sounds/game-music.mp3'),
  duelDramatic: require('../../assets/sounds/duel-dramatic.mp3'),
  duelCorrect: require('../../assets/sounds/duel-correct.mp3'),
  duelWrong: require('../../assets/sounds/duel-wrong.mp3'),
  duelCheer: require('../../assets/sounds/duel-cheer.mp3'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** Tiếng LẶP: nhạc nền, pháo hoa, đồng hồ 10 giây - bật/tắt bằng `loop()`, không phải `play()`. */
const LOOPING: SoundName[] = ['gameMusic', 'firework', 'timerLast'];

/** Nhạc nền nhỏ hơn hẳn tiếng hiệu, nếu không nó nuốt mất lời dẫn. */
const VOLUME: Partial<Record<SoundName, number>> = { gameMusic: 0.35, firework: 0.6 };

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let muted = false;
let ready = false;

/** Mức còn lại của nhạc nền khi có người nói: còn nghe thấy, nhưng không đè lời. */
const DUCK_RATIO = 0.15;

/**
 * Dựng sẵn mọi player. Gọi một lần lúc vào màn ván.
 *
 * `playsInSilentMode` để iOS vẫn kêu khi gạt công tắc im lặng - người chơi cầm máy ngang chơi game
 * thì mong có tiếng; `shouldPlayInBackground: false` để ra khỏi app là im.
 */
export async function initSounds(): Promise<void> {
  if (ready) return;
  ready = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
  } catch {
    /* Không đặt được chế độ thì vẫn chơi được, chỉ là im khi máy ở chế độ im lặng. */
  }
  (Object.keys(FILES) as SoundName[]).forEach((name) => {
    try {
      const p = createAudioPlayer(FILES[name]);
      p.loop = LOOPING.includes(name);
      p.volume = VOLUME[name] ?? 1;
      players[name] = p;
    } catch {
      /* Thiếu một tiếng không được làm hỏng ván. */
    }
  });
}

/** Gỡ hết player - gọi khi rời màn ván, nếu không nhạc nền còn kêu ở màn khác. */
export function releaseSounds(): void {
  (Object.keys(players) as SoundName[]).forEach((name) => {
    try {
      players[name]?.remove();
    } catch {
      /* đã gỡ rồi */
    }
    delete players[name];
  });
  ready = false;
}

/** Một tiếng hiệu, phát từ đầu. Gọi chồng lên nhau được (tua lại rồi phát tiếp). */
export function play(name: SoundName): void {
  if (muted) return;
  const p = players[name];
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {
    /* player đã bị gỡ */
  }
}

/**
 * Dừng hẳn một tiếng đang kêu. Cần cho `duelCheer` (K139): tiếng reo dài 16,7 s còn video người
 * thắng ngắn hơn, không cắt thì nó reo sang tận lượt sau.
 */
export function stop(name: SoundName): void {
  const p = players[name];
  if (!p) return;
  try {
    p.pause();
    p.seekTo(0);
  } catch {
    /* player đã bị gỡ */
  }
}

/** Bật/tắt một tiếng LẶP (`gameMusic`, `firework`, `timerLast`). Gọi `loop(x, true)` hai lần là vô hại. */
export function loop(name: SoundName, on: boolean): void {
  const p = players[name];
  if (!p) return;
  try {
    if (on) {
      if (muted || p.playing) return;
      p.seekTo(0);
      p.play();
    } else {
      p.pause();
      p.seekTo(0);
    }
  } catch {
    /* player đã bị gỡ */
  }
}

/**
 * HẠ MỘT TIẾNG ĐANG KÊU XUỐNG MỨC NỀN, không dừng nó (K146).
 *
 * ⚠️ ĐỮNG DÙNG {@link loop}`(x, false)` để lách tiếng nói: hàm đó `pause()` **và `seekTo(0)`**,
 * nên mỗi lần có người mở lời là nhạc nền **quay về từ đầu**. Đo trên máy 24/9: trong một câu
 * nói bình thường nó tắt/bật hơn chục lần — nghe thành nhạc giật cục chứ không phải nhường lời.
 */
export function duck(name: SoundName, on: boolean): void {
  const p = players[name];
  if (!p) return;
  const full = VOLUME[name] ?? 1;
  try {
    p.volume = on ? full * DUCK_RATIO : full;
  } catch {
    /* player đã bị gỡ */
  }
}

/** Đang tắt tiếng hay không - để nút loa vẽ đúng trạng thái. */
export function isMuted(): boolean {
  return muted;
}

/**
 * Tắt / bật tiếng toàn ván. Tắt thì dừng luôn mọi tiếng đang lặp; bật lại thì CHỈ nhạc nền chạy
 * tiếp (pháo hoa và đồng hồ 10 giây là tiếng nhất thời, bật lại giữa chừng là sai nhịp).
 */
export function setMuted(next: boolean, musicShouldPlay = false): void {
  muted = next;
  if (next) {
    LOOPING.forEach((n) => loop(n, false));
    return;
  }
  if (musicShouldPlay) loop('gameMusic', true);
}
