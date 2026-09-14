import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ackFlow,
  CASE_ACTION,
  categoryChain,
  characterImageUrl,
  EMPTY_GUID,
  getChatHistory,
  pauseGame,
  endGame,
  resumeGame,
  startAgain,
  submitAnswer,
  submitAnswerBattle,
  submitAnswerForTurn,
  type AnswerResult,
  type CardStepPayload,
  type ChatMessage,
  type DirectionPacket,
  type GamePlayer,
  type GameQuestion,
  type MoveDirection,
  type QuestionPacket,
  type TurnCard,
  type GameCard,
  type TurnQuestionPayload,
} from '../src/api/game';
import { BoardCanvas, HOP_MS, type PendingMove } from '../src/components/BoardCanvas';
import { CardChoiceOverlay } from '../src/components/CardChoiceOverlay';
import { DiceRollOverlay } from '../src/components/DiceRollOverlay';
import { MoveDirectionOverlay } from '../src/components/MoveDirectionOverlay';
import { FlyingReward } from '../src/components/FlyingReward';
import { QuestionOverlay } from '../src/components/QuestionOverlay';
import { BattleOverlay } from '../src/components/BattleOverlay';
import { BattleResultOverlay } from '../src/components/BattleResultOverlay';
import { BattleDiceOverlay, type BattleDiceState } from '../src/components/BattleDiceOverlay';
import { BattleVideoOverlay } from '../src/components/BattleVideoOverlay';
import { TurnResultOverlay, type TurnResult } from '../src/components/TurnResultOverlay';
import { RaceWinnerOverlay } from '../src/components/RaceWinnerOverlay';
import { CurveBallOverlay } from '../src/components/CurveBallOverlay';
import { GameOverOverlay } from '../src/components/GameOverOverlay';
import { PauseOverlay } from '../src/components/PauseOverlay';
import { GameMenuSheet } from '../src/components/GameMenuSheet';
import { ChatPanel } from '../src/components/ChatPanel';
import {
  TenSecondsChallengeOverlay,
  type ChallengePhase,
} from '../src/components/TenSecondsChallengeOverlay';
import {
  YourChoiceOverlay,
  type ChoiceCategory,
} from '../src/components/YourChoiceOverlay';
import { StageBackground } from '../src/components/StageBackground';
import { TYPE_ID } from '../src/net/gameConnection';
import { useGameState } from '../src/net/useGameState';
import {
  boardColors,
  CARD_ORDER,
  type CardKey,
  ChatIcon,
  countCards,
  CrownIcon,
  Dice3D,
  HandTile,
  lighten,
  PlayIcon,
  Stars,
  TurnPulse,
} from '../src/components/GameBoardParts';
import { useConfirm } from '../src/components/ConfirmDialog';
import { useT } from '../src/i18n/I18nProvider';
import { en, type TranslationKey } from '../src/i18n/translations';
import { apiErrorText } from '../src/i18n/apiError';
import { useFocusEffect, useRouter } from 'expo-router';
import { usePlayer } from '../src/session/PlayerSession';
import { useLicense } from '../src/session/LicenseSession';
import { neon, text } from '../src/theme/colors';

/**
 * Màn trong ván, bố cục NẰM NGANG.
 *
 * Bàn cờ chiếm phần lớn bên trái; cột phải là mã phòng, người chơi chính,
 * bộ bài và xúc xắc.
 *
 * Dải người chơi khác trải một hàng trên cùng.
 *
 * Màn này tự khoá landscape khi mở và trả về portrait khi thoát.
 */

/**
 * CHẾ ĐỘ THỬ: cho nhân vật của người tới lượt tự nhảy vòng quanh bàn cờ.
 *
 * ĐÃ TẮT (2026-08-27) vì SignalR đã nối: nước đi thật tới qua gói tin và
 * `CurrentStepIndex` tự lái nhân vật - cơ chế nhảy dùng chung một đường nên
 * không phải viết lại gì.
 *
 * Giữ lại cờ này để bật tạm khi cần xem hiệu ứng nhảy mà không phải chơi cả ván.
 */
const DEMO_JUMP = false;

/**
 * Bề ngang cột phải.
 */
const SIDE_WIDTH = 224;

/**
 * Luôn có tối đa 5 vị trí player phụ.
 */
const STRIP_SLOTS = 5;

/**
 * Dải người chơi thu nhỏ còn 80%.
 *
 * `pill` 74 + `pillRim` padding 1.5×2 ≈ 77dp ở cỡ gốc; 80% là ~62dp, phần dôi
 * ra đi thẳng vào chiều cao bàn cờ (bàn `rectangle` bị chặn bởi CHIỀU CAO nên
 * mỗi dp lấy được là cạnh ô to thêm).
 *
 * ⚠️ Trước đây con số này được TÍNH ĐỘNG từ chiều cao máy và một
 * `MAIN_MIN_HEIGHT` đoán trước. Đã bỏ, vì hai lý do:
 *
 *  - Đo trên cả máy thật (384dp) lẫn emulator (392.7dp) thì nó **luôn** bị kẹp
 *    ở cận dưới 0.8 — phần nội suy chưa bao giờ chạy. Nó phức tạp nhưng hành
 *    xử y hệt một hằng số.
 *  - Việc nó gánh — chống bàn cờ tràn lên dải nhân vật — giờ do chính
 *    `BoardCanvas` lo (`useMeasuredBox` chặn cả chiều cao), nên không cần nữa.
 *
 * Muốn dải to/nhỏ hơn thì sửa đúng số này.
 */
const STRIP_SCALE = 0.8;

/** `pill` 74 + `pillRim` padding 1.5 × 2. */
const STRIP_BASE_HEIGHT = 77;

/**
 * stageInner gap giữa strip và main.
 *
 * Phải giống styles.stageInner.gap.
 */
const STAGE_GAP = 8;

/** Kích thước trong dải, đã nhân sẵn `STRIP_SCALE`. */
const ss = (value: number) => Math.round(value * STRIP_SCALE * 10) / 10;

const STRIP_HEIGHT = STRIP_BASE_HEIGHT * STRIP_SCALE;

/** Chặn bấm xúc xắc dồn - chép theo `canTriggerRollDice` của bản web. */
const ROLL_COOLDOWN_MS = 2000;



/**
 * Câu hỏi đang hiện, đã gộp về MỘT kiểu.
 *
 * Hai loại tới bằng hai đường khác hẳn nhau - vòng đua qua gói 67 (trường viết
 * HOA), lượt thường qua `Payload` của gói 16 (trường viết thường) - nhưng lên
 * màn hình thì y hệt. Gộp ở đây để chỉ có MỘT overlay và một chỗ quyết định gửi
 * câu trả lời đi đâu; `kind` là thứ duy nhất phân biệt.
 */
/**
 * So hai GUID không phân biệt hoa thường.
 *
 * ⚠ Cần thật: id từ SignalR và id từ `/api/game/{id}/state` KHÔNG luôn cùng
 * kiểu chữ - `Guid` của .NET serialize thường, còn vài chỗ của app giữ nguyên
 * chuỗi đã lưu. So bằng `===` trần là trượt im lặng.
 */
const same = (a: string, b: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

type ActiveQuestion = {
  /**
   * `battle` là loại THỨ BA, thêm 2026-09-10. Cùng khung hiển thị, nhưng đi
   * `/public/game/submitAnswerBattle` - endpoint riêng, xem GAME_RULES mục 7b.
   */
  kind: 'race' | 'turn' | 'battle';
  question: GameQuestion;
  categories: string[];
  duration: number;
  /**
   * ⚠️ ĐỌC THẲNG TỪ SERVER, đừng tự tính bằng cách so `CurrentTurnPlayerId`.
   *
   * Server ép cờ này về `false` khi câu hỏi đến từ ô YOUR CHOICE - kể cả cho
   * NGƯỜI TỚI LƯỢT (`ShowCardsBeforeSubCategoryOrQuestion.cs:96`). Tự tính ở máy
   * khách thì đúng ở ca thường và SAI ở ô đó. Xem GAME_RULES mục 6b.
   *
   * `false` = mình không được dùng Skipper/Eliminator cho câu này.
   */
  isQuestionOwner: boolean;
  /**
   * Đã dùng Eliminator cho CHÍNH câu này chưa. Bản web gọi là `isUsedCardE` và
   * đặt lại `false` mỗi khi câu mới hiện - ở đây nó nằm trong state câu hỏi nên
   * tự reset theo.
   */
  usedEliminator: boolean;
  /**
   * Số thứ tự câu trong trận battle (0,1,2 là ba câu chính; từ 3 trở đi là
   * sudden death). Chỉ để vẽ nhãn; `undefined` với hai loại câu kia.
   */
  battleIndex?: number;
};

export default function GameLandscapeScreen() {
  const player = usePlayer();
  const license = useLicense();
  const router = useRouter();
  const t = useT();
  const confirm = useConfirm();
  const insets = useSafeAreaInsets();

  const seat = player.status === 'ready' ? player.seat : null;
  /* Xem ghi chú `clientId` trong `gameConnection.ts` — dùng để biết ai cướp ghế. */
  const clientId = player.status === 'ready' ? player.deviceId : undefined;

  /*
   * ⚠️ KHÔNG khoá hướng ở đây nữa (2026-09-03).
   *
   * Toàn app đã khoá ngang một lần ở `app/_layout.tsx`. Bản cũ khoá ngang lúc
   * vào rồi TRẢ VỀ DỌC trong hàm dọn dẹp - giữ lại là bấm back ra khỏi ván sẽ
   * lật mọi màn còn lại về dọc, đúng cái vừa bỏ đi.
   */

  /*
   * Trạng thái ván do SignalR đẩy nhịp - xem `useGameState`.
   *
   * ⚠️ KHÔNG còn poll 3 giây. Gói tin chỉ là TÍN HIỆU (`PlayerCheckedIn` chẳng
   * hạn chỉ mang tên với id, không mang danh sách ghế), nên hook nghe gói tin
   * để biết KHI NÀO đổi rồi nạp lại `/api/game/{id}/state` - vẫn là nguồn sự
   * thật duy nhất. Vẫn còn một lưới an toàn 20 giây, đừng bỏ.
   *
   * `asBoard` bật vì đúng vai - mỗi điện thoại đều vẽ bàn cờ riêng. Nhưng xem
   * ghi chú trong `gameConnection.ts`: với app nó HIỆN LÀ NO-OP, và như vậy mới
   * đúng, vì app chưa làm việc của bàn cờ.
   */
  /*
   * Câu hỏi VÒNG ĐUA "ai đi trước", tới qua gói `PlayerInstructionQuestion` (67).
   *
   * ⚠️ Gói này KHÁC hẳn mọi gói khác ở chỗ nó MANG SẴN DỮ LIỆU (cả câu hỏi lẫn
   * các đáp án), nên đây là chỗ duy nhất đọc thẳng payload thay vì nạp lại
   * `/api/game/{id}/state` - state không có câu hỏi.
   */
  const [question, setQuestion] = useState<ActiveQuestion | null>(null);

  /**
   * Hỏi hướng đi, tới qua gói `AskMoveDirection` (52) ngay sau khi tung xúc xắc.
   *
   * Cùng loại ngoại lệ với gói 67: nó MANG SẴN dữ liệu (chủ đề mỗi hướng, thông
   * tin battle) mà `/api/game/{id}/state` không có.
   */
  const [direction, setDirection] = useState<DirectionPacket | null>(null);

  /**
   * Nước đi ĐANG DIỄN của một người bất kỳ, tới qua gói 53.
   *
   * ⚠️ Giữ cho tới khi snapshot bắt kịp, đừng xoá theo đồng hồ. `CurrentStepIndex`
   * chỉ đổi sau khi server chạy `HostActionDone`; xoá sớm là quân bị kéo NGƯỢC
   * về ô cũ rồi mới nhảy tới - nhìn như giật hai lần.
   */
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  /**
   * Bước mời dùng thẻ bài, tới qua gói 16 với `Action = 5`.
   *
   * ⚠️ Bước này CHẶN đường tới câu hỏi: server đứng chờ cho tới khi máy gửi
   * `UseCard` hoặc `ActionDone`. Xem `CardChoiceOverlay`.
   */
  const [cardStep, setCardStep] = useState<
    { cards: TurnCard[]; title: string; duration: number } | null
  >(null);

  /**
   * Xúc xắc đang lăn giữa màn hình.
   *
   * `value: null` = chưa biết kết quả. Server KHÔNG gửi mặt xúc xắc cho người
   * chơi (xem `GameSnapshot.Game.DiceOne`), nên giá trị tới muộn qua một lượt
   * nạp lại state - lăn trước, dừng sau.
   */
  const [dice, setDice] = useState<{ value: number | null; rolledBy?: string | null } | null>(null);

  /** Thông báo thoáng qua: người khác vừa dùng thẻ gì. */
  const [notice, setNotice] = useState<string | null>(null);

  /*
   * ============================================================
   * TẠM DỪNG (gói 80 / 81 / 82) - chỉ chủ phòng bấm, mọi người đều thấy
   * ============================================================
   *
   * Hai trạng thái, đúng như hai nút của bản web (`PlayerHomeScreen.cshtml`):
   *
   *   `pausePending` - chủ phòng ĐÃ BẤM, ván chưa dừng. Chữ là câu gói 82
   *                    mang tới ("Game pause once X finishes 3 turns…"); nút
   *                    TIẾP TỤC hiện nhưng XÁM, chưa bấm được - web để
   *                    `disabled` cho tới khi gói 80 tới.
   *   `paused`       - ván dừng THẬT (gói 80, sau `Delay` giây). Khung phủ bàn
   *                    cờ; chủ phòng thấy nút TIẾP TỤC XANH và bấm được.
   *
   * ⚠️ Không suy `paused` thẳng từ `snapshot.Game.IsPauseOnClient`: cờ đó lên
   * TRƯỚC khi gói 80 tới, mà web cố ý đợi `Delay` (3 giây ở đầu lượt) cho bàn
   * cờ chạy nốt hiệu ứng đổi lượt. Snapshot chỉ là LƯỚI AN TOÀN - xem effect
   * phía dưới.
   */
  const [pausePending, setPausePending] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const pauseDelay = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Đang gọi HTTP tạm dừng / tiếp tục - chặn bấm dồn. */
  const pausing = useRef(false);

  /*
   * ============================================================
   * CHAT (gói 89) - tính năng của riêng app, bản web không có
   * ============================================================
   *
   * `chat` là danh sách tin (lịch sử 50 tin + tin tới qua gói); `chatOpen` là
   * khung đang mở; `unread` đếm tin của NGƯỜI KHÁC tới lúc khung đóng - hiện
   * trên nút chat như bản thiết kế. Tin của mình cũng về qua gói 89 (server gửi
   * cho cả người gửi) nên không tự chép vào danh sách.
   */
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const chatOpenRef = useRef(false);
  chatOpenRef.current = chatOpen;

  /**
   * Kết quả câu trả lời vừa gửi - hiện giữa bàn cờ vài giây.
   *
   * Nguồn dữ liệu là HTTP response của chính lượt trả lời (đúng/sai/điểm/sao),
   * hoặc gói `TimeoutQuestion` khi có người chốt câu trước mình.
   */
  const [turnResult, setTurnResult] = useState<TurnResult | null>(null);

  /**
   * ẨN BÀN CỜ (ca **UI-1**).
   *
   * Bàn cờ chiếm nguyên cột trái, và mọi khung trong lượt - câu hỏi, kết quả,
   * thẻ bài - đều phải nép vào giữa nó. Ẩn đi thì các khung đó được cả cột, và
   * `TurnResultOverlay` chuyển sang khổ ĐẦY ĐỦ (ca **UI-2**).
   *
   * ⚠️ Chỉ là chuyện HIỂN THỊ của riêng máy này: không gửi gói nào, không đụng
   * tới server, không ảnh hưởng người khác. Quân vẫn đi, điểm vẫn chạy - bấm
   * hiện lại là thấy bàn cờ ở đúng chỗ nó phải tới.
   *
   * ⚠️ KHÔNG lưu xuống máy. Ẩn bàn cờ là lựa chọn cho MỘT lúc đang cần đọc kỹ,
   * không phải cài đặt lâu dài; mở app lần sau mà bàn cờ biến mất thì người chơi
   * tưởng app hỏng.
   */
  const [boardHidden, setBoardHidden] = useState(false);

  /**
   * Ô 10-SEC CHALLENGE đang mở trên máy NÀY.
   *
   * `null` = không dính gì tới mình. Người tới lượt (người BỊ chấm) cũng không có
   * khung này - họ chỉ ngồi xem, đúng như bản web.
   */
  const [challenge, setChallenge] = useState<{
    phase: ChallengePhase;
    words: string[];
    isJudge: boolean;
    readerNumber: number;
    totalReaders: number;
    /** Đề bài - chỉ có ở nhịp `run` (gói 30), và chỉ MÁY CHỦ PHÒNG nhận. */
    title: string;
    studyText: string;
    appendixType: string;
    challengedName: string;
    judgeName: string;
    totalPlayers: number;
    countdownSeconds: number;
    /** `PlayerId` của gói 30 - phải gửi lại nguyên vẹn kèm gói 43. */
    countdownPlayerId: string;
    /** Máy này có phải TRỌNG TÀI - người được chạy đồng hồ và gửi gói 43 - không. */
    ownsCountdown: boolean;
  } | null>(null);

  /**
   * Ô YOUR CHOICE - danh sách chủ đề để tự chọn. `null` = không ở bước này.
   *
   * ⚠️ Bước này KHÔNG có watchdog ở server (`YourChoiceSquareResolver` không arm
   * gì). Không gửi lại gói 29 là ván treo VĨNH VIỄN.
   */
  const [choice, setChoice] = useState<ChoiceCategory[] | null>(null);

  /** Sao / thẻ đang bay từ giữa bàn cờ về chỗ của nó. */
  const [flying, setFlying] = useState<{ id: number; reward: 'star' | CardKey } | null>(null);

  /**
   * Ai thắng vòng đua - hiện giữa bàn cờ vài giây rồi tắt.
   *
   * `isMe` để đổi câu chữ: người thắng đọc "Bạn nhanh nhất!", người khác đọc tên
   * người thắng.
   */
  const [raceWinner, setRaceWinner] = useState<{ name: string; isMe: boolean } | null>(null);

  /**
   * CURVE BALL vừa áp (gói 90) - hiện tấm Googly cho tới khi server đi tiếp
   * (`DurationInSeconds`, thường 10 giây). Xem `CurveBallOverlay`.
   */
  const [curveBall, setCurveBall] = useState<{ type: string; message: string; seconds: number } | null>(
    null,
  );

  /**
   * BATTLE đang diễn ra trên máy NÀY - lời dẫn trước trận (gói 55).
   *
   * `null` = không dính gì tới mình, hoặc đã qua bước lời dẫn. Người ngoài cuộc
   * không có khung này - họ chỉ nhận gói 54 và thấy một dòng thông báo.
   *
   * ⚠ `amIncumbent` quyết định có nút START hay không, và đọc từ `IncumbentId`
   * của gói chứ không tự suy: người đi thách là người TỚI LƯỢT, nhưng đến khi
   * incumbent thắng thì thứ tự lượt bị xếp lại - suy từ `CurrentTurnPlayerId` là
   * sai ngay sau đó.
   */
  const [battle, setBattle] = useState<{
    challengerId: string;
    incumbentId: string;
    challengerName: string;
    incumbentName: string;
    challengerPoint: number;
    incumbentPoint: number;
    isLeaderBoard: boolean;
    amIncumbent: boolean;
  } | null>(null);

  /**
   * Kết quả trận battle - hiện giữa bàn cờ vài giây rồi tắt.
   *
   * Gồm cả điểm chuyển tay khi có (ván KHÔNG tính leaderboard). Dữ liệu từ gói 58.
   */
  const [battleResult, setBattleResult] = useState<{ name: string; isMe: boolean } | null>(null);

  /**
   * Vòng TUNG XÚC XẮC PHÂN ĐỊNH của battle (gói 91, K57) - sau câu phụ mà vẫn
   * hoà. `null` = không có. Nút ROLL DICE của người tới lượt tung sáng nhờ
   * `battleRollMine` phía dưới; xem `BattleDiceOverlay`.
   */
  const [battleDice, setBattleDice] = useState<BattleDiceState | null>(null);

  /**
   * Video battle đang chiếu (K61): mở màn sau gói 54, người thắng sau gói 58. Mọi ghế
   * cùng chiếu như đang nhìn TV; chiếu xong thì `onDone` gửi gói mà bàn cờ web sẽ gửi
   * (55, hoặc 58 kèm ba trường), server chỉ nhận ghế đầu tiên. `seq` để React dựng
   * lại player khi hai video liền nhau (54 rồi 58 cùng tên không thể xảy ra, nhưng
   * rẻ). Xem `BattleVideoOverlay`.
   */
  const [battleVideo, setBattleVideo] = useState<{
    seq: number;
    kind: 'battle' | 'winner';
    name: string;
    onDone: () => void;
  } | null>(null);
  const battleVideoSeq = useRef(0);
  /**
   * Mốc (ms) mà con xúc xắc đang lăn của vòng phân định sẽ dừng. Gói `tie`/`won`
   * tới CÙNG LÚC với gói `rolled` của defender, phải xếp sau mốc này kẻo tấm
   * "[X] won!" hiện trước khi xúc xắc dừng.
   */
  const battleDiceLandAt = useRef(0);

  /**
   * Ghế này vừa được mở ở một MÁY KHÁC (gói 88).
   *
   * ⚠ Từ lúc này máy này **không nhận được gói nào nữa** — server chỉ có MỘT ô
   * `ConnectionId` cho mỗi người chơi, máy nối sau đã ghi đè lên. Trước đây app không
   * hề hay biết: WebSocket vẫn mở, chấm vẫn xanh, nhìn y hệt "ván đứng"
   * (TEST_CASES mục K23, ca KX-3).
   */
  const [replaced, setReplaced] = useState(false);

  /**
   * Ván đã kết thúc — hiện bảng xếp hạng cuối (ca **UI-7**).
   *
   * Hai đường vào, cần cả hai:
   *   - gói `GameOver` (39): tới ngay lúc ván kết thúc, mang sẵn `GameOverMessage`.
   *   - `snapshot.Game.IsGameOver`: đường CỨU khi máy không nhận được gói đó —
   *     đang rớt mạng, hoặc mở lại app vào một ván đã xong.
   *
   * ⚠ Thiếu đường thứ hai thì người rớt mạng đúng lúc ván kết thúc sẽ vào lại và
   * thấy bàn cờ như đang chơi dở.
   */
  const [gameOver, setGameOver] = useState<{ message: string | null } | null>(null);

  /** Xem `waiting.tsx` - ref chỉ chặn lời gọi ĐANG BAY, không chặn vĩnh viễn. */
  const acking = useRef(false);

  /**
   * `CurrentTurnId` của lượt đã gửi `PlayerGetNextAction` rồi.
   *
   * Một lượt chỉ bắt tay MỘT lần. Gói `StartTurn` có thể tới lại (server phát
   * lại flow khi nối lại), mà gửi hai lần thì server chạy resolver hai lần cho
   * cùng một lượt.
   */
  const nextActionTurn = useRef<string | null>(null);

  /**
   * `CurrentTurnId` mới nhất mà server nói tới.
   *
   * Mọi gói gửi lên đều phải mang nó. Lấy từ GÓI TIN chứ không chỉ từ state:
   * ngay sau một nước đi, state có thể còn là bản cũ (nạp lại là bất đồng bộ),
   * mà gói `ActionDone` thì phải trả lời ngay. Bản web giữ y hệt trong
   * `playerFunc.currentTurnId`.
   */
  const turnId = useRef<string>('');

  /**
   * Id câu hỏi mình ĐÃ trả lời trong lượt này.
   *
   * ⚠️ Cần thật: người tới lượt trả lời SAI thì server phát lại chính câu hỏi đó
   * cho CẢ PHÒNG để tranh trả lời (`OtherPlayersAnswering`) - kể cả người vừa
   * trả lời sai. Không chặn thì họ thấy lại câu vừa sai và trả lời lần hai, mà
   * server đã tính họ "đã thử" rồi.
   */
  const answered = useRef<string>('');

  /**
   * Câu thứ mấy trong trận battle đang diễn - CHỈ để vẽ nhãn.
   *
   * Gói 56 gửi cho người chơi không mang số thứ tự (`currentQuestionIndex` chỉ có
   * trong bản đầy đủ gửi cho bàn cờ), nên app tự đếm. Đặt lại 0 ở gói 54/55
   * và khi trận kết thúc.
   */
  const battleQuestionNo = useRef(0);

  /*
   * Toạ độ MÀN HÌNH của ba mốc mà hiệu ứng phần thưởng cần: bay TỪ giữa bàn cờ,
   * VỀ hàng sao hoặc về ô bài.
   *
   * ⚠️ Phải là toạ độ màn hình (`measureInWindow`), không phải toạ độ tương đối:
   * điểm đi và điểm đến nằm ở hai nhánh khác nhau của cây view (bàn cờ ở cột
   * trái, sao và bài ở cột phải), nên chỉ có hệ toạ độ chung mới nối được.
   */
  const boardBox = useRef<View | null>(null);
  const starBox = useRef<View | null>(null);
  const cardBox = useRef<View | null>(null);
  const spot = useRef<{
    board: { x: number; y: number } | null;
    star: { x: number; y: number } | null;
    card: { x: number; y: number } | null;
  }>({ board: null, star: null, card: null });

  const measureSpot = (key: 'board' | 'star' | 'card', node: View | null) => {
    node?.measureInWindow?.((x, y, w, h) => {
      spot.current[key] = { x: x + w / 2, y: y + h / 2 };
    });
  };

  /**
   * Đang đợi kết quả xúc xắc từ một lượt nạp lại state.
   *
   * Bật lên khi gói `AskMoveDirection` (52) về - lúc đó server đã ghi xong
   * `DiceOne`, nên lượt nạp lại NGAY SAU đó chắc chắn mang số đúng.
   */
  const waitingDice = useRef(false);

  /**
   * Cú tung đang chờ báo "hiệu ứng xong" cho server (`HostDoneRollDice`, 51).
   *
   * ⚠️ CHỈ bật cho lượt thường (`RollDice`), KHÔNG bật cho vòng đua
   * (`RollDiceForTurnClient`) - vòng đua không có bước chọn hướng nên không có
   * gói 51 nào để chờ.
   *
   * Cờ dùng một lần: bật lúc tung, tắt ngay khi đã gửi. Xúc xắc hiện lại vì
   * người chơi vào lại giữa chừng thì không được bắn thêm gói nữa.
   */
  const owesDoneRollDice = useRef(false);

  /**
   * "Được tung" là một QUYỀN DÙNG MỘT LẦN, không phải một trạng thái: server cấp
   * bằng gói 16 `Action = 1` (`PlayerGetNextActionHandler` - "send rolldice to
   * client"), cú bấm tiêu nó. `me.CurrentAction` thì đứng ở `RollDice` suốt phần
   * còn lại của lượt (nước đi, battle, tấm kết quả) - xem ghi chú ở `rollAction`.
   *
   * Đo 2026-09-12 (K64): thua battle, tấm "Maya won the battle" còn trên màn mà
   * nút sáng; bấm thì server tung THẬT lần hai ("YOU ROLLED 3", gói 92 cho cả
   * phòng), rồi gói 51 của máy này rơi vào lượt của Maya thành 52 lạc. Server nay
   * cũng chặn (khoá `RollDiceCountDown-{playerId}`), nhưng máy khách phải tự xám
   * nút, như bản web gỡ nút khỏi màn khi không ở bước tung.
   */
  const [rollGranted, setRollGranted] = useState(false);

  /*
   * Ghế dùng cho KẾT NỐI được đóng băng ở lần mount - đúng ghế màn này mở ra với.
   *
   * ⚠️ Đừng truyền `seat` sống vào `useGameState`. Sau gói 74 (chơi lại),
   * `player.saveSeat(...)` đổi token ghế trong lúc màn này còn đứng 120 ms
   * (đợi khung Game Over gỡ xong mới đổi màn). Token đổi là `useGameConnection`
   * ngắt kết nối cũ và MỞ KẾT NỐI MỚI ngay tại đây, rồi màn unmount cắt nó giữa
   * lúc negotiate - SignalR ghi *"Failed to start the connection: Error: The
   * connection was stopped during negotiation."* và LogBox nổi toast. Đo K53:
   * server thấy đúng ba lượt trong 1,4 giây (ngắt cũ → nối mới → ngắt mới) rồi
   * `waiting.tsx` mới nối thật. Không rớt gói - chỉ là một kết nối thừa - nhưng
   * toast làm tưởng có lỗi thật. Màn này không bao giờ cần đổi ghế khi đang
   * mở: ghế đổi nghĩa là đang rời đi.
   */
  const connSeat = useRef<{ gameId: string; token: string } | null>(null);
  if (!connSeat.current && seat) connSeat.current = { gameId: seat.gameId, token: seat.token };

  const { snapshot, board, connState, connection, refresh } = useGameState({
    gameId: connSeat.current?.gameId ?? null,
    token: connSeat.current?.token ?? null,
    includeBoard: true,
    asBoard: true,
    clientId,
    onPacket: (packet) => {
      /*
       * Ack `PlayerStart` - LƯỚI AN TOÀN ở màn này. Chỗ ack thật là
       * `waiting.tsx`, vì lúc gói 50 tới thì mọi người còn ở đó. Nhưng vào lại
       * ván đang dở thì màn này mở ra trước, và gói 50 sẽ tới thẳng đây.
       */
      if (packet.typeID === TYPE_ID.PlayerStart) {
        if (acking.current || !seat) return;
        acking.current = true;
        void ackFlow('PlayerStart', seat.token).finally(() => {
          acking.current = false;
        });
        return;
      }

      /*
       * ============================================================
       * BẮT TAY ĐẦU LƯỢT - thứ làm nút xúc xắc sáng lên
       * ============================================================
       *
       * ⚠️ ĐỪNG GỠ. Vòng đua kết thúc KHÔNG tự làm nút xúc xắc sáng: server đặt
       * người thắng vào `CaseAction.Start` (3) rồi gửi `StartTurn` (12) kèm
       * `Action: 2` (PlayerGetNextAction), nghĩa là "báo lại đi rồi tôi nói việc
       * kế tiếp". Chỉ sau khi máy gửi gói 16 thì `CurrentAction` mới sang
       * `RollDice` (1) - mà nút xúc xắc lại sáng theo đúng giá trị đó.
       *
       * Chép theo `handleStartTurn` trong `wwwroot/js/playerHandlers.js`.
       *
       * ⚠️ Payload phải đủ ba trường. Gửi payload rỗng thì server ném
       * `NullReferenceException` (`PlayerGetNextActionHandler.cs:176`, log ghi
       * "PlayerGetNextAction reached - CurrentAction is Start - payload is
       * null") và lượt chơi đứng luôn tại đó.
       *
       * Server chỉ gửi `StartTurn` cho ĐÚNG người tới lượt, nên không cần kiểm
       * lại xem có phải lượt mình không.
       */
      if (packet.typeID === TYPE_ID.StartTurn) {
        const id = typeof packet.CurrentTurnId === 'string' ? packet.CurrentTurnId : '';
        if (id) turnId.current = id;

        if (packet.Action !== CASE_ACTION.PlayerGetNextAction) return;
        if (!id || nextActionTurn.current === id) return;
        nextActionTurn.current = id;

        void connection.current?.send(TYPE_ID.PlayerGetNextAction, {
          TurnId: id,
          payload: typeof packet.payload === 'string' ? packet.payload : '',
          isRemoveAllComponent: packet.isRemoveAllComponent ?? true,
        });
        return;
      }

      /*
       * ============================================================
       * BẮT TAY GIỮA LƯỢT - thứ đưa CÂU HỎI LƯỢT THƯỜNG tới
       * ============================================================
       *
       * `ActionDone` (15) = "quân cờ đã đi tới nơi". Bản web trả lời ngay bằng
       * `PlayerGetNextAction`, và server đáp lại bằng gói 16 mang sẵn câu hỏi.
       *
       * ⚠️ Không trả lời là KẸT HẲN. `BoardStepWatchdog` chỉ chạy thay phần việc
       * của BÀN CỜ; bước này là việc của người chơi, không ai làm hộ.
       */
      /*
       * ============================================================
       * NƯỚC ĐI CỦA QUÂN CỜ - gói 53 `MoveDirectionSelected`
       * ============================================================
       *
       * Server phát cho MỌI người chơi, nên ai cũng thấy quân của người tới lượt
       * đi. Bản web không cần thế vì cả phòng nhìn chung một bàn cờ; app thì mỗi
       * máy vẽ một bàn riêng.
       *
       * ⚠️ Nguyên tắc của cả luồng: **diễn xong một hành động rồi mới đi tiếp.**
       * Server đang chờ `HostActionDone` - `MoveDirectionSelectedHandler` arm sẵn
       * lưới đó với 8 giây khi người chơi còn kết nối. Máy của NGƯỜI TỚI LƯỢT
       * phải báo xong; máy người khác chỉ diễn, không báo gì (báo hộ là server
       * ăn hai lần).
       */
      /*
       * ============================================================
       * DÙNG THẺ TRONG CÂU HỎI - gói 25
       * ============================================================
       *
       * Server trả lời bằng CHÍNH gói 25, mang `NextAction` nói phải làm gì:
       *
       *   7 `ReloadQuestion`             Skipper -> thay bằng câu KHÁC cùng chủ đề
       *   8 `RemoveQuestionWrongAnswers` Eliminator -> giữ câu, bớt đáp án sai
       *
       * ⚠️ Đồng hồ ĐỌC TỪ `DurationInSeconds` của gói, đừng giữ số cũ. Nhánh
       * Eliminator server cộng thêm 5 giây (`model.countdown + 5`) - đó là phần
       * thưởng của lá bài, tự tính lại ở máy khách là mất.
       *
       * ⚠️ `answered.current` phải được xoá theo: Skipper đổi sang câu mới, mà
       * chốt chống trả lời trùng đang giữ id câu CŨ.
       */
      if (packet.typeID === TYPE_ID.UseCardInQuestion) {
        const payload = packet.Payload as TurnQuestionPayload | undefined;
        if (!payload?.question?.Id) return;

        const isEliminator = String(packet.Cardname ?? '').toLowerCase() === 'eliminator';
        const dur = typeof packet.DurationInSeconds === 'number' ? packet.DurationInSeconds : 0;

        answered.current = '';
        setQuestion((prev) => ({
          kind: 'turn',
          question: payload.question,
          categories: prev ? prev.categories : categoryChain(payload.category),
          duration: dur > 0 ? dur : (prev?.duration ?? 20),
          /* Giữ nguyên quyền của câu đang chơi - gói 25 cũng gửi kèm nhưng
             `prev` mới là thứ đã qua đúng nhánh ô YOUR CHOICE. */
          isQuestionOwner: prev ? prev.isQuestionOwner : payload.isQuestionOwner === true,
          usedEliminator: (prev?.usedEliminator ?? false) || isEliminator,
        }));
        return;
      }

      if (packet.typeID === TYPE_ID.MoveDirectionSelected) {
        const moverId = typeof packet.PlayerId === 'string' ? packet.PlayerId : '';
        const steps = typeof packet.totalIndex === 'number' ? packet.totalIndex : 0;
        const dir = typeof packet.direction === 'string' ? packet.direction : 'clockwise';
        if (!moverId || steps <= 0) return;

        const moverNow = snapshot?.Players?.find((pl) => pl.Id === moverId);
        setPendingMove({
          playerId: moverId,
          steps,
          direction: dir,
          fromStepIndex: moverNow?.CurrentStepIndex ?? -1,
        });

        /*
         * ⚠ `IsSendDone === false` thì DIỄN XONG LÀ THÔI, không báo ngược.
         *
         * Chỉ có MỘT chỗ gửi cờ này: nước lùi của người THUA battle
         * (`PlayerBattleWinnerHandler`). Nước đó nằm GIỮA lúc trận đấu đang khép, và
         * cái đẩy ván đi tiếp là `BattleNext` chứ không phải `HostActionDone` - gửi
         * thêm là chạy lại `HostActionDoneHandler` giữa chừng. Bàn cờ web đọc đúng
         * cờ này ở `jumpCharacterThroughPath`. Xem GAME_RULES mục 7b.
         */
        const owesDone = packet.IsSendDone !== false;
        const isMine = !!seat && moverId.toLowerCase() === seat.playerId.toLowerCase();
        /* Dư 400ms cho máy yếu; `HOP_MS` là thời gian đi MỘT ô. */
        const walkMs = HOP_MS * steps + 400;
        setTimeout(() => {
          if (isMine && owesDone) {
            void connection.current?.send(TYPE_ID.HostActionDone, {
              TurnId: turnId.current || snapshot?.Game.CurrentTurnId || '',
            });
          }
        }, walkMs);
        return;
      }

      if (packet.typeID === TYPE_ID.ActionDone) {
        if (packet.IsPendingAction) return;

        void connection.current?.send(TYPE_ID.PlayerGetNextAction, {
          TurnId: turnId.current || snapshot?.Game.CurrentTurnId || '',
          payload: typeof packet.data === 'string' ? packet.data : '',
          isRemoveAllComponent: true,
        });
        return;
      }

      /*
       * Server trả lời "việc kế tiếp của bạn là gì".
       *
       * ⚠️ Tên trường trong `Payload` viết THƯỜNG (`question`, `category`), khác
       * gói 67 của vòng đua viết hoa - xem `TurnQuestionPayload`.
       *
       * Hai `Action` cùng dẫn tới màn câu hỏi: `ShowSubCategoriesAndQuestions`
       * (mình tới lượt) và `OtherPlayersAnswering` (tranh trả lời câu của người
       * khác). Bản web cũng dùng chung một màn cho cả hai.
       */
      if (packet.typeID === TYPE_ID.PlayerGetNextAction) {
        const id = typeof packet.CurrentTurnId === 'string' ? packet.CurrentTurnId : '';
        if (id) turnId.current = id;

        if (packet.IsPendingAction) return;

        // Quyền tung dùng một lần - xem `rollGranted`.
        setRollGranted(packet.Action === CASE_ACTION.RollDice);

        /*
         * ⚠️ DỌN SẠCH KHUNG CŨ TRƯỚC KHI MỞ KHUNG MỚI.
         *
         * Bản web làm điều này ở tầng khung: `showBottomComponent()` gọi
         * `removeAllComponents()` rồi mới nạp component kế tiếp
         * (`wwwroot/js/player.js:373`). App thì mỗi khung là một state riêng, nên
         * không dọn là chúng CHỒNG LÊN NHAU.
         *
         * Tony bắt được đúng lỗi này 2026-09-09: ván đã chạy tới bước câu hỏi hết
         * giờ rồi mà khung YOUR CHOICE VẪN CÒN trên màn. Xảy ra rõ nhất khi
         * watchdog chạy bước hộ ở server - server đi tiếp, nhưng máy khách chưa
         * bao giờ được bảo "đóng cái đang mở".
         *
         * Đặt ở đây vì gói 16 là CỬA DUY NHẤT server dùng để giao việc kế tiếp:
         * dọn một chỗ này là phủ mọi bước.
         */
        setChoice(null);
        setChallenge(null);
        setDirection(null);
        setCardStep(null);

        /*
         * Khung CÂU HỎI cũng phải dọn khi gói 16 giao một việc KHÔNG PHẢI câu hỏi
         * (tung xúc xắc, chờ người khác, curve ball…) - tức câu đang mở đã khép ở
         * server mà máy này chưa được báo. Đo K56 (khoá màn 3 phút): đồng hồ JS
         * chạy chậm ~20 giây trong lúc màn khoá, khung tranh trả lời của lượt Maya
         * còn mở khi gói RollDice của lượt Tony tới; nó hết giờ và gửi `IsTimeout`
         * cho câu CŨ - server đọc thành Tony trả lời sai, Tony mất lượt chưa tung.
         * Server nay cũng chặn câu cũ, nhưng khung chết vẫn phải dọn.
         *
         * Giữ nguyên khi Action là 6 / 11 (chính câu hỏi) và trong battle (câu
         * battle đi đường 56, không phải 16).
         */
        if (
          packet.Action !== CASE_ACTION.ShowSubCategoriesAndQuestions &&
          packet.Action !== CASE_ACTION.OtherPlayersAnswering
        ) {
          setQuestion((prev) => (prev && prev.kind !== 'battle' ? null : prev));
        }

        /*
         * ⚠️ TRƯỚC câu hỏi còn một bước nữa: server mời dùng thẻ bài
         * (`ShowCardsBeforeSubCategoryOrQuestion`, Action 5) kèm danh sách bài
         * đang cầm. App chưa có màn dùng bài, nên BỎ QUA bằng đúng gói mà bản
         * web gửi khi người chơi bấm "skip" hoặc để hết giờ: `Pub ActionDone`.
         *
         * Không gửi gì ở đây thì câu hỏi KHÔNG BAO GIỜ TỚI - server đứng chờ ở
         * bước bài. Khi nào làm màn dùng bài thì thay chỗ này, đừng bỏ hẳn.
         */
        if (packet.Action === CASE_ACTION.ShowCardsBeforeSubCategoryOrQuestion) {
          const step = packet.Payload as CardStepPayload | undefined;
          const usable = (step?.cardsToShow ?? []).filter((c) => !c.IsUsed && c.Quantity > 0);

          /*
           * Không còn lá nào dùng được thì đừng bắt người chơi bấm SKIP cho có -
           * gửi luôn `ActionDone` để đi thẳng tới câu hỏi.
           */
          if (usable.length === 0) {
            void connection.current?.send(TYPE_ID.ActionDone, {
              TurnId: turnId.current || snapshot?.Game.CurrentTurnId || '',
              CompletedAction: CASE_ACTION.ShowCardsBeforeSubCategoryOrQuestion,
              data: '',
              IsPendingAction: false,
            });
            return;
          }

          setCardStep({
            cards: usable,
            title: step?.category?.Root?.Title ?? '',
            duration: typeof packet.DurationInSeconds === 'number' ? packet.DurationInSeconds : 15,
          });
          return;
        }

        if (
          packet.Action !== CASE_ACTION.ShowSubCategoriesAndQuestions &&
          packet.Action !== CASE_ACTION.OtherPlayersAnswering
        ) {
          return;
        }

        const payload = packet.Payload as TurnQuestionPayload | undefined;
        if (!payload?.question?.Id) return;

        // Đã trả lời câu này rồi thì thôi - xem ghi chú ở `answered`.
        if (answered.current === payload.question.Id) return;

        setQuestion({
          kind: 'turn',
          question: payload.question,
          categories: categoryChain(payload.category),
          duration: typeof packet.DurationInSeconds === 'number' ? packet.DurationInSeconds : 20,
          isQuestionOwner: payload.isQuestionOwner === true,
          usedEliminator: false,
        });
        return;
      }

      /*
       * Hỏi hướng đi. Tới NGAY SAU cú tung xúc xắc, và nếu không trả lời thì
       * watchdog của server cắt lượt: quân cờ đứng yên, lượt trôi sang người
       * khác. Xem `MoveDirectionOverlay`.
       */
      if (packet.typeID === TYPE_ID.AskMoveDirection) {
        setDirection(packet as unknown as DirectionPacket);
        return;
      }

      /*
       * Server xác nhận đã dùng thẻ. Bản web trả lời bằng `ActionDone` để đi
       * tiếp tới câu hỏi - `handleUseCard` trong `playerHandlers.js`.
       *
       * ⚠️ Thẻ Changer chờ 3 giây trước khi báo xong: server đang đổi chủ đề, và
       * bản web cũng để đúng nhịp đó cho hiệu ứng đổi chủ đề chạy. Gửi ngay thì
       * câu hỏi nhảy ra trước khi người chơi kịp thấy mình vừa dùng thẻ gì.
       */
      if (packet.typeID === TYPE_ID.UseCard) {
        const wait = packet.isChangerCard ? 3000 : 0;
        setTimeout(() => {
          void connection.current?.send(TYPE_ID.ActionDone, {
            TurnId: turnId.current || '',
            CompletedAction: CASE_ACTION.ShowCardsBeforeSubCategoryOrQuestion,
            data: '',
            IsPendingAction: false,
          });
        }, wait);
        return;
      }

      /*
       * ============================================================
       * SERVER NHỜ GỌI HỘ - thứ đẩy ván đi tiếp sau khi trả lời sai
       * ============================================================
       *
       * Server không tự đẩy ván: nó gửi `CallJavascriptFromServer` rồi CHỜ máy
       * khách gửi ngược lại gói thật. Bản web có bảng hàm `callFromServer*`
       * (`playerHandlers.js`); đây là bản rút gọn, chỉ những hàm app đang cần.
       *
       * ⚠️ Không xử lý gói này thì nhánh "người tới lượt trả lời SAI" đứng im:
       * server chờ `ActionDone` để phát câu hỏi cho những người còn lại tranh
       * trả lời, mà chẳng ai gửi. Đã dính đúng vậy - cả phòng treo ở
       * `WaitOtherPlayersAnswer`.
       *
       * `PlaySound` và `RemoveAllComponents` là việc thuần UI của bản web, bỏ
       * qua. Battle và 10-sec challenge chưa làm, thêm sau ở ngay đây.
       */
      if (packet.typeID === TYPE_ID.CallJavascriptFromServer) {
        const fn = packet.FunctionName;
        const id = turnId.current || snapshot?.Game.CurrentTurnId || '';

        if (fn === 'ActionDone' || fn === 'ActionDoneWithPayload') {
          void connection.current?.send(TYPE_ID.ActionDone, {
            TurnId: id,
            // Server hiện BỎ QUA trường này (`ActionDoneRequest` chỉ đọc `data`
            // và `IsPendingAction`), gửi cho khớp bản web thôi.
            CompletedAction: me?.CurrentAction ?? 0,
            data: fn === 'ActionDoneWithPayload' ? JSON.stringify(packet.Payload ?? '') : '',
            IsPendingAction: false,
          });
          return;
        }

        /*
         * Hết 10 giây mà trọng tài chưa bấm gì - server tự phán là HỎNG và nhờ
         * máy khách gửi lại giúp. Bản web làm y hệt
         * (`callFromServerTenSecondsChallengeFail`).
         */
        if (fn === 'TenSecondsChallengeFail') {
          setChallenge(null);
          void connection.current?.send(TYPE_ID.TenSecondsChallenge, { isPass: false });
          return;
        }

        if (fn === 'TurnCompleteCustom') {
          void connection.current?.send(TYPE_ID.TurnComplete, {
            TurnId: id,
            data: JSON.stringify(packet.Payload ?? ''),
            isRemoveAllComponent: packet.isRemoveAllComponent ?? true,
          });
          return;
        }

        /*
         * ⚠ MẮT XÍCH TREO VÁN - đừng bỏ.
         *
         * `WaitStartBattle` hết 20 giây mà incumbent chưa bấm START thì server nhắc
         * bằng chính gói này - và nhánh "người chơi CÒN kết nối" KHÔNG tự chạy
         * bước, nó chỉ nhắc. Bản web đáp bằng `Pub 56`
         * (`callFromServerPlayerBattleStart`); không đáp là ván treo. Xem GAME_RULES
         * mục 7b.
         *
         * Đóng luôn khung lời dẫn: bản web cũng `removeAllComponents()` ở đây.
         */
        if (fn === 'PlayerBattleStart') {
          setBattle(null);
          /* Payload RỖNG, đúng như bản web gửi (`payload: ''`). */
          void connection.current?.send(TYPE_ID.PlayerBattleStart);
          return;
        }

        return;
      }

      /*
       * Có người trả lời trước mình -> đóng màn câu hỏi và báo "trả lời muộn".
       *
       * ⚠️ PHẢI GỬI, không được im lặng: server đợi đủ câu trả lời của mọi người
       * mới khép vòng. Bản web làm y hệt (`handleTriggerTimeoutQuestion` gọi
       * `TooLate()` của màn câu hỏi).
       */
      /*
       * ============================================================
       * Ô 10-SEC CHALLENGE
       * ============================================================
       *
       * Gói 42 `TenSecondsChallengeStart` - server chia vai. Chỉ TRỌNG TÀI và
       * (ở kiểu thử thách "B") những người được chia lời mới nhận gói này;
       * người tới lượt KHÔNG nhận, họ chỉ ngồi chịu chấm.
       *
       * ⚠️ Bấm XONG là gửi LẠI gói 42 với payload RỖNG - xem `onReady` phía
       * dưới. Không gửi là KẸT VÁN: watchdog `TenSecondsChallengeCountDown`
       * chỉ được arm bên trong `TenSecondsChallengeStartHandler`.
       */
      /*
       * Ô YOUR CHOICE (gói 29) - server gửi THẲNG cho người tới lượt.
       *
       * `Categories` là `QuestionCategoryTranslation`: dùng `QuestionCategoryId`
       * làm khoá gửi về, KHÔNG phải `Id` (Id là id của bản dịch).
       */
      if (packet.typeID === TYPE_ID.YourChoice) {
        const list = Array.isArray(packet.Categories) ? packet.Categories : [];
        setChoice(
          list
            .map((c: Record<string, unknown>) => ({
              QuestionCategoryId:
                typeof c?.QuestionCategoryId === 'string' ? c.QuestionCategoryId : '',
              Title: typeof c?.Title === 'string' ? c.Title : '',
            }))
            .filter((c: ChoiceCategory) => c.QuestionCategoryId && c.Title),
        );
        return;
      }

      if (packet.typeID === TYPE_ID.TenSecondsChallengeStart) {
        setChallenge({
          phase: 'assign',
          words: Array.isArray(packet.Words) ? (packet.Words as string[]) : [],
          isJudge: packet.IsJudge === true,
          readerNumber: typeof packet.ReaderNumber === 'number' ? packet.ReaderNumber : 0,
          totalReaders: typeof packet.TotalReaders === 'number' ? packet.TotalReaders : 0,
          title: '',
          studyText: '',
          appendixType: '',
          challengedName: '',
          judgeName: '',
          totalPlayers: 0,
          countdownSeconds: 10,
          countdownPlayerId: '',
          ownsCountdown: false,
        });
        return;
      }

      /*
       * Gói 30 `TenSecondsChallenge` - ĐỀ BÀI + lệnh chạy đồng hồ.
       *
       * ⚠️ Đây là gói của BÀN CỜ: server chỉ gửi cho `game.HostId`, và trong luồng
       * app thì chủ phòng chính là một cái điện thoại. Bản web xử ở
       * `handleTenSecondsChallenge` - hiện đề bài rồi chạy `startCountdown(...)`
       * 10 giây, hết giờ thì gửi gói 43 kèm `PlayerId`.
       *
       * ⚠️ Bỏ qua gói này là NGƯỜI CHƠI KHÔNG BIẾT PHẢI LÀM GÌ - toàn bộ đề bài
       * nằm ở đây, không nằm ở gói 42. Đã dính đúng vậy lần đầu làm ô này.
       */
      if (packet.typeID === TYPE_ID.TenSecondsChallenge) {
        const pid = typeof packet.PlayerId === 'string' ? packet.PlayerId : '';
        setChallenge({
          phase: 'run',
          /*
           * ⚠️ CHỈ MỘT máy được chạy đồng hồ và gửi gói 43: máy của TRỌNG TÀI,
           * tức máy có `seat.playerId` trùng `PlayerId` của gói này. Mọi máy khác
           * cũng nhận gói 30 (để thấy ĐỀ BÀI) nhưng không được đếm - hai máy cùng
           * gửi 43 là server mở màn phán quyết hai lần.
           */
          ownsCountdown: !!seat && pid.toLowerCase() === seat.playerId.toLowerCase(),
          words: [],
          isJudge: false,
          readerNumber: 0,
          totalReaders: 0,
          title: typeof packet.Title === 'string' ? packet.Title : '',
          studyText: typeof packet.StudyText === 'string' ? packet.StudyText : '',
          appendixType: typeof packet.AppendixType === 'string' ? packet.AppendixType : '',
          challengedName: typeof packet.Nickname === 'string' ? packet.Nickname : '',
          judgeName: typeof packet.JudgeNickname === 'string' ? packet.JudgeNickname : '',
          totalPlayers: typeof packet.TotalPlayers === 'number' ? packet.TotalPlayers : 0,
          countdownSeconds:
            typeof packet.CountdownSeconds === 'number' && packet.CountdownSeconds > 0
              ? packet.CountdownSeconds
              : 10,
          countdownPlayerId: pid,
        });
        return;
      }

      /*
       * Gói 43 `TenSecondsChallengeCountDown` - hết 10 giây, tới lúc phán quyết.
       * Server chỉ gửi cho ĐÚNG người vừa gửi gói 42 về.
       */
      if (packet.typeID === TYPE_ID.TenSecondsChallengeCountDown) {
        setChallenge((prev) =>
          prev
            ? { ...prev, phase: 'judge' }
            : {
                phase: 'judge',
                words: [],
                isJudge: true,
                readerNumber: 0,
                totalReaders: 0,
                title: '',
                studyText: '',
                appendixType: '',
                challengedName: '',
                judgeName: '',
                totalPlayers: 0,
                countdownSeconds: 10,
                countdownPlayerId: '',
                ownsCountdown: false,
              },
        );
        return;
      }

      if (packet.typeID === TYPE_ID.TimeoutQuestion) {
        const by = typeof packet.Nickname === 'string' && packet.Nickname ? packet.Nickname : undefined;
        setTurnResult({ kind: 'late', by });
        tooLateQuestion();
        return;
      }

      /*
       * Đủ 5 sao thì server thưởng một lá bài ngẫu nhiên (GAME_RULES mục 6).
       * Số lá trong tay tự cập nhật qua state; đây chỉ là dòng báo cho biết.
       */
      if (packet.typeID === TYPE_ID.EnableCard) {
        if (!packet.isFromStars) return;
        const card = me?.Cards.find((c) => c.Id === packet.selectedCardId)?.CardId;
        setNotice(card ? t('cards.earned', { card }) : t('cards.earnedAny'));
        return;
      }

      /*
       * Vòng đua đã có người thắng. Gói riêng của app - bản web hiện câu này
       * giữa bàn cờ bằng `BoardMessage` (26), nhưng gói đó mang HTML nên app
       * không dùng được, và người THUA còn không nhận được gì.
       */
      /*
       * Người tới lượt vừa tung (gói 92, K59): máy KHÁC cũng cho xúc xắc lăn rồi
       * dừng ở số server bốc, nhãn "{NAME} ROLLED". Máy của người tung bỏ qua -
       * nó đã lăn từ lúc bấm và đọc số qua state (xem `rollDice`). Giữ 3 giây rồi
       * tắt như mọi con xúc xắc khác; không nợ server gói nào.
       */
      if (packet.typeID === TYPE_ID.DiceRolled) {
        if (packet.PlayerId === seat?.playerId) return;
        const value = typeof packet.DiceOne === 'number' ? packet.DiceOne : 0;
        const name = typeof packet.NickName === 'string' ? packet.NickName : '';
        if (value <= 0) return;
        setDice({ value: null, rolledBy: name });
        setTimeout(() => setDice({ value, rolledBy: name }), 1200);
        return;
      }

      if (packet.typeID === TYPE_ID.CurveBall) {
        const type = typeof packet.Type === 'string' ? packet.Type : '';
        const message = typeof packet.Message === 'string' ? packet.Message : '';
        if (!type && !message) return;
        setCurveBall({
          type,
          message,
          seconds: Number((packet as { DurationInSeconds?: number }).DurationInSeconds ?? 10),
        });
        return;
      }

      if (packet.typeID === TYPE_ID.RaceWinner) {
        const name = typeof packet.NickName === 'string' ? packet.NickName : '';
        if (!name) return;
        setRaceWinner({ name, isMe: packet.PlayerId === seat?.playerId });
        return;
      }

      /*
       * Ghế này vừa được mở ở máy khác — xem `TYPE_ID.ConnectionReplaced`.
       *
       * ⚠ DỪNG HẤN, đừng nối lại. Nối lại là hai máy đá qua đá lại nhau vô tận và
       * cả hai cùng hỏng. Server chỉ gửi gói này khi chắc chắn là MÁY KHÁC (hai
       * `clientId` đều biết và khác nhau), nên cùng một máy nối lại sau khi rớt mạng
       * KHÔNG rơi vào đây.
       */
      /*
       * Ván kết thúc. Server gửi gói này cho MỌI người chơi, kèm `GameOverMessage`
       * bốc ngẫu nhiên. Dọn sạch mọi khung đang mở rồi hiện bảng xếp hạng.
       *
       * ⚠ KHÔNG đọc `players` trong gói này mà dùng `snapshot.Players`: gói 39 nằm
       * trong `REFRESH_ON` nên trạng thái đã được nạp lại ngay sau đó, và dùng một
       * nguồn duy nhất thì bảng xếp hạng không thể lệch với bàn cờ phía dưới.
       */
      if (packet.typeID === TYPE_ID.GameOver) {
        setGameOver({ message: (packet as { GameOverMessage?: string }).GameOverMessage ?? null });
        setQuestion(null);
        setBattle(null);
        setChallenge(null);
        setChoice(null);
        setDirection(null);
        setCardStep(null);
        return;
      }

      /*
       * CHƠI LẠI: server vừa dựng ván mới (KeepDurationAndPlayersHandler) và
       * gửi cho TỪNG máy `PlayerId` của ghế mới của chính máy đó. Bản web chỉ
       * việc `window.location = '/player/start/{id}'`; app đổi ghế qua
       * `startAgain` rồi đi thẳng vào phòng chờ - chủ phòng vào lobby (có mã
       * phòng + nút START), người khác vào waiting.
       *
       * ⚠ Gói này tới CẢ máy chủ phòng lẫn máy khách, qua kết nối của ghế cũ.
       * Đừng đóng kết nối trước khi nhận được nó.
       */
      if (packet.typeID === TYPE_ID.Chat) {
        const m = packet as unknown as ChatMessage;
        if (!m.Id || typeof m.Text !== 'string') return;
        setChat((prev) => (prev.some((x) => x.Id === m.Id) ? prev : [...prev, m]));
        if (!chatOpenRef.current && m.PlayerId !== seat?.playerId) setUnread((n) => n + 1);
        return;
      }

      /*
       * TẠM DỪNG - chép theo `handlePauseGameText` / `handlePauseGame` /
       * `handleResumeGameFromPause` trong `playerHandlers.js`.
       */
      if (packet.typeID === TYPE_ID.PauseGameText) {
        /* Chỉ chủ phòng nhận. Rỗng = server vừa xoá (đã tiếp tục). */
        const txt = (packet as { pauseText?: string }).pauseText ?? '';
        setPausePending(txt ? txt : null);
        return;
      }

      if (packet.typeID === TYPE_ID.PauseGame) {
        /*
         * Web: `if (playerFunc.IsGameOver) return;` rồi đợi `Delay` giây mới
         * `removeAllComponents()` + đặt câu "Game paused…". `Delay` = 3 ở đầu
         * lượt (StartTurnHandler), 1 sau battle, 0 ở vòng đua.
         */
        const delay = Number((packet as { Delay?: number }).Delay ?? 0);
        if (pauseDelay.current) clearTimeout(pauseDelay.current);
        pauseDelay.current = setTimeout(
          () => {
            pauseDelay.current = null;
            setPausePending(null);
            setPaused(true);
          },
          Math.max(0, delay) * 1000,
        );
        return;
      }

      if (packet.typeID === TYPE_ID.ResumeGameFromPause) {
        /*
         * Web `location.reload()` - trang mở lại, nối lại hub, gửi `HostResume`
         * và server phát lại flow đang treo. App không mở trang: gỡ khung, nạp
         * lại state, và gửi `HostResume` bằng đúng kết nối đang có. Người tới
         * lượt nhờ đó nhận lại gói StartTurn mà server đã giữ suốt lúc dừng.
         */
        if (pauseDelay.current) {
          clearTimeout(pauseDelay.current);
          pauseDelay.current = null;
        }
        setPausePending(null);
        setPaused(false);
        void refresh();
        void connection.current?.send(TYPE_ID.HostResume);
        return;
      }

      /*
       * Chủ phòng (bàn cờ web) giao ghế cho MÌNH - gói 76 `ChangePlayerAsHost`.
       * App không còn cây hỏi Play again (Tony bỏ 2026-09-11), chỉ nạp lại state
       * cho `me.IsHost` đúng.
       */
      if (packet.typeID === TYPE_ID.ChangePlayerAsHost) {
        void refresh();
        return;
      }

      if (packet.typeID === TYPE_ID.PlayerStartAgain) {
        const newId = typeof packet.PlayerId === 'string' ? packet.PlayerId : '';
        if (!newId || !seat) return;
        void (async () => {
          const res = await startAgain(newId, seat.token);
          if (!res.isSuccess) return;
          await player.saveSeat({
            gameId: res.GameId,
            playerId: res.PlayerId,
            token: res.Token,
            roomCode: null,
            nickname: res.NickName,
            characterId: res.CharacterId,
          });
          /*
           * ⚠️ "Chủ phòng" có HAI nghĩa, và lobby chỉ mở được với nghĩa thứ hai:
           *   - ghế mang cờ `isHost` (đổi được bằng gói 76);
           *   - THIẾT BỊ giữ license, tức `Game.HostId` - mã phòng và nút START
           *     đều đi bằng token license (`ensureRoomCode`, `/start`).
           * Người được giao ghế chủ phòng bằng gói 76 không giữ license, đưa họ
           * vào lobby là dính "This game belongs to another host". Họ vào phòng
           * chờ như mọi người; máy giữ license thấy ván mới ở RESUME GAME và bấm
           * START - đúng vai Main Device của bản web.
           */
          const ownsLicense =
            license.status === 'active' &&
            license.session.hostId.toLowerCase() === (snapshot?.Game?.HostId ?? '').toLowerCase();
          const toLobby = res.IsHost && ownsLicense;
          if (ownsLicense) license.setCurrentGame(res.GameId);
          /*
           * KHÔNG gọi `connection.stop()` ở đây: màn này unmount là hook tự ngắt,
           * còn gọi tay thì đua với vòng nối lại 5 giây của `useGameConnection`
           * và nổ "Failed to start the connection: stopped" trên LogBox.
           */

          /*
           * ⚠️ Đóng khung Game Over TRƯỚC, đổi màn SAU một nhịp. Gọi
           * `router.replace` ngay trong callback gói tin, khi khung Game Over và
           * hộp xác nhận còn đang gỡ, thì Fabric nổ *"addViewAt: The specified
           * child already has a parent"* - màn đỏ, mất luôn ván mới. Đã dính
           * 2026-09-11 ngay lần chạy đầu.
           */
          setGameOver(null);
          setTimeout(() => {
            if (toLobby) {
              router.replace({ pathname: '/lobby', params: { gameId: res.GameId } });
            } else {
              router.replace('/waiting');
            }
          }, 120);
        })();
        return;
      }

      if (packet.typeID === TYPE_ID.ConnectionReplaced) {
        setReplaced(true);
        setQuestion(null);
        setBattle(null);
        setChallenge(null);
        setChoice(null);
        void connection.current?.stop();
        return;
      }

      /*
       * ============================================================
       * BATTLE - bốn gói, xem GAME_RULES mục 7b
       * ============================================================
       *
       * ⚠ Cả bốn gói này bản web chỉ gửi cho BÀN CỜ. Server đã được sửa
       * (2026-09-10) để phát thêm cho ghế người chơi, vì app không có bàn cờ chung.
       */

      /*
       * "Có battle" - gói đầu tiên, CẢ PHÒNG nhận.
       *
       * Người ngoài cuộc chỉ cần một dòng báo; hai đấu thủ sẽ nhận tiếp gói 55.
       * Đặt lại bộ đếm câu ở đây - mỗi trận đếm lại từ đầu.
       */
      if (packet.typeID === TYPE_ID.PlayerBattle) {
        battleQuestionNo.current = 0;

        const challengerId = typeof packet.ChallengerPlayerId === 'string' ? packet.ChallengerPlayerId : '';
        const incumbentId = typeof packet.IncumbentPlayerId === 'string' ? packet.IncumbentPlayerId : '';
        const mine = seat?.playerId ?? '';
        const inIt = same(mine, challengerId) || same(mine, incumbentId);

        /*
         * K61 - video mở màn battle như bàn cờ web (`handlePlayerBattle`): chiếu xong mới
         * gửi 55 `PlayerBattleInstruction`, và đó là thứ mở trận. Không có tên video
         * (server cũ) thì gửi ngay như trước.
         */
        const videoName = typeof packet.BattleVideoName === 'string' ? packet.BattleVideoName : '';
        const afterVideo = () => {
          setBattleVideo(null);
          void connection.current?.send(TYPE_ID.PlayerBattleInstruction);
          if (inIt) return;
          const a = snapshot?.Players?.find((pl) => same(pl.Id, challengerId))?.NickName ?? '';
          const b = snapshot?.Players?.find((pl) => same(pl.Id, incumbentId))?.NickName ?? '';
          if (a && b) setNotice(t('battle.notice', { a, b }));
        };
        if (!videoName) {
          afterVideo();
          return;
        }
        battleVideoSeq.current += 1;
        setBattleVideo({ seq: battleVideoSeq.current, kind: 'battle', name: videoName, onDone: afterVideo });
        return;
      }

      /*
       * Lời dẫn trước trận. Đi cả hai bên, phân vai bằng `IncumbentId`.
       *
       * ⚠ CHỈ incumbent có nút START, và đó là gói mà `WaitStartBattle` đang đợi.
       */
      if (packet.typeID === TYPE_ID.PlayerBattleInstruction) {
        const challengerId = typeof packet.ChallengerId === 'string' ? packet.ChallengerId : '';
        const incumbentId = typeof packet.IncumbentId === 'string' ? packet.IncumbentId : '';
        const mine = seat?.playerId ?? '';
        if (!same(mine, challengerId) && !same(mine, incumbentId)) return;

        battleQuestionNo.current = 0;
        setQuestion(null);
        setBattle({
          challengerId,
          incumbentId,
          challengerName: typeof packet.ChallengerNickname === 'string' ? packet.ChallengerNickname : '',
          incumbentName: typeof packet.IncumbentNickname === 'string' ? packet.IncumbentNickname : '',
          challengerPoint: typeof packet.ChallengerPoint === 'number' ? packet.ChallengerPoint : 0,
          incumbentPoint: typeof packet.IncumbentPoint === 'number' ? packet.IncumbentPoint : 0,
          isLeaderBoard: packet.isLeaderBoard === true,
          amIncumbent: same(mine, incumbentId),
        });
        return;
      }

      /*
       * Một câu hỏi battle. Trường viết HOA (`Question`, `Category`) như gói 67.
       *
       * ⚠ Gói này KHÔNG mang số thứ tự câu - bản đủ có `currentQuestionIndex` chỉ
       * gửi cho bàn cờ. App tự đếm, chỉ để vẽ nhãn nên lệch cũng không hại.
       */
      if (packet.typeID === TYPE_ID.PlayerBattleStart) {
        const data = packet as unknown as QuestionPacket;
        if (!data.Question?.Id) return;
        if (answered.current === data.Question.Id) return;

        setBattle(null);
        setQuestion({
          kind: 'battle',
          question: data.Question,
          categories: categoryChain(data.Category),
          duration: data.DurationInSeconds || 30,
          /* Không dùng thẻ được trong battle - bản web cũng không có đường nào. */
          isQuestionOwner: false,
          usedEliminator: false,
          battleIndex: battleQuestionNo.current,
        });
        battleQuestionNo.current += 1;
        return;
      }

      /*
       * Tổng kết 3 câu - chỗ DUY NHẤT biết ai đúng mấy câu.
       *
       * Bốn danh sách song song theo thứ tự câu: `Questions`, `CorrectAnswers`,
       * `ChallengeAnswers`, `IncumbentAnswers`. Đếm bằng cách so từng ô - độ dài có
       * thể lệch nhau khi trận kết thúc sớm ở câu 2.
       */
      if (packet.typeID === TYPE_ID.PlayerBattleSummary) {
        const correct = Array.isArray(packet.CorrectAnswers) ? (packet.CorrectAnswers as string[]) : [];
        const challengeAnswers = Array.isArray(packet.ChallengeAnswers) ? (packet.ChallengeAnswers as string[]) : [];
        const incumbentAnswers = Array.isArray(packet.IncumbentAnswers) ? (packet.IncumbentAnswers as string[]) : [];
        const challengeId = typeof packet.ChallengeId === 'string' ? packet.ChallengeId : '';
        const mine = seat?.playerId ?? '';
        if (!mine) return;

        const iAmChallenger = same(mine, challengeId);
        const myAnswers = iAmChallenger ? challengeAnswers : incumbentAnswers;
        const theirAnswers = iAmChallenger ? incumbentAnswers : challengeAnswers;

        const count = (list: string[]) =>
          list.reduce((n, id, i) => (correct[i] && same(id, correct[i]) ? n + 1 : n), 0);

        const theirId = iAmChallenger
          ? (typeof packet.IncumbentId === 'string' ? packet.IncumbentId : '')
          : challengeId;
        const theirName = snapshot?.Players?.find((pl) => same(pl.Id, theirId))?.NickName ?? '';

        const score = t('battle.score', {
          mine: String(count(myAnswers)),
          theirs: String(count(theirAnswers)),
          name: theirName,
        });
        /*
         * K57 - chữ chép mockup "Battle - Tie-breaker": sau 3 câu hoà là "It's
         * tie-breaker time!"; sau câu phụ thì "We have a result." hoặc "After one
         * tie-breaker question, no winner was determined." (rồi tới xúc xắc).
         */
        const foundWinner = packet.FoundWinner === true;
        const isTieBreaker = packet.IsTieBreaker === true;
        const headline = isTieBreaker
          ? foundWinner
            ? t('battle.resultTitle')
            : t('battle.noWinner')
          : foundWinner
            ? ''
            : t('battle.tieBreakerTime');
        setNotice(headline ? `${headline} ${score}` : score);
        return;
      }

      /*
       * Hết trận.
       *
       * ⚠ `characterId` là của người THUA (handler dùng nó để biết ai phải lùi ô).
       * Người thắng nằm ở `WinnerId`.
       */
      /*
       * Vòng tung xúc xắc phân định (K57). Mọi máy nhận cùng một gói; người có
       * `RollerId` = mình thì nút ROLL DICE sáng (xem `battleRollMine`).
       * `rolled` thì cho xúc xắc lăn rồi dừng ở số server bốc - cả máy tung lẫn
       * máy xem, đúng như bàn cờ web chạy hiệu ứng cho cả phòng.
       */
      if (packet.typeID === TYPE_ID.BattleDice) {
        const phase = String(packet.Phase ?? '') as BattleDiceState['phase'];
        if (!['start', 'rolled', 'tie', 'won'].includes(phase)) return;
        const next: BattleDiceState = {
          phase,
          attackerId: String(packet.AttackerId ?? ''),
          defenderId: String(packet.DefenderId ?? ''),
          attackerName: typeof packet.AttackerName === 'string' ? packet.AttackerName : '',
          defenderName: typeof packet.DefenderName === 'string' ? packet.DefenderName : '',
          attackerRoll: typeof packet.AttackerRoll === 'number' ? packet.AttackerRoll : null,
          defenderRoll: typeof packet.DefenderRoll === 'number' ? packet.DefenderRoll : null,
          rollerId: typeof packet.RollerId === 'string' ? packet.RollerId : null,
          round: typeof packet.Round === 'number' ? packet.Round : 1,
          winnerId: typeof packet.WinnerId === 'string' ? packet.WinnerId : null,
        };
        /*
         * `rolled`: xúc xắc lăn toàn màn hình 1,2 giây (khung phân định tạm ẩn -
         * xem chỗ render), rồi tắt xúc xắc và khung hiện lại với số vừa ra. Không
         * giữ "YOU ROLLED n" 3 giây như lượt đi thường: số đã nằm trong khung, và
         * 3 giây sau server đã sang gói 58. Đã thấy 2026-09-11: để xúc xắc chạy
         * dưới khung thì con xúc xắc bị khung che, người chơi không thấy nó dừng.
         */
        const now = Date.now();
        if (phase === 'rolled') {
          setDice({ value: null });
          battleDiceLandAt.current = now + 1200;
          setTimeout(() => {
            setDice(null);
            setBattleDice(next);
          }, 1200);
          return;
        }
        // +30ms: gói `won` tới cùng mili-giây với gói `rolled`, hẹn bằng giờ thì
        // hẹn giờ của `won` chạy TRƯỚC và bị `rolled` đè mất WinnerId (thấy 15:41 11/9).
        const wait = battleDiceLandAt.current - now + 30;
        if (wait > 0) setTimeout(() => setBattleDice(next), wait);
        else setBattleDice(next);
        return;
      }

      if (packet.typeID === TYPE_ID.PlayerBattleWinner) {
        battleQuestionNo.current = 0;
        setBattle(null);
        setBattleDice(null);

        const winnerId = typeof packet.WinnerId === 'string' ? packet.WinnerId : '';
        if (!winnerId) return;
        const name = snapshot?.Players?.find((pl) => same(pl.Id, winnerId))?.NickName ?? '';

        /*
         * K61 - video người thắng như bàn cờ web (`handlePlayerBattleWinner`): chiếu xong
         * mới gửi 58 lên với đúng ba trường bàn cờ gửi - gói đó mới LÙI Ô người thua và
         * nối lại lượt. Khung "You won the battle!" hiện sau video, lúc quân cờ lùi.
         */
        const videoName = typeof packet.WinnerVideoName === 'string' ? packet.WinnerVideoName : '';
        const echo = {
          characterId: typeof packet.characterId === 'string' ? packet.characterId : '',
          IsChallenger: packet.IsChallenger === true,
          WinnerId: winnerId,
        };
        const afterVideo = () => {
          setBattleVideo(null);
          setBattleResult({ name, isMe: same(seat?.playerId ?? '', winnerId) });
          void connection.current?.send(TYPE_ID.PlayerBattleWinner, echo);
        };
        if (!videoName) {
          afterVideo();
          return;
        }
        battleVideoSeq.current += 1;
        setBattleVideo({ seq: battleVideoSeq.current, kind: 'winner', name: videoName, onDone: afterVideo });
        return;
      }

      /*
       * Người chơi KHÁC vừa dùng thẻ. Gói riêng của app - xem ghi chú ở
       * `TYPE_ID.PlayerUsedCard`.
       */
      if (packet.typeID === TYPE_ID.PlayerUsedCard) {
        const name = typeof packet.NickName === 'string' ? packet.NickName : '';
        const card = typeof packet.CardId === 'string' ? packet.CardId : '';
        if (!name || !card) return;
        setNotice(t('cards.usedBy', { name, card: card.toUpperCase() }));
        return;
      }

      if (packet.typeID !== TYPE_ID.PlayerInstructionQuestion) return;

      const data = packet as unknown as QuestionPacket;
      if (!data.Question?.Id) return;

      setQuestion({
        kind: 'race',
        question: data.Question,
        categories: categoryChain(data.Category),
        duration: data.DurationInSeconds || 20,
        /* Vòng đua KHÔNG dùng thẻ được: chưa ai tới lượt cả. */
        isQuestionOwner: false,
        usedEliminator: false,
      });
    },
  });

  /*
   * Nối xong thì xin server phát lại flow đang treo (`HostResume`, 21) - y như
   * `playerConnection.js` bản web làm ở mỗi lần nối.
   *
   * ⚠️ ĐÂY MỚI LÀ THỨ ĐƯA CÂU HỎI TỚI MÀN NÀY, đừng gỡ vì tưởng thừa. Gói câu
   * hỏi (67) được bắn ra lúc vòng đua nổ, mà lúc đó máy vẫn đang ở `waiting.tsx`
   * - màn này chỉ mở ra SAU đó, với một kết nối mới toanh và không có gì trong
   * tay. `QuestionForTurnFlowResolver` phát lại gói 67 kèm SỐ GIÂY CÒN LẠI đã
   * trừ, nên đồng hồ vẫn đúng.
   *
   * Cũng là đường cứu khi rớt mạng giữa câu hỏi rồi vào lại.
   */
  useEffect(() => {
    if (connState !== 'connected') return;
    void connection.current?.send(TYPE_ID.HostResume);
  }, [connState, connection]);

  /*
   * Lịch sử chat lúc mở màn (vào lại ván giữa chừng, hoặc đổi ghế Play again).
   * Gộp với tin đã tới qua gói trong lúc HTTP đang bay, khử trùng theo `Id`.
   */
  useEffect(() => {
    if (!seat?.token) return;
    let alive = true;
    void getChatHistory(seat.token).then((res) => {
      if (!alive || !res.isSuccess) return;
      const history = res.messages ?? [];
      setChat((prev) => {
        const seen = new Set(history.map((m) => m.Id));
        return [...history, ...prev.filter((m) => !seen.has(m.Id))];
      });
    });
    return () => {
      alive = false;
    };
  }, [seat?.token]);

  /*
   * Khung chat ĐÓNG LẠI khi có việc phải làm ngay: câu hỏi, chọn hướng, thẻ,
   * Your Choice, 10-sec, battle. Đo K50: đang chat thì câu hỏi tới, khung chat
   * (zIndex 25) đè lên câu hỏi (20) - người chơi mất 60 giây mà không biết.
   */
  useEffect(() => {
    if (question || direction || cardStep || choice || challenge || battle) setChatOpen(false);
  }, [question, direction, cardStep, choice, challenge, battle]);

  const openChat = useCallback(() => {
    setChatOpen(true);
    setUnread(0);
  }, []);

  const sendChat = useCallback(
    (txt: string) => {
      void connection.current?.send(TYPE_ID.Chat, { text: txt });
    },
    [connection],
  );

  /*
   * LƯỚI AN TOÀN cho tạm dừng - state là nguồn sự thật, gói tin chỉ là nhịp.
   *
   * Rớt mạng đúng lúc gói 80/81 bay, hoặc mở lại app giữa lúc ván đang dừng
   * (web reload thì KHÔNG hiện gì cả - `HostResumeHandler` chặn khi
   * `IsGamePause && IsPauseOnClient`), thì snapshot vẫn nói đúng.
   *
   * ⚠️ Cả hai chiều đều ĐỢI 3 GIÂY rồi mới tin state, vì snapshot có thể CŨ hơn
   * gói tin: gói 80 tới thì `IsGamePause` trong snapshot của máy khách có khi
   * vẫn là false (máy khách không nhận 82 nên chưa nạp lại). Gỡ khung ngay lúc
   * đó là gỡ nhầm. Nạp lại rồi đợi: state đổi thì effect chạy lại và huỷ đồng
   * hồ; không đổi thì state đúng là đã khác gói tin, làm theo state.
   *
   * Chỉ lo `paused`; `pausePending` do gói 82 (và tay bấm) quản, không suy từ
   * state - xem `pauseWaiting`.
   */
  useEffect(() => {
    const g = snapshot?.Game;
    if (!g) return;
    const stateSaysPaused = g.IsGamePause && g.IsPauseOnClient;

    if (stateSaysPaused && !paused && !pauseDelay.current) {
      const late = setTimeout(() => {
        setPausePending(null);
        setPaused(true);
      }, 3000);
      return () => clearTimeout(late);
    }

    if (!g.IsGamePause && paused) {
      const late = setTimeout(() => {
        setPaused(false);
        void connection.current?.send(TYPE_ID.HostResume);
      }, 3000);
      void refresh();
      return () => clearTimeout(late);
    }
    return undefined;
  }, [snapshot?.Game?.IsGamePause, snapshot?.Game?.IsPauseOnClient, paused, connection, refresh]);

  /**
   * Nút của chủ phòng đang ở dạng "đã bấm, chờ tới đầu lượt kế".
   *
   * Gộp cả state vì mở lại app giữa lúc chờ thì không có gói 82 nào tới nữa -
   * web sau reload cũng vẽ Resume `disabled` từ `Model.Game.IsGamePause`.
   */
  const pauseWaiting = !paused && (pausePending !== null || snapshot?.Game?.IsGamePause === true);

  useEffect(
    () => () => {
      if (pauseDelay.current) clearTimeout(pauseDelay.current);
    },
    [],
  );

  /*
   * Đường CỨU: máy không nhận được gói 39 (rớt mạng đúng lúc, hoặc mở lại app vào
   * một ván đã xong) thì `IsGameOver` trong trạng thái vẫn nói đúng sự thật.
   *
   * ⚠️ Lấy `GameOverMessage` TỪ STATE, đừng để trống. Bản đầu tôi ghi chú "gói 39
   * mới mang câu đó" rồi truyền `null` - sai, state cũng mang
   * (`GameStateApiController.cs`). Và đường cứu này KHÔNG hiếm như tưởng: hai ván
   * kết thúc thật đo ngày 2026-09-10 đều đi lối này, nên câu ngẫu nhiên của server
   * chưa bao giờ hiện lên - người chơi chỉ thấy câu mặc định của app.
   */
  useEffect(() => {
    if (snapshot?.Game?.IsGameOver && !gameOver) {
      setGameOver({ message: snapshot.Game.GameOverMessage ?? null });
    }
  }, [snapshot?.Game?.IsGameOver, snapshot?.Game?.GameOverMessage, gameOver]);

  /**
   * Rời ván đã kết thúc: bỏ ghế rồi về màn chính.
   *
   * ⚠ PHẢI `clearSeat`. Giữ lại ghế của một ván đã xong thì màn chính hiện
   * RESUME GAME dẫn vào một ván chết - đúng cái bẫy đã ghi ở `src/api/game.ts`
   * ("con trỏ ở máy không hay biết ván đã kết thúc ở nơi khác").
   *
   * Ngắt kết nối trước để server khỏi giữ một socket không còn việc gì.
   */
  const leaveToHome = useCallback(() => {
    void connection.current?.stop();
    void player.clearSeat().finally(() => router.replace('/'));
  }, [connection, player, router]);

  /*
   * ============================================================
   * NÚT BACK CỨNG - hỏi trước khi rời ván (K51, theo designs/LeaveGameModal.tsx)
   * ============================================================
   *
   * Không hỏi thì expo-router pop luôn màn ván: đo K50, bàn phím chat vừa hạ,
   * bấm BACK thêm một cái là văng về Home giữa lượt. Hộp thoại chính là
   * `ConfirmDialog` - bản đã port của LeaveGameModal (cùng viền gradient, nút
   * CANCEL / LEAVE đỏ), nên không dựng thêm component.
   *
   * RỜI VÁN ≠ BỎ GHẾ: chỉ ngắt hub và về Home, ghế vẫn lưu nên Home hiện RESUME
   * GAME để quay lại; ván vẫn chạy nhờ watchdog. `clearSeat` chỉ dành cho lúc
   * hết ván (`leaveToHome`). Ván đã xong thì BACK = BACK TO HOME của khung Game
   * Over.
   *
   * Thứ tự ưu tiên của BackHandler là "đăng ký sau, xử lý trước": `ChatPanel`
   * mount sau nên nuốt BACK khi đang mở chat, tới đây thì chat đã đóng.
   * `useFocusEffect` để listener chỉ sống khi màn này đang ở trên cùng.
   */
  const askingLeave = useRef(false);
  const askLeave = useCallback(async () => {
    if (askingLeave.current) return;
    askingLeave.current = true;
    try {
      const ok = await confirm({
        title: t('game.leaveTitle'),
        message: t('game.leaveBody'),
        confirmLabel: t('game.leaveConfirm'),
        cancelLabel: t('game.leaveCancel'),
        destructive: true,
      });
      if (!ok) return;
      void connection.current?.stop();
      router.replace('/');
    } finally {
      askingLeave.current = false;
    }
  }, [confirm, connection, router, t]);

  const gameOverRef = useRef(gameOver);
  gameOverRef.current = gameOver;
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (gameOverRef.current) leaveToHome();
        else void askLeave();
        return true;
      });
      return () => sub.remove();
    }, [askLeave, leaveToHome]),
  );

  const players = snapshot?.Players ?? [];

  const me: GamePlayer | null =
    players.find(
      (p) => p.Id === seat?.playerId,
    ) ?? null;

  const others = players.filter(
    (p) => p.Id !== seat?.playerId,
  );

  const currentTurnPlayerId =
    snapshot?.Game.CurrentTurnPlayerId ?? '';

  const isMyTurn =
    !!me &&
    currentTurnPlayerId === me.Id;

  /** Tên người TỚI LƯỢT - ô 10-sec cần nó để hỏi "X có làm được không?". */
  const turnPlayerName =
    players.find((p) => p.Id === currentTurnPlayerId)?.NickName ?? '';

  /*
   * Chủ phòng bấm TẠM DỪNG / TIẾP TỤC. Web (`ClickToPauseGame`) đổi nút NGAY
   * rồi mới gọi HTTP, không đợi trả lời; ở đây đặt `pausePending` trước với chữ
   * tạm (server sẽ gửi 82 kèm tên người tới lượt đè lên). Bấm hụt thì trả lại.
   */
  const togglePause = useCallback(async () => {
    if (!seat || pausing.current) return;
    pausing.current = true;
    try {
      if (paused) {
        const res = await resumeGame(seat.token);
        if (!res.isSuccess) setNotice(apiErrorText(res, t));
        /* Gỡ khung khi gói 81 tới, như mọi máy khác - đừng gỡ sớm hơn họ. */
      } else if (!pauseWaiting) {
        setPausePending(t('game.pausePending', { name: turnPlayerName || '…' }));
        const res = await pauseGame(seat.token);
        if (!res.isSuccess) {
          setPausePending(null);
          setNotice(apiErrorText(res, t));
        }
      }
    } finally {
      pausing.current = false;
    }
  }, [seat, paused, pauseWaiting, t, turnPlayerName]);

  /**
   * MENU BA CHẤM (K74, Tony chốt 09-14) - chỉ chủ phòng, một mục: END GAME. Hai
   * lớp hỏi (menu rồi confirm đỏ) là cố ý: nút nằm cạnh chat/pause, dễ chạm nhầm.
   * Bấm END GAME xong KHÔNG tự vẽ GAME OVER - server bắn gói 39 tới mọi ghế kể cả
   * máy này, khung hiện như ván hết giờ (một màn kết thúc duy nhất).
   */
  const [menuOpen, setMenuOpen] = useState(false);
  const endGameFromMenu = useCallback(async () => {
    setMenuOpen(false);
    if (!seat) return;
    const ok = await confirm({
      title: t('game.endGameTitle'),
      message: t('game.endGameBody'),
      cancelLabel: t('common.cancel').toUpperCase(),
      confirmLabel: t('game.endGameConfirm').toUpperCase(),
      destructive: true,
    });
    if (!ok) return;
    const res = await endGame(seat.token);
    if (!res.isSuccess) setNotice(apiErrorText(res, t));
  }, [seat, confirm, t]);


  /**
   * Đơn vị điểm theo bàn: CricTriv gọi là "runs", FootieTriv là "goals", còn lại
   * "points". Bản web quyết định trong chính view kết quả (`CorrectAnswer.cshtml`
   * đọc `boardGameId`), nên khung kết quả của app cũng phải theo.
   */
  /*
   * ⚠️ Đọc từ `board`, KHÔNG phải `snapshot.Board`: `useGameState` tách bàn cờ
   * ra thành giá trị riêng, `snapshot.Board` để rỗng. Lấy nhầm chỗ thì đơn vị
   * điểm rơi về "points" trên bàn CricTriv - đã dính đúng vậy 2026-09-09.
   */
  const boardGameId = board?.BoardGameId ?? '';
  const pointUnit =
    boardGameId === 'crictriv'
      ? t('unit.runs')
      : boardGameId === 'footietriv'
        ? t('unit.goals')
        : t('unit.points');

  /* Dạng số ít - bản web đổi chữ khi điểm cược ở battle bằng 1 ("1 run"). */
  const onePointUnit =
    boardGameId === 'crictriv'
      ? t('unit.run')
      : boardGameId === 'footietriv'
        ? t('unit.goal')
        : t('unit.point');

  /**
   * "Tôi bắt đầu trận đấu" - gửi gói 56, payload RỖNG.
   *
   * ⚠ CHỈ incumbent bấm được nút này (khung tự chặn), và đây chính là gói mà
   * `WaitStartBattle` đang đợi. Đóng khung NGAY, không đợi server: câu hỏi đầu tiên
   * sẽ tới bằng chính gói 56 ở chiều ngược lại.
   */
  const startBattle = () => {
    setBattle(null);
    void connection.current?.send(TYPE_ID.PlayerBattleStart);
  };

  /*
   * ============================================================
   * TUNG XÚC XẮC
   * ============================================================
   *
   * ⚠️ Nút sáng theo `me.CurrentAction`, KHÔNG theo `currentTurnPlayerId`.
   * Server nói rõ lúc nào người này được tung; tới lượt mình nhưng đang trả lời
   * câu hỏi thì `CurrentAction` không phải `RollDice` và tung là vô nghĩa.
   *
   * Hai loại xúc xắc, gói tin KHÁC NHAU:
   *   RollDice (1)        -> TypeID.RollDice            lượt chơi bình thường
   *   RollDiceForTurn (13)-> TypeID.RollDiceForTurnClient  vòng đua "ai đi trước"
   * Gửi nhầm loại thì server bỏ qua và người chơi kẹt lượt.
   */
  const rollAction =
    me?.CurrentAction === CASE_ACTION.RollDice
      ? TYPE_ID.RollDice
      : me?.CurrentAction === CASE_ACTION.RollDiceForTurn
        ? TYPE_ID.RollDiceForTurnClient
        : null;

  /**
   * ⚠️ Lượt THƯỜNG phải kiểm THÊM `isMyTurn`. `CurrentAction` là điều kiện CẦN,
   * không phải điều kiện ĐỦ.
   *
   * Lý do: `CurrentAction` là **giá trị lần `PlayerGetNextAction` gần nhất đã
   * gán cho người này**, không phải "việc được làm bây giờ". Người vừa bị bỏ
   * lượt không nhận `PlayerGetNextAction` nào nữa, nên nó giữ nguyên `RollDice`
   * - `TurnCompleteHandler.cs:136` đặt `game.CurrentAction` (của VÁN) và
   * `NextTurnHandler.cs:113` đặt cho NGƯỜI KẾ, đúng như thiết kế. Nạp lại state
   * cũng KHÔNG đổi gì, nên máy khách phải tự kèm điều kiện tới lượt.
   *
   * Đo thật 2026-09-09 (TEST_CASES mục K12, ca KA-3): mất mạng 60 giây đúng đầu
   * lượt -> `RollDiceCountDown` bỏ lượt của Tony lúc 17:41:00, lượt sang Bot,
   * mà app vẫn để nút sáng. Bấm thì gói tin TỚI server thật:
   *
   *   RolldiceHandler player by turn Bot     <- người tới lượt
   *   RolldiceHandler player by AuthTony     <- người bấm
   *
   * Server chặn đúng (chốt `CurrentTurnId != LastTurnId`, cả phiên không sinh
   * một xúc xắc nào), nên đây là lỗi GIAO DIỆN chứ không phải lỗi luật - nhưng
   * người chơi bấm mà không thấy gì xảy ra thì tưởng app treo.
   *
   * ⚠️ CHỈ áp cho lượt thường. Vòng đua "ai đi trước" (`RollDiceForTurn`) thì
   * `CurrentTurnPlayerId` là `Guid.Empty` - chưa xác định ai đi trước, mà mọi
   * người đều phải tung. Gộp chung một điều kiện là khoá chết vòng đua trên bàn
   * dùng xúc xắc.
   */
  /**
   * ⚠️ Bất kỳ khung nào của MỘT BƯỚC TRONG LƯỢT đang mở thì KHÔNG được tung.
   *
   * ⚠️ ĐỌC KỸ Ý NGHĨA CỦA `CurrentAction`, đừng lặp lại lỗi cũ.
   *
   * `Players.CurrentAction` KHÔNG phải "việc người này được làm ngay bây giờ".
   * Nó là **giá trị mà lần `PlayerGetNextAction` GẦN NHẤT đã gán** - xem
   * `PlayerGetNextActionHandler.cs:68` (`player.CurrentAction = nextAction`) và
   * dòng 155, chỗ nó chọn resolver theo chính giá trị đó. Nói cách khác,
   * `ActionDone` -> `PlayerGetNextAction` -> resolver mới là thứ đẩy trạng thái
   * đi; `CurrentAction` chỉ là dấu vết của bước cuối được giao.
   *
   * Nên trong lúc chờ người chơi chọn chủ đề, `CurrentAction` CÒN LÀ `RollDice`
   * là ĐÚNG THIẾT KẾ, không phải server quên dọn: `YourChoiceSquareResolver` có
   * `shouldSendActionDone => false` một cách cố ý - luồng đứng lại chờ gói 29
   * của người chơi, chưa có `PlayerGetNextAction` nào để gán giá trị mới.
   *
   * Vậy lỗi nằm ở ĐÂY, phía máy khách: đọc `CurrentAction` như thể nó là quyền
   * hành động hiện tại. Đo thật 2026-09-09 (TEST_CASES mục K15): màn chọn chủ đề
   * đang mở mà nút xúc xắc vẫn sáng, bấm vào thì server tung THẬT
   * (`RolldiceHandler response` kèm `CurrentTotalRoll: 2`) - mất quyền chọn chủ
   * đề, tiêu một lượt tung, app kẹt lại ở màn đã vô nghĩa.
   *
   * ⚠️ Chốt `CurrentTurnId != LastTurnId` bên server KHÔNG cứu được - vẫn đúng
   * lượt đó nên nó cho qua. Chỉ máy khách chặn được.
   *
   * Bản web chặn bằng CẤU TRÚC chứ không bằng cờ: `showBottomComponent()` gọi
   * `removeAllComponents()` trước (`wwwroot/js/player.js:373`), nên mở khung nào
   * là nút xúc xắc bị GỠ KHỎI MÀN HÌNH. `stepOverlayOpen` ở đây là bản tương
   * đương của việc đó.
   */
  const stepOverlayOpen =
    question !== null ||
    direction !== null ||
    choice !== null ||
    challenge !== null ||
    cardStep !== null;

  /*
   * Tung xúc xắc PHÂN ĐỊNH battle (K57): tới lượt mình tung thì nút sáng, bấm gửi
   * gói 91 rỗng thay vì 14 - server bốc số và phát lại cho cả phòng. Không nợ
   * gói 51 (không có nước đi nào sau đó).
   */
  const battleRollMine =
    !!battleDice &&
    !battleDice.winnerId &&
    battleDice.phase !== 'rolling' &&
    !!me &&
    battleDice.rollerId === me.Id;

  const canRoll =
    battleRollMine ||
    (rollAction !== null &&
      connState === 'connected' &&
      !stepOverlayOpen &&
      (rollAction !== TYPE_ID.RollDice || (isMyTurn && rollGranted)));

  /*
   * Chặn bấm dồn 2 giây, chép theo `canTriggerRollDice` của bản web.
   *
   * ⚠️ Cần thật: gửi hai lần `RollDice` cho cùng một lượt thì server xử lý cả
   * hai và quân cờ đi hai lần. Dùng `ref` chứ không phải state - đây là cái
   * chốt, không phải thứ để vẽ lại màn hình.
   */
  const lastRoll = useRef(0);

  const rollDice = () => {
    if (!canRoll) return;

    const now = Date.now();
    if (now - lastRoll.current < ROLL_COOLDOWN_MS) return;
    lastRoll.current = now;

    if (battleRollMine) {
      setBattleDice((prev) => (prev ? { ...prev, phase: 'rolling' } : prev));
      setDice({ value: null });
      void connection.current?.send(TYPE_ID.BattleDice);
      return;
    }

    if (rollAction === null) return;

    if (rollAction === TYPE_ID.RollDice) setRollGranted(false);

    // `TurnId` là bắt buộc - thiếu là server không biết gói tin thuộc lượt nào.
    void connection.current?.send(rollAction, {
      TurnId: snapshot?.Game.CurrentTurnId ?? '',
    });

    // Lượt thường thì CHÍNH MÁY NÀY nợ server gói 51 sau khi hiệu ứng chạy xong.
    owesDoneRollDice.current = rollAction === TYPE_ID.RollDice;

    /*
     * ⚠️ Bật cờ NGAY TẠI ĐÂY, đừng đợi gói `AskMoveDirection` (52).
     *
     * Đợi gói 52 là VÒNG LẶP CHẾT: gói 52 chỉ tới sau khi app gửi
     * `HostDoneRollDice` (51), mà app chỉ gửi 51 khi xúc xắc tắt, mà xúc xắc chỉ
     * tắt khi đã có số. Kết quả: lần nào cũng rơi vào lưới an toàn 7 giây và
     * KHÔNG BAO GIỜ ra số. Đã đo đúng vậy trên máy (11:25:29 tung -> 11:25:37
     * mới gửi 51).
     *
     * Đọc sớm an toàn vì `RolldiceHandler` ghi `DiceOne` NGAY lúc nhận gói tung
     * (log `RolldiceHandler 5 - 3 - 0 - 20` cách cú chạm 0,2 giây), nên lượt nạp
     * lại 500ms sau chắc chắn đã thấy số mới.
     */
    waitingDice.current = true;
    setDice({ value: null });

    /*
     * Tự nạp lại state để lấy `DiceOne`.
     *
     * Server KHÔNG gửi mặt xúc xắc cho người tung (dòng gửi trong
     * `RollDiceHandler` bị comment từ lâu), nên không có gói tin nào kích hoạt
     * `REFRESH_ON` ở bước này - không tự gọi thì phải đợi hết lưới an toàn 20
     * giây.
     */
    setTimeout(() => void refresh(), 500);
  };

  /*
   * Kết quả tung: đọc từ state, và CHỈ sau khi gói 52 đã về.
   *
   * `DiceOne` là một trường của cả ván nên nó vẫn giữ số của lượt TRƯỚC cho tới
   * khi server ghi số mới. Không chờ gói 52 thì xúc xắc dừng ngay ở số cũ.
   */
  useEffect(() => {
    if (!dice || dice.value != null) return;
    if (!waitingDice.current) return;

    const rolled = snapshot?.Game.DiceOne ?? 0;
    if (rolled > 0) {
      waitingDice.current = false;
      setDice({ value: rolled });
    }
  }, [dice, snapshot]);

  /*
   * Giữ kết quả trên màn hình rồi mới tắt.
   *
   * ⚠️ 3 giây là con số của BẢN WEB, không phải ước lượng: bàn cờ hẹn
   * `hideAllDice()` sau 3000ms kể từ lúc xúc xắc dừng (`mainHandlers.js`,
   * `handleRollDice`), và trang người chơi cũng ẩn sau đúng 3000ms
   * (`player.js`, `AfterRollDice`). Ngắn hơn thì người chơi chưa kịp đọc số;
   * dài hơn thì ăn vào 15 giây của bước chọn hướng.
   */
  const DICE_HOLD_MS = 3000;

  useEffect(() => {
    if (!dice || dice.value == null) return;
    const done = setTimeout(() => setDice(null), DICE_HOLD_MS);
    return () => clearTimeout(done);
  }, [dice]);

  /*
   * Lưới an toàn: mất gói hoặc mạng chậm thì cũng KHÔNG để xúc xắc quay mãi.
   * Bốn giây là quá đủ - nhịp không có bàn cờ chỉ 2 giây một bước.
   */
  useEffect(() => {
    if (!dice || dice.value != null) return;
    const bail = setTimeout(() => setDice(null), 4000 + DICE_HOLD_MS);
    return () => clearTimeout(bail);
  }, [dice]);

  /*
   * Hiệu ứng xúc xắc xong -> báo server bằng `HostDoneRollDice` (51).
   *
   * ⚠️ ĐÂY MỚI LÀ CHỖ MỞ CỔNG SANG BƯỚC CHỌN HƯỚNG, không phải một gói cho có.
   * `HostDoneRollDiceHandler` gỡ watchdog rồi mới gửi `AskMoveDirection` (52).
   * Vốn dĩ gói này là việc của BÀN CỜ (`handleRollDice` trong `mainHandlers.js`)
   * - luồng app không có Main Device nên trước đây không ai gửi, và watchdog
   * `WaitBoardStep` phải bắn hộ sau 2 giây. Hậu quả: gói 52 tới lúc xúc xắc còn
   * đang lăn, khung chọn hướng nằm dưới viên xúc xắc và đồng hồ 10 giây cháy
   * mất quá nửa trước khi người chơi kịp nhìn.
   *
   * Mỗi điện thoại tự vẽ bàn cờ của mình, nên máy vừa tung ĐÚNG LÀ bàn cờ của
   * nước đi đó và gửi gói này là đúng vai. Chỉ một máy gửi: overlay xúc xắc chỉ
   * hiện cho người vừa tung.
   *
   * Bắn cả khi lưới an toàn 7 giây dọn xúc xắc đi mà chưa có số - lúc đó vẫn
   * phải đẩy lượt tiếp, đừng để nó nằm chờ hết 8 giây của watchdog.
   */
  useEffect(() => {
    if (dice) return;
    if (!owesDoneRollDice.current) return;

    owesDoneRollDice.current = false;
    void connection.current?.send(TYPE_ID.HostDoneRollDice);
  }, [dice, connection]);

  /*
   * Thông báo thắng vòng đua tự tắt sau 4 giây.
   *
   * Lâu hơn thông báo thẻ bài: đây là lúc cả phòng cần hiểu vì sao lượt lại về
   * tay người đó, và ngay sau nó là 10 giây đếm ngược của bàn cờ web.
   */
  /* Tấm curve ball sống đúng bằng lúc bàn cờ giữ nó (server gửi số giây). */
  useEffect(() => {
    if (!curveBall) return;
    const hide = setTimeout(() => setCurveBall(null), Math.max(3, curveBall.seconds) * 1000);
    return () => clearTimeout(hide);
  }, [curveBall]);

  useEffect(() => {
    if (!raceWinner) return;
    const hide = setTimeout(() => setRaceWinner(null), 4000);
    return () => clearTimeout(hide);
  }, [raceWinner]);

  /*
   * Thông báo kết quả tự tắt sau 3.5 giây - đủ đọc, và vẫn kịp nhường chỗ cho
   * bước sau của lượt (nhịp không có bàn cờ là 2 giây một bước, nhưng bước kế
   * tiếp còn phải đi qua watchdog nên không đá nhau).
   */
  useEffect(() => {
    if (!turnResult) return;
    const hide = setTimeout(() => setTurnResult(null), 3500);
    return () => clearTimeout(hide);
  }, [turnResult]);

  /*
   * Kết quả battle tự tắt sau 4 giây - cùng nhịp với thông báo thắng vòng đua.
   *
   * Ngay sau khung này là nước lùi của người thua (gói 53) rồi `BattleNext`, nên
   * đừng để lâu hơn: khung không chặn chạm nhưng vẫn che quân cờ đang đi.
   */
  useEffect(() => {
    if (!battleResult) return;
    const hide = setTimeout(() => setBattleResult(null), 4000);
    return () => clearTimeout(hide);
  }, [battleResult]);

  /* Thông báo "ai vừa dùng thẻ" tự tắt sau 2.5 giây. */
  useEffect(() => {
    if (!notice) return;
    const hide = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(hide);
  }, [notice]);

  /**
   * Dùng thẻ: gửi `UseCard` rồi ĐỢI server xác nhận (gói 22) mới báo xong.
   *
   * ⚠️ Đừng gửi kèm `ActionDone` ở đây. Server phải kịp đổi chủ đề (Changer) hay
   * ghi nhận thẻ trước; báo xong sớm là câu hỏi cũ nhảy ra, thẻ coi như mất.
   */
  const useCard = (cardId: string) => {
    setCardStep(null);
    void connection.current?.send(TYPE_ID.UseCard, { selectedCardId: cardId });
  };

  const skipCard = () => {
    setCardStep(null);
    void connection.current?.send(TYPE_ID.ActionDone, {
      TurnId: turnId.current || snapshot?.Game.CurrentTurnId || '',
      CompletedAction: CASE_ACTION.ShowCardsBeforeSubCategoryOrQuestion,
      data: '',
      IsPendingAction: false,
    });
  };

  /**
   * Chỉ BẢN DEV: nhấn giữ nút xúc xắc để xem lại hiệu ứng mà không cần ván.
   *
   * Hiệu ứng là thứ phải chỉnh đi chỉnh lại, mà dựng một ván chỉ để xem nó lăn
   * thì mất vài phút mỗi lần. Nhấn giữ chạy đúng đường thật (lăn -> dừng ->
   * giữ 3 giây), chỉ khác là con số bốc tại chỗ và KHÔNG gửi gói tin nào.
   *
   * Bản release không có: `__DEV__` là false nên nút vẫn khoá như cũ.
   */
  const previewDice = () => {
    if (!__DEV__ || dice) return;
    waitingDice.current = false;
    setDice({ value: null });
    setTimeout(() => setDice({ value: 1 + Math.floor(Math.random() * 6) }), 1400);
  };

  const cards = countCards(
    me?.Cards ?? [],
  );

  /**
   * Trạng thái hiển thị của từng lá trong cột bên phải.
   *
   * Chép đúng ba nhánh `disablecard` của bản web (GAME_RULES mục 6b). Trước đây
   * chỗ này truyền `dimmed` là hằng `true` cho cả bốn lá - lúc nào cũng mờ, nên
   * nhìn giống luật mà thực ra không mang thông tin gì.
   *
   * ⚠️ Không có câu hỏi thì KHÔNG làm mờ - cả ba nhánh của bản web đều đòi
   * `isShowingQuestion`.
   */
  const handState = (key: CardKey) => {
    const card = (me?.Cards ?? []).find((c) => c.CardId === key);
    const showing = question?.kind === 'turn';

    if (!card || !showing) return { dimmed: false, usable: false, active: false };

    const before = card.ShowBeforeQuestion === true;
    const isElim = key === 'Eliminator';

    /* 1. câu hỏi đã hiện -> lá TRƯỚC-câu-hỏi hết cửa */
    if (before) return { dimmed: true, usable: false, active: false };
    /* 2. không phải chủ câu hỏi -> lá TRONG-câu-hỏi cũng không được */
    if (!question.isQuestionOwner) return { dimmed: true, usable: false, active: false };
    /* 3. Eliminator chỉ một lần cho mỗi câu */
    if (isElim && question.usedEliminator) {
      return { dimmed: true, usable: false, active: true };
    }

    const canUse = !card.IsUsed && card.Quantity > 0;
    return { dimmed: !canUse, usable: canUse, active: false };
  };

  /**
   * Số giây còn lại của câu hỏi, để gửi kèm gói 25.
   *
   * ⚠️ Server lấy chính con số này CỘNG 5 cho nhánh Eliminator, nên gửi sai là
   * người chơi mất phần thưởng. Đồng hồ thật nằm trong `QuestionOverlay`; ở đây
   * tính lại từ mốc bắt đầu để khỏi phải kéo state lên - lệch dưới một giây,
   * không đáng kể với một phép cộng 5.
   */
  const questionAt = useRef(0);
  const secondsLeftNow = () => {
    if (!question) return 0;
    const gone = (Date.now() - questionAt.current) / 1000;
    return Math.max(0, question.duration - gone);
  };

  /*
   * ============================================================
   * TRẢ LỜI CÂU HỎI
   * ============================================================
   *
   * ⚠️ Đóng overlay NGAY khi gửi, không đợi server trả lời. Vòng đua là cuộc
   * đua ai nhanh hơn; giữ màn hình lại chờ HTTP xong là người chơi tưởng máy
   * treo, và câu trả lời thì đã đi rồi.
   *
   * ⚠️ Hết giờ cũng PHẢI gửi. Server đợi câu trả lời của từng người để biết
   * vòng đua đã xong chưa - im lặng là ván đứng đó.
   */
  /**
   * Đọc kết quả server trả về rồi hiện thông báo + bắn hiệu ứng.
   *
   * ⚠️ KHÔNG tự đoán đúng/sai ở client. Đáp án đúng cố ý không được gửi xuống
   * (server `[JsonIgnore]` cả `IsCorrect` lẫn `AnswerExplain`), nên chỉ có
   * response này mới biết.
   */
  const showAnswerResult = (
    res: Awaited<ReturnType<typeof submitAnswer>>,
    /**
     * Chuỗi đáp án vừa bấm. Đúng thì nó CHÍNH LÀ đáp án đúng, và khổ đầy đủ của
     * `TurnResultOverlay` in nó ra - y như bàn cờ web in `Model.questionTitle`.
     * Hết giờ / muộn thì không có gì để in nên bỏ trống.
     */
    answerText = '',
  ) => {
    if (!res.isSuccess) {
      /*
       * Bị từ chối vì có người chốt câu trước. Tên người đó nằm trong thân JSON
       * server trả về - xem `ApiFailure.data`.
       */
      const by = typeof res.data?.answeredBy === 'string' ? res.data.answeredBy : undefined;
      if (res.message?.startsWith('Too late')) setTurnResult({ kind: 'late', by });
      return;
    }

    const result = res as unknown as AnswerResult;

    /*
     * ⚠️ Chỉ `/public/game/submitAnswer` trả về mấy trường này. Vòng đua đi
     * `submitAnswerForTurn` - endpoint khác, response chỉ có `isSuccess` - nên
     * thiếu chốt này thì trả lời ĐÚNG ở vòng đua lại hiện "SAI RỒI".
     * Vòng đua vốn đã có thông báo riêng (`RaceWinnerOverlay`).
     */
    if (typeof result.isCorrect !== 'boolean') return;

    if (!result.isCorrect) {
      setTurnResult({ kind: 'wrong' });
      return;
    }

    /*
     * Sao KHÔNG cộng cho người tranh trả lời (luật của server: chỉ `isMainPlayer`
     * mới được sao). Suy ra bằng chính điểm nhận được thì sai; dựa vào `stars`
     * đổi so với state hiện có cũng sai vì state có thể đã nạp lại. Nên hỏi
     * thẳng: mình có phải người tới lượt không.
     */
    const earnedStar = isMyTurn;
    setTurnResult({
      kind: 'correct',
      point: result.point,
      earnedStar,
      answerText,
      /* Rỗng khi câu chưa có giải thích - khổ đầy đủ tự bỏ dòng đó đi. */
      explain: result.answerExplain ?? '',
    });

    /*
     * Thứ tự bay: SAO trước, THẺ sau. Đủ ngưỡng sao thì server vừa reset sao vừa
     * thưởng bài trong cùng một lượt, và hai vật bay chồng lên nhau thì rối.
     */
    if (earnedStar) fly('star');
    const card = result.card as CardKey | '';
    if (card) setTimeout(() => fly(card), 1500);
  };

  /** Bắn một vật bay từ giữa bàn cờ về chỗ của nó. */
  const fly = (reward: 'star' | CardKey) => {
    measureSpot('board', boardBox.current);
    measureSpot('star', starBox.current);
    measureSpot('card', cardBox.current);
    setFlying({ id: Date.now(), reward });
  };

  /**
   * BA loại câu hỏi, BA endpoint. Gửi nhầm đường thì server tìm không ra lượt và
   * câu trả lời rơi vào hư không - không báo lỗi gì cả. Xem GAME_RULES mục 7b.
   */
  const sendFor = (kind: ActiveQuestion['kind']) =>
    kind === 'race' ? submitAnswerForTurn : kind === 'battle' ? submitAnswerBattle : submitAnswer;

  const answerQuestion = (answerId: string, answerContent: string) => {
    const current = question;
    setQuestion(null);
    if (!current || !seat) return;

    /*
     * ⚠️ Hai loại câu hỏi đi HAI endpoint khác nhau. Gửi nhầm đường thì server
     * không tìm ra lượt và câu trả lời rơi vào hư không - không báo lỗi gì.
     */
    answered.current = current.question.Id;

    void sendFor(current.kind)(
      { questionId: current.question.Id, answerId, questionTitle: answerContent },
      seat.token,
    ).then((res) => {
      // Vòng đua và battle có thông báo riêng - xem ghi chú trong `showAnswerResult`.
      if (current.kind === 'turn') showAnswerResult(res, answerContent);
    });
  };

  /*
   * ⚠️ Đóng overlay NGAY khi gửi, không đợi server. Hết giờ cũng gửi, với
   * `random` - đúng như bản web. Im lặng là lượt treo.
   */
  /*
   * ============================================================
   * Ô 10-SEC CHALLENGE - hai gói máy này nợ server
   * ============================================================
   */

  /**
   * "Tôi đọc xong rồi" - gửi LẠI gói 42, payload RỖNG.
   *
   * ⚠️ Đúng gói 42 chứ không phải gói khác, và payload phải rỗng - bản web gửi
   * y hệt (`PlayerTenSecondsChallengeStart.Submit`). Chính gói này mới arm
   * watchdog đếm 10 giây ở server; im lặng là KẸT VÁN.
   *
   * Đóng khung NGAY, không đợi server: gói 43 sẽ mở lại khung ở nhịp phán quyết.
   */
  /**
   * Chọn xong chủ đề -> gửi gói 29.
   *
   * ⚠️ GUID rỗng là **Pot Luck** (server tự bốc chủ đề + điểm ×2), không phải
   * giá trị hỏng - xem `YourChoiceOverlay`.
   */
  /*
   * Xoá `pendingMove` khi snapshot ĐÃ bắt kịp, không xoá theo đồng hồ.
   *
   * ⚠️ Xoá sớm là quân bị kéo NGƯỢC về ô cũ rồi mới nhảy tới - giật hai lần.
   * Mốc chắc chắn duy nhất là `CurrentStepIndex` của chính người đó đã khác ô
   * xuất phát, tức server đã chạy `HostActionDone` và state mới đã về.
   */
  /* Mốc để tính giây còn lại - xem `secondsLeftNow`. */
  useEffect(() => {
    if (question) questionAt.current = Date.now();
  }, [question?.question.Id, question?.duration]);

  /*
   * ============================================================
   * TỈNH DẬY SAU KHOÁ MÀN / CHUYỂN APP - đồng bộ lại với server (K56)
   * ============================================================
   *
   * Đo NET-11 (khoá màn 3 phút, 2026-09-11): socket KHÔNG rớt, nhưng luồng JS
   * bị Android bóp trong lúc màn tắt - gói tin nằm chờ, lúc mở khoá mới xử lý
   * dồn một lượt. Hậu quả: khung hiện ra là của một bước server đã khép từ lâu
   * (câu hỏi tranh trả lời của lượt trước, bước thẻ bài còn 00:01), đồng hồ
   * đếm từ lúc XỬ LÝ chứ không phải lúc server gửi. Khung chết ấy hết giờ rồi
   * tự gửi trả lời / ActionDone cho một bước không còn tồn tại - lần đầu nó
   * làm Tony mất nguyên lượt (server nay đã chặn câu trả lời cũ, K56).
   *
   * Hai việc lúc tỉnh: nạp state ngay, và gửi `HostResume` để server phát lại
   * bước ĐANG treo của mình với số giây còn lại thật. Khung cũ thì effect đối
   * chiếu phía dưới dọn.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void refresh();
      void connection.current?.send(TYPE_ID.HostResume);
    });
    return () => sub.remove();
  }, [refresh, connection]);

  /*
   * Khung bước chơi phải KHỚP state - state là nguồn sự thật, khung chỉ là cái
   * vẽ ra từ gói tin. Đối chiếu ở mỗi lần state về, nhưng CHỈ với khung đã mở
   * quá 5 giây: gói tin và state nạp trước nó có thể lệch nhau vài trăm mili
   * giây, dọn ngay là dọn nhầm khung vừa mở.
   *
   *   câu hỏi lượt thường (`kind: 'turn'`, cả của mình lẫn tranh trả lời)
   *                         -> `me.CurrentAction` phải là 6 hoặc 11
   *   bước thẻ bài          -> `me.CurrentAction` phải là 5, và đúng lượt mình
   *
   * Vòng đua và battle đi đường riêng, không đụng.
   */
  const cardStepAt = useRef(0);
  useEffect(() => {
    if (cardStep) cardStepAt.current = Date.now();
  }, [cardStep]);

  useEffect(() => {
    const mine = snapshot?.Players.find((p) => p.Id === seat?.playerId);
    if (!mine) return;
    const now = Date.now();
    const myTurn = snapshot?.Game.CurrentTurnPlayerId === mine.Id;

    if (question && now - questionAt.current > 5000) {
      const stale =
        question.kind === 'turn' &&
        mine.CurrentAction !== CASE_ACTION.ShowSubCategoriesAndQuestions &&
        mine.CurrentAction !== CASE_ACTION.OtherPlayersAnswering;
      if (stale) setQuestion(null);
    }

    if (cardStep && now - cardStepAt.current > 5000) {
      if (!myTurn || mine.CurrentAction !== CASE_ACTION.ShowCardsBeforeSubCategoryOrQuestion) {
        setCardStep(null);
      }
    }
    // Chỉ chạy khi state đổi - khung mở ra rồi đợi 5 giây để state kế xác nhận.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  useEffect(() => {
    if (!pendingMove) return;
    const mover = (snapshot?.Players ?? []).find((pl) => pl.Id === pendingMove.playerId);
    if (!mover) return;
    if (mover.CurrentStepIndex !== pendingMove.fromStepIndex) setPendingMove(null);
  }, [snapshot, pendingMove]);

  /**
   * Dùng thẻ TRONG lúc câu hỏi đang hiện - chỉ Skipper và Eliminator (gói 25).
   *
   * Luật đầy đủ ở GAME_RULES mục 6b. Bốn điều kiện của bản web
   * (`handleCardClick`), thiếu một là không được bấm:
   *
   *   1. câu hỏi đang hiện
   *   2. lá còn số lượng
   *   3. KHÔNG phải lá trước-câu-hỏi (Joker/Changer)
   *   4. `isQuestionOwner` - đọc từ server, KHÔNG tự tính
   *
   * Cộng thêm luật riêng của Eliminator: mỗi câu chỉ dùng được MỘT lần.
   *
   * ⚠️ Có hộp xác nhận trước khi gửi, y như bản web - lá bài quý và bấm nhầm
   * thì mất hẳn.
   *
   * ⚠️ `countdown` gửi kèm là số giây CÒN LẠI: server lấy nó cộng 5 cho nhánh
   * Eliminator. Gửi sai là người chơi mất phần thưởng của lá bài.
   */
  const canUseCardInQuestion = (card: GameCard): boolean => {
    if (!question || question.kind !== 'turn') return false;
    if (!question.isQuestionOwner) return false;
    if (card.ShowBeforeQuestion === true) return false;
    if (card.IsUsed || card.Quantity <= 0) return false;
    if (card.CardId?.toLowerCase() === 'eliminator' && question.usedEliminator) return false;
    return true;
  };

  const useCardInQuestion = async (card: GameCard, secondsLeft: number) => {
    if (!canUseCardInQuestion(card)) return;

    const ok = await confirm({
      title: t('card.confirmTitle', { card: card.Name ?? card.CardId ?? '' }),
      confirmLabel: t('card.confirmUse'),
      cancelLabel: t('card.confirmSkip'),
    });
    if (!ok) return;

    void connection.current?.send(TYPE_ID.UseCardInQuestion, {
      selectedCardId: card.Id,
      countdown: Math.max(0, Math.round(secondsLeft)),
    });
  };

  const pickCategory = (questionCategoryId: string) => {
    setChoice(null);
    void connection.current?.send(TYPE_ID.YourChoice, { QuestionCategoryId: questionCategoryId });
  };

  const challengeStart = () => {
    setChallenge(null);
    void connection.current?.send(TYPE_ID.TenSecondsChallengeStart);
  };

  /**
   * Hết 10 giây đếm ngược -> gửi gói 43, y như bàn cờ web làm cuối
   * `startCountdown()`.
   *
   * ⚠️ `PlayerId` phải là cái server gửi kèm gói 30, KHÔNG phải id của máy này:
   * `TenSecondsChallengeCountDownHandler` dùng nó để biết gửi màn phán quyết cho
   * ai. Gửi sai id là trọng tài không bao giờ thấy nút Pass/Fail.
   */
  const challengeCountdownDone = () => {
    const owns = challenge?.ownsCountdown ?? false;
    const pid = challenge?.countdownPlayerId ?? '';
    setChallenge(null);
    if (!owns) return;
    void connection.current?.send(TYPE_ID.TenSecondsChallengeCountDown, { PlayerId: pid });
  };

  /** Phán quyết của trọng tài. Đóng khung ngay khi gửi. */
  const challengeVerdict = (isPass: boolean) => {
    setChallenge(null);
    void connection.current?.send(TYPE_ID.TenSecondsChallenge, { isPass });
  };

  const chooseDirection = (choice: MoveDirection) => {
    setDirection(null);
    void connection.current?.send(TYPE_ID.MoveDirectionSelected, { direction: choice });
  };

  const timeoutQuestion = () => {
    const current = question;
    setQuestion(null);
    if (!current || !seat) return;

    answered.current = current.question.Id;

    /* Bản web có màn riêng cho hết giờ (`PlayerTimeoutAnswer.cshtml`). */
    setTurnResult({ kind: 'timeout' });

    void sendFor(current.kind)(
      { questionId: current.question.Id, answerId: EMPTY_GUID, isTimeout: true },
      seat.token,
    );
  };

  /**
   * Có người khác trả lời trước: đóng màn và báo "muộn rồi".
   *
   * Khác `timeoutQuestion` ở chỗ gửi `IsTooLate` thay vì `IsTimeout` - server
   * đếm hai loại này khác nhau khi quyết định khép vòng trả lời.
   */
  const tooLateQuestion = () => {
    const current = question;
    if (!current || !seat) return;

    setQuestion(null);
    answered.current = current.question.Id;

    void sendFor(current.kind)(
      { questionId: current.question.Id, answerId: EMPTY_GUID, isTooLate: true },
      seat.token,
    );
  };

  /**
   * ============================================================
   * SAFE AREA
   * ============================================================
   */

  const paddingTop = Math.max(
    3,
    insets.top,
  );

  const paddingBottom = Math.max(
    3,
    insets.bottom,
  );

  const stagePad = {
    paddingLeft: 1 + insets.left,
    paddingRight: 2 + insets.right,
    paddingTop,
    paddingBottom,
  };

  if (!seat) {
    return (
      <View
        style={[
          styles.root,
          styles.centerBlock,
        ]}
      >
        <Text style={styles.note}>
          {t('game.noSeat')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/*
        Nền riêng cho chiều NGANG - `main-background-landscape.png`, bản vẽ
        riêng chứ không phải bản dọc xoay 90°. Ảnh 1846×852 (tỉ lệ 2.167) trùng
        khít tỉ lệ máy test khi nằm ngang nên `cover` gần như không cắt gì.
      */}
      <StageBackground />

      <View
        style={[
          styles.stageInner,
          stagePad,
        ]}
      >
        {/* =====================================================
            TOP PLAYER STRIP
            ===================================================== */}

        <View
          style={[
            styles.strip,
            {
              /*
               * ⚠️ Chỉ chiếm chỗ KHI CÓ NGƯỜI. Ván 1 người thì `others` rỗng,
               * đặt chiều cao vô điều kiện là phí trắng ~62dp mà bàn cờ đang
               * cần - `rectangle` bị chặn bởi chiều cao nên thấy rõ ngay.
               */
              height: others.length > 0 ? STRIP_HEIGHT : 0,
              gap: ss(6),
            },
          ]}
        >
          {others.map((p) => {
            const isTurn =
              p.Id ===
              currentTurnPlayerId;

            return (
              <View
                key={p.Id}
                style={
                  styles.stripSlot
                }
              >
                <LinearGradient
                  colors={[
                    lighten(
                      p.PlayerColor ||
                        '#2F8FFF',
                      0.5,
                    ),
                    p.PlayerColor ||
                      '#2F8FFF',
                    lighten(
                      p.PlayerColor ||
                        '#2F8FFF',
                      0.5,
                    ),
                  ]}
                  start={{
                    x: 0,
                    y: 0,
                  }}
                  end={{
                    x: 1,
                    y: 1,
                  }}
                  style={[
                    styles.pillRim,
                    {
                      borderRadius:
                        ss(12),

                      padding:
                        ss(1.5),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.pill,
                      {
                        height: ss(74),

                        gap: ss(5),

                        borderRadius:
                          ss(11),
                      },
                    ]}
                  >
                    <Image
                      source={{
                        uri: characterImageUrl(
                          p.CharacterId,
                        ),
                      }}
                      style={[
                        styles.pillAvatar,
                        {
                          width: ss(50),
                          height: ss(50),
                        },
                      ]}
                      resizeMode="contain"
                    />

                    <View
                      style={[
                        styles.pillInfo,
                        {
                          gap: ss(2),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillName,
                          {
                            height:
                              ss(32),

                            fontSize:
                              ss(13),

                            lineHeight:
                              ss(16),
                          },
                        ]}
                        numberOfLines={
                          2
                        }
                        ellipsizeMode="tail"
                      >
                        {p.IsSetupNickName
                          ? p.NickName
                          : t(
                              'lobby.seatEmpty',
                            )}
                      </Text>

                      {/*
                        ⚠️ Cỡ 9, KHÔNG phải 13. Ngân sách bề NGANG của ô rất
                        chặt và `ss()` chỉ thu theo chiều DỌC - bề ngang ô không
                        đổi. Năm ngôi sao cỡ 13 chiếm ~65dp, vượt phần chữ còn
                        lại và điểm số bị cắt đôi. Đã dính đúng lỗi đó.
                      */}
                      <Stars
                        filled={
                          p.Stars
                        }
                        size={9}
                      />
                    </View>

                    <View
                      style={[
                        styles.pillScoreCol,
                        {
                          minWidth:
                            ss(26),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillScore,
                          {
                            color:
                              p.PlayerColor ||
                              boardColors.blue,

                            fontSize:
                              ss(15),

                            paddingRight:
                              ss(5),
                          },
                        ]}
                        numberOfLines={
                          1
                        }
                      >
                        {p.Point}
                      </Text>
                    </View>
                  </View>

                  {isTurn ? (
                    <TurnPulse
                      radius={ss(11)}
                    />
                  ) : null}
                </LinearGradient>
              </View>
            );
          })}
        </View>

        {/* =====================================================
            MAIN CONTENT
            ===================================================== */}

        <View style={styles.main}>
          {/* ===================================================
              BOARD
              =================================================== */}

          <View
            style={styles.boardCol}
            ref={boardBox}
            onLayout={() => measureSpot('board', boardBox.current)}
          >
            {/*
              Ba trạng thái, đúng thứ tự này:

                1. người chơi ĐÃ ẨN  -> tấm nền trống + lối quay lại
                2. có dữ liệu bàn cờ -> vẽ bàn cờ
                3. còn lại           -> đang tải

              ⚠️ "Đã ẩn" phải đứng TRƯỚC "đang tải": bấm ẩn lúc mạng chậm mà vẫn
              thấy vòng xoay thì người chơi tưởng nút không ăn.
            */}
            {boardHidden ? (
              <Pressable
                onPress={() => setBoardHidden(false)}
                accessibilityRole="button"
                accessibilityLabel={t('board.show')}
                style={styles.boardHidden}
              >
                <Text style={styles.boardHiddenTitle}>{t('board.hiddenTitle')}</Text>
                <Text style={styles.boardHiddenBody}>{t('board.hiddenBody')}</Text>
                <View style={styles.boardHiddenBtn}>
                  <Text style={styles.boardHiddenBtnText}>{t('board.show')}</Text>
                </View>
              </Pressable>
            ) : board ? (
              <BoardCanvas
                board={board}
                players={players}
                pendingMove={pendingMove}
                currentTurnPlayerId={
                  currentTurnPlayerId
                }
                demoJump={DEMO_JUMP}
              />
            ) : (
              <View
                style={
                  styles.boardLoading
                }
              >
                <ActivityIndicator
                  color={
                    boardColors.blue
                  }
                  size="large"
                />
              </View>
            )}

            {/*
              ⚠️ Câu hỏi đè lên ĐÚNG VÙNG BÀN CỜ, không phủ cả màn hình. Vì vậy
              nó là con của `boardCol` chứ không nằm cuối cây: dải người chơi
              trên cùng và cột phải (mã phòng, bài, xúc xắc) vẫn nhìn thấy trong
              lúc trả lời. Kéo nó ra ngoài là mất hết chỗ đó.

              ⚠️ Và nó phải nằm SAU `BoardCanvas` trong cây, không phải trước.
              Trên Android, `zIndex` chỉ đổi thứ tự VẼ chứ không đổi thứ tự nhận
              chạm - đặt trước thì khung hiện lên đúng nhưng mọi cú chạm rơi
              xuống bàn cờ phía dưới: chọn đáp án không ăn, SUBMIT mãi tối. Đã
              dính đúng vậy trên máy thật.
            */}
            {direction ? (
              <MoveDirectionOverlay packet={direction} onSelect={chooseDirection} />
            ) : null}

            {raceWinner ? (
              <RaceWinnerOverlay name={raceWinner.name} isMe={raceWinner.isMe} />
            ) : null}

            {curveBall ? (
              <CurveBallOverlay
                boardGameId={boardGameId}
                /*
                 * Câu theo ngôn ngữ app nếu biết kiểu; không biết thì in nguyên
                 * câu server gửi (cùng nguồn với bàn cờ web).
                 */
                message={
                  `curve.${curveBall.type}` in en
                    ? t(`curve.${curveBall.type}` as TranslationKey)
                    : curveBall.message
                }
              />
            ) : null}

            {turnResult ? (
              <TurnResultOverlay
                result={turnResult}
                /* Bản web luôn nêu TÊN người vừa trả lời, không nói trống không. */
                name={me?.NickName ?? ''}
                unit={pointUnit}
                /*
                 * Bàn cờ còn hiện thì khung phải gọn - nó đang nằm ĐÈ lên bàn cờ.
                 * Ẩn bàn cờ rồi thì cả cột trái trống, khung lấy khổ của bàn cờ
                 * web: đáp án đúng + giải thích. Xem `TurnResultOverlay`.
                 */
                compact={!boardHidden}
              />
            ) : null}

            {cardStep ? (
              <CardChoiceOverlay
                cards={cardStep.cards}
                categoryTitle={cardStep.title}
                durationSeconds={cardStep.duration}
                onUse={useCard}
                onSkip={skipCard}
              />
            ) : null}

            {choice ? (
              <YourChoiceOverlay categories={choice} onPick={pickCategory} />
            ) : null}

            {challenge ? (
              <TenSecondsChallengeOverlay
                phase={challenge.phase}
                words={challenge.words}
                isJudge={challenge.isJudge}
                readerNumber={challenge.readerNumber}
                totalReaders={challenge.totalReaders}
                title={challenge.title}
                studyText={challenge.studyText}
                appendixType={challenge.appendixType}
                /* Rỗng ở nhịp `assign` thì lùi về tên người tới lượt. */
                challengedName={challenge.challengedName || turnPlayerName}
                judgeName={challenge.judgeName}
                totalPlayers={challenge.totalPlayers}
                countdownSeconds={challenge.countdownSeconds}
                onStart={challengeStart}
                onCountdownDone={challengeCountdownDone}
                onVerdict={challengeVerdict}
              />
            ) : null}

            {question ? (
              <QuestionOverlay
                question={question.question}
                categories={question.categories}
                durationSeconds={question.duration}
                /*
                 * Vòng đua có nhãn cố định ở ô lớn và chuỗi chủ đề tụt xuống một
                 * bậc. Lượt thường BỎ TRỐNG `banner`: ô lớn chính là chủ đề gốc,
                 * ô nhỏ là chủ đề con.
                 */
                /*
                 * Battle cũng cần nhãn: ba câu liên tiếp cùng chủ đề, không đếm thì
                 * người chơi không biết đang ở đâu. Từ câu thứ 4 trở đi là sudden
                 * death - luật đổi hẳn thành "ai đúng TRƯỚC", phải nói ra.
                 */
                banner={
                  question.kind === 'race'
                    ? t('question.race')
                    : question.kind === 'battle'
                      ? (question.battleIndex ?? 0) >= 3
                        ? t('battle.tieBreaker')
                        : t('battle.question', { index: String((question.battleIndex ?? 0) + 1) })
                      : null
                }
                onAnswer={answerQuestion}
                onTimeout={timeoutQuestion}
              />
            ) : null}

            {battle ? (
              <BattleOverlay
                challengerName={battle.challengerName}
                incumbentName={battle.incumbentName}
                challengerPoint={battle.challengerPoint}
                incumbentPoint={battle.incumbentPoint}
                isLeaderBoard={battle.isLeaderBoard}
                amIncumbent={battle.amIncumbent}
                unit={pointUnit}
                oneUnit={onePointUnit}
                onStart={startBattle}
              />
            ) : null}

            {battleResult ? (
              <BattleResultOverlay name={battleResult.name} isMe={battleResult.isMe} />
            ) : null}

            {battleDice && !battleResult && !dice ? (
              <BattleDiceOverlay state={battleDice} meId={seat?.playerId ?? ''} />
            ) : null}

            {notice ? (
              <View style={styles.notice} pointerEvents="none">
                <Text style={styles.noticeText} numberOfLines={1}>
                  {notice}
                </Text>
              </View>
            ) : null}

            {chatOpen ? (
              <ChatPanel
                messages={chat}
                meId={seat?.playerId ?? ''}
                onSend={sendChat}
                onClose={() => setChatOpen(false)}
              />
            ) : null}

            {/*
              Chữ gói 82 - web đặt cạnh hai nút ở thanh trên; cột phải của app
              không có chỗ cho một câu dài nên đặt ở đỉnh bàn cờ. Chỉ chủ phòng
              nhận gói này nên chỉ máy chủ phòng thấy.
            */}
            {pausePending && !paused ? (
              <View style={styles.pauseStrip} pointerEvents="none">
                <Text style={styles.pauseStripText} numberOfLines={2}>
                  {pausePending}
                </Text>
              </View>
            ) : null}

            {/* Ván dừng thật - đè lên mọi khung khác của cột này. */}
            {paused && !gameOver ? <PauseOverlay isHost={me?.IsHost === true} /> : null}

            {/*
              * Ghế bị mở ở máy khác: che kín và CHẶN chạm.
              *
              * Đây là khung DUY NHẤT cố ý chặn tương tác hoàn toàn — mọi nút bên dưới giờ
              * đều vô nghiĩa, bấm chỉ tổ tưởng máy treo. Thà nói thật.
              */}
            {replaced ? (
              <View style={styles.replaced}>
                <Text style={styles.replacedTitle}>{t('conn.replacedTitle')}</Text>
                <Text style={styles.replacedBody}>{t('conn.replacedBody')}</Text>
              </View>
            ) : null}
          </View>

          {/* ===================================================
              RIGHT SIDE
              =================================================== */}

          <View style={styles.sideCol}>
            {/* ROOM + PAUSE + MENU */}

            <View
              style={styles.sideHeader}
            >
              <Text
                style={styles.roomText}
                numberOfLines={1}
              >
                {seat.roomCode
                  ? t('waiting.room', {
                      code: seat.roomCode,
                    })
                  : t('game.title')}
              </Text>

              {/*
                Chấm trạng thái SignalR. Xanh = đang nối, vàng = đang nối lại,
                đỏ = mất kết nối (lúc đó chỉ còn lưới an toàn 20 giây).
              */}
              <View
                style={[
                  styles.netDot,
                  connState === 'connected'
                    ? styles.netOk
                    : connState === 'connecting' || connState === 'reconnecting'
                      ? styles.netBusy
                      : styles.netDead,
                ]}
              />

              {/*
                ẨN / HIỆN BÀN CỜ (ca **UI-1**).

                ⚠️ Nút menu (ba chấm) bên phải cùng mới chỉ là chỗ trống chưa có
                mã, cố ý để nguyên `View`. Đừng chép kiểu dáng của nó: nút này
                phải nhìn ra là bấm được, nên viền xanh thay vì đỏ, và ĐỔI MÀU
                khi đang ẩn để người chơi biết bàn cờ biến mất là do mình bấm,
                không phải lỗi.
              */}
              <Pressable
                onPress={() => setBoardHidden((hidden) => !hidden)}
                accessibilityRole="button"
                accessibilityState={{ selected: boardHidden }}
                accessibilityLabel={boardHidden ? t('board.show') : t('board.hide')}
                /* Vùng chạm nới ra ngoài viền: nút chỉ 30×28. */
                hitSlop={8}
                style={({ pressed }) => [
                  styles.iconBtn,
                  boardHidden ? styles.boardBtnOff : styles.boardBtn,
                  pressed && styles.iconBtnPressed,
                ]}
              >
                <View style={styles.boardGlyph}>
                  {[0, 1, 2, 3].map((cell) => (
                    <View
                      key={cell}
                      style={[
                        styles.boardGlyphCell,
                        boardHidden && styles.boardGlyphCellOff,
                      ]}
                    />
                  ))}
                </View>

                {/* Gạch chéo khi đang ẩn - cùng quy ước với biểu tượng "tắt". */}
                {boardHidden ? <View style={styles.boardGlyphSlash} /> : null}
              </Pressable>

              {/*
                TẠM DỪNG / TIẾP TỤC - CHỈ chủ phòng có, y như bản web chỉ vẽ
                `#pauseSection` khi `Model.Player.isHost`. Ba dạng, chép theo
                hai nút của web:

                  đang chơi     -> hai gạch đỏ, bấm = tạm dừng
                  đã bấm, chờ   -> tam giác XÁM, `disabled` (web: Resume
                                   `disabled` + nền #7F7F7F cho tới gói 80)
                  đã dừng thật  -> tam giác XANH (#00B050 bên web), bấm = tiếp tục
              */}
              {me?.IsHost ? (
                <Pressable
                  onPress={() => void togglePause()}
                  disabled={pauseWaiting}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: pauseWaiting }}
                  accessibilityLabel={paused || pauseWaiting ? t('game.resume') : t('game.pause')}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    paused && styles.resumeBtn,
                    pauseWaiting && styles.resumeBtnWaiting,
                    pressed && styles.iconBtnPressed,
                  ]}
                >
                  {paused || pauseWaiting ? (
                    <PlayIcon color={paused ? boardColors.green : 'rgba(198,212,240,0.45)'} />
                  ) : (
                    <View style={styles.pauseBars}>
                      <View style={styles.pauseBar} />
                      <View style={styles.pauseBar} />
                    </View>
                  )}
                </Pressable>
              ) : null}

              {/* MENU BA CHẤM - chỉ chủ phòng (K74). Khách không có mục nào nên không vẽ nút. */}
              {me?.IsHost && !gameOver ? (
                <Pressable
                  onPress={() => setMenuOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('game.menu')}
                  hitSlop={8}
                  style={({ pressed }) => [styles.iconBtn, styles.menuBtn, pressed && styles.iconBtnPressed]}
                >
                  <View style={styles.dots}>
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                  </View>
                </Pressable>
              ) : null}
            </View>

            <GameMenuSheet
              visible={menuOpen}
              onClose={() => setMenuOpen(false)}
              onEndGame={() => void endGameFromMenu()}
              labels={{ endGame: t('game.endGame'), cancel: t('common.cancel') }}
            />

            {/* CURRENT PLAYER */}

            {me ? (
              <View
                style={[
                  styles.meRow,
                  isMyTurn &&
                    styles.meRowTurn,
                ]}
              >
                {isMyTurn ? (
                  <TurnPulse radius={12} />
                ) : null}

                <Image
                  source={{
                    uri: characterImageUrl(
                      me.CharacterId,
                    ),
                  }}
                  style={
                    styles.meAvatar
                  }
                  resizeMode="contain"
                />

                <View
                  style={styles.meInfo}
                >
                  <Text
                    style={
                      styles.meName
                    }
                    numberOfLines={1}
                  >
                    {me.NickName}
                  </Text>

                  <View
                    style={
                      styles.meStarsRow
                    }
                    ref={starBox}
                    onLayout={() => measureSpot('star', starBox.current)}
                  >
                    <Stars
                      filled={me.Stars}
                      size={14}
                    />

                    {me.IsHost ? (
                      <CrownIcon
                        size={15}
                      />
                    ) : null}
                  </View>
                </View>

                <View
                  style={
                    styles.meScoreBox
                  }
                >
                  <Text
                    style={
                      styles.meScore
                    }
                  >
                    {me.Point}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* CARDS */}

            <View
              style={styles.handGrid}
              ref={cardBox}
              onLayout={() => measureSpot('card', cardBox.current)}
            >
              {[
                CARD_ORDER.slice(
                  0,
                  2,
                ),
                CARD_ORDER.slice(2),
              ].map((row, i) => (
                <View
                  key={i}
                  style={
                    styles.handRow
                  }
                >
                  {row.map((key) => {
                    const st = handState(key);
                    const card = (me?.Cards ?? []).find((c) => c.CardId === key);
                    return (
                      <HandTile
                        key={key}
                        cardKey={key}
                        label={t(
                          `game.card.${key}` as 'game.card.Joker',
                        )}
                        count={cards[key]}
                        dimmed={st.dimmed}
                        usable={st.usable}
                        active={st.active}
                        onPress={
                          st.usable && card
                            ? () => void useCardInQuestion(card, secondsLeftNow())
                            : undefined
                        }
                        compact
                      />
                    );
                  })}
                </View>
              ))}
            </View>

            {/* BOTTOM */}

            <View
              style={styles.bottomRow}
            >
              {/* CHAT - mở khung đè lên cột bàn cờ; chấm đỏ = số tin chưa đọc (thiết kế). */}
              <Pressable
                onPress={openChat}
                accessibilityRole="button"
                accessibilityLabel={t('chat.title')}
                style={({ pressed }) => [
                  styles.squareBtn,
                  chatOpen && styles.squareBtnOn,
                  pressed && styles.iconBtnPressed,
                ]}
              >
                <ChatIcon size={22} />
                {unread > 0 ? (
                  <View style={styles.unread} pointerEvents="none">
                    <Text style={styles.unreadText}>{unread > 99 ? '99+' : String(unread)}</Text>
                  </View>
                ) : null}
              </Pressable>

              {/*
                Chưa tới lượt thì XÁM và không bấm được; tới lượt thì sáng.
                `disabled` đi theo đúng `canRoll` để không có cảnh nút trông
                bấm được mà bấm không ăn.
              */}
              <Pressable
                onPress={rollDice}
                onLongPress={previewDice}
                /*
                 * ⚠️ Bản dev để nút BẤM ĐƯỢC cả khi chưa tới lượt, chỉ để nhấn
                 * giữ xem lại hiệu ứng xúc xắc. Bấm thường vẫn không làm gì -
                 * `rollDice` tự chặn theo `canRoll`.
                 */
                disabled={!canRoll && !__DEV__}
                style={({ pressed }) => [
                  styles.diceBlock,
                  canRoll && styles.diceBlockLive,
                  pressed && canRoll && styles.dicePressed,
                ]}
              >
                <View
                  style={[
                    styles.diceBtn,
                    canRoll &&
                      styles.diceBtnLive,
                  ]}
                >
                  <Dice3D size={34} />
                </View>

                <Text
                  style={[
                    styles.diceLabel,
                    canRoll &&
                      styles.diceLabelLive,
                  ]}
                >
                  {t('game.rollDice')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {/*
        ⚠️ Xúc xắc nằm ở GỐC màn hình, không nằm trong khung bàn cờ như các
        overlay khác: nó phải hiện giữa MÀN HÌNH. Khung bàn cờ chỉ chiếm nửa
        trái, đặt trong đó thì con xúc xắc lệch hẳn sang một bên.
      */}
      {dice ? <DiceRollOverlay value={dice.value} rolledBy={dice.rolledBy} /> : null}

      {/*
        ⚠️ Ván đã kết thúc: ở GỐC MÀN HÌNH như con xúc xắc. Đặt trong khung bàn cờ
        là SAI và đã thấy tận mắt lúc kiểm 2026-09-10: khung chỉ che nửa trái, cột
        phải vẫn hiện và **ROLL DICE vẫn bấm được** trên một ván đã xong.

        Khung này CHẶN hết tương tác, có chủ đích — ván xong thì mọi nút đều vô
        nghĩa. Đặt SAU con xúc xắc để nếu lỡ cả hai cùng hiện thì nó nằm trên;
        `zIndex` của nó cũng cao hơn.
      */}
      {/* K61: video battle ở GỐC màn hình, che cả hai cột (TV chiếu toàn màn). */}
      {battleVideo ? (
        <BattleVideoOverlay
          key={battleVideo.seq}
          kind={battleVideo.kind}
          name={battleVideo.name}
          onDone={battleVideo.onDone}
        />
      ) : null}

      {gameOver ? (
        <GameOverOverlay
          gameId={seat?.gameId ?? null}
          meId={seat?.playerId ?? null}
          message={gameOver.message}
          /*
           * ⚠️ Bảng xếp hạng CHỈ thuộc thể thức Leaderboard Challenge, và cờ nhận
           * ra nó là `TotalRollDice > 0` — đúng thứ server đọc khi quyết định có
           * ghi `RecordScores` không, và đúng thứ bàn cờ web đọc khi quyết định có
           * hiện nút Leaderboard không. Ván tính giờ không ghi bản ghi nào nên
           * chẳng có gì để xếp hạng.
           */
          isLeaderboard={(snapshot?.Game?.TotalRollDice ?? 0) > 0}
          onLeave={leaveToHome}
        />
      ) : null}

      {/*
        Vật bay cũng ở GỐC màn hình như xúc xắc: nó đi từ khung bàn cờ (cột
        trái) sang cột phải, nên phải nằm ngoài cả hai.
      */}
      {flying && spot.current.board ? (
        <FlyingReward
          key={flying.id}
          from={spot.current.board}
          to={
            (flying.reward === 'star' ? spot.current.star : spot.current.card) ??
            spot.current.board
          }
          reward={flying.reward}
          onDone={() => setFlying(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#04040E',
  },

  stageInner: {
    flex: 1,

    /**
     * ⚠️ Nếu sửa số này thì nhớ sửa STAGE_GAP phía trên.
     */
    gap: STAGE_GAP,
  },

  /* ===========================================================
     PLAYER STRIP
     =========================================================== */

  strip: {
    flexDirection: 'row',
    justifyContent: 'center',

    /** gap thực tế được override theo `ss()`. */
    gap: 6,
  },

  stripSlot: {
    width: `${100 / STRIP_SLOTS}%`,
  },

  pillRim: {
    borderRadius: 12,
    padding: 1.5,
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 5,

    height: 74,

    paddingHorizontal: 0,

    borderRadius: 11,

    backgroundColor: '#080C1E',
  },

  pillAvatar: {
    width: 50,
    height: 50,
  },

  pillInfo: {
    flex: 1,

    gap: 2,

    justifyContent: 'center',
  },

  pillScoreCol: {
    justifyContent: 'center',
    minWidth: 26,
  },

  pillName: {
    height: 32,

    fontSize: 13,

    lineHeight: 16,

    fontWeight: '700',

    color: '#EAF1FF',
  },

  pillScore: {
    fontSize: 15,

    fontWeight: '800',

    textAlign: 'right',

    paddingRight: 5,
  },

  /* ===========================================================
     MAIN
     =========================================================== */

  main: {
    flex: 1,

    flexDirection: 'row',

    gap: 8,
  },

  boardCol: {
    flex: 1,

    justifyContent: 'center',
  },

  /* ── ẨN BÀN CỜ (UI-1) ─────────────────────────────────────────────────── */
  iconBtnPressed: { opacity: 0.6 },
  boardBtn: {
    borderColor: 'rgba(96,165,250,0.6)',

    backgroundColor: 'rgba(8,22,48,0.75)',
  },
  boardBtnOff: {
    borderColor: 'rgba(251,191,36,0.75)',

    backgroundColor: 'rgba(46,32,4,0.8)',
  },
  boardGlyph: {
    width: 14,

    height: 14,

    flexDirection: 'row',

    flexWrap: 'wrap',

    gap: 2,
  },
  boardGlyphCell: {
    width: 6,

    height: 6,

    borderRadius: 1.5,

    backgroundColor: 'rgba(191,219,254,0.95)',
  },
  boardGlyphCellOff: {
    backgroundColor: 'rgba(253,230,138,0.45)',
  },
  boardGlyphSlash: {
    position: 'absolute',

    width: 20,

    height: 1.6,

    borderRadius: 1,

    backgroundColor: '#FDE68A',

    transform: [{ rotate: '-45deg' }],
  },
  /*
   * Tấm nền thay chỗ bàn cờ. `aspectRatio: 2` chép của `boardLoading` để cột
   * trái không nhảy chiều cao khi ẩn/hiện - nhảy một cái là dải người chơi phía
   * trên và cột phải cùng giật theo.
   */
  boardHidden: {
    width: '100%',

    aspectRatio: 2,

    borderRadius: 16,

    borderWidth: 1.2,

    borderColor: 'rgba(148,163,255,0.28)',

    backgroundColor: 'rgba(6,8,22,0.55)',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,

    paddingHorizontal: 18,
  },
  boardHiddenTitle: {
    fontSize: 15,

    fontWeight: '900',

    letterSpacing: 1,

    color: 'rgba(226,232,255,0.75)',
  },
  boardHiddenBody: {
    fontSize: 12,

    lineHeight: 17,

    textAlign: 'center',

    color: 'rgba(226,232,255,0.45)',
  },
  boardHiddenBtn: {
    marginTop: 2,

    paddingHorizontal: 16,

    paddingVertical: 7,

    borderRadius: 999,

    borderWidth: 1.2,

    borderColor: 'rgba(96,165,250,0.55)',

    backgroundColor: 'rgba(30,58,138,0.35)',
  },
  boardHiddenBtnText: {
    fontSize: 12,

    fontWeight: '800',

    letterSpacing: 0.8,

    color: '#BFDBFE',
  },
  boardLoading: {
    width: '100%',

    aspectRatio: 2,

    borderRadius: 16,

    backgroundColor: '#07160D',

    alignItems: 'center',

    justifyContent: 'center',
  },

  /* ===========================================================
     SIDE
     =========================================================== */

  sideCol: {
    width: SIDE_WIDTH,

    gap: 7,

    paddingTop: 10,
  },

  sideHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 6,
  },

  roomText: {
    flex: 1,

    fontSize: 13,

    fontWeight: '700',

    color: text.primary,

    letterSpacing: 0.6,
  },

  iconBtn: {
    width: 30,

    height: 28,

    borderRadius: 9,

    borderWidth: 1.5,

    borderColor:
      'rgba(255,59,78,0.55)',

    backgroundColor:
      'rgba(48,6,14,0.75)',

    alignItems: 'center',

    justifyContent: 'center',
  },

  pauseBars: {
    flexDirection: 'row',

    gap: 2,
  },

  pauseBar: {
    width: 2.5,

    height: 11,

    borderRadius: 1.5,

    backgroundColor:
      boardColors.red,
  },

  /* Tam giác xanh = bấm được (web: #00B050). */
  resumeBtn: {
    borderColor: 'rgba(46,232,95,0.75)',
    backgroundColor: 'rgba(6,40,18,0.8)',
    boxShadow: '0 0 10px rgba(46,232,95,0.45)',
  },
  /* Tam giác xám = đã bấm, đang chờ tới đầu lượt kế (web: disabled, #7F7F7F). */
  resumeBtnWaiting: {
    borderColor: 'rgba(160,170,190,0.4)',
    backgroundColor: 'rgba(30,32,44,0.75)',
  },

  /*
   * Dải chữ "Game pause once X…" - đứng yên tới khi ván dừng thật.
   *
   * ⚠️ Ở ĐÁY cột bàn cờ, không ở đỉnh: đỉnh là nơi khung câu hỏi đặt nhãn chủ
   * đề + đồng hồ + SUBMIT, và dải này sống xuyên qua cả lượt chơi (đo K49: nó
   * đè mất đồng hồ và nút SUBMIT của chính chủ phòng).
   */
  pauseStrip: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    zIndex: 29,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.3,
    borderColor: 'rgba(160,170,190,0.45)',
    backgroundColor: 'rgba(22,24,40,0.94)',
  },
  pauseStripText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: 'rgba(226,232,255,0.9)',
    textAlign: 'center',
  },

  /* Viền xanh nhạt như nút bàn cờ: nút này bấm được, không phải trang trí. */
  menuBtn: {
    borderColor: 'rgba(120,160,255,0.55)',
  },

  dots: {
    flexDirection: 'row',

    gap: 2.5,
  },

  dot: {
    width: 3,

    height: 3,

    borderRadius: 2,

    backgroundColor: '#CDDCFF',
  },

  /* ===========================================================
     CURRENT PLAYER
     =========================================================== */

  /* Chỉ báo SignalR - xem ghi chú ở chỗ dùng. */
  netDot: { width: 9, height: 9, borderRadius: 5 },
  netOk: { backgroundColor: boardColors.green },
  netBusy: { backgroundColor: boardColors.amber },
  netDead: { backgroundColor: boardColors.red },

  meRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 8,

    height: 56,

    paddingHorizontal: 8,

    borderRadius: 12,

    borderWidth: 1,

    borderColor: boardColors.hair,

    backgroundColor: '#080C1E',
  },

  meRowTurn: {
    borderColor: boardColors.green,
  },

  meAvatar: {
    width: 42,

    height: 42,
  },

  meInfo: {
    flex: 1,
  },

  meStarsRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 7,
  },

  meName: {
    fontSize: 13.5,

    lineHeight: 17,

    fontWeight: '700',

    color: text.primary,
  },

  meMeta: {
    fontWeight: '400',

    color: boardColors.dim,
  },

  meScoreBox: {
    minWidth: 38,

    height: 38,

    borderRadius: 9,

    borderWidth: 1,

    borderColor:
      'rgba(46,232,95,0.45)',

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 6,
  },

  meScore: {
    fontSize: 17,

    fontWeight: '800',

    color: boardColors.green,
  },

  /* ===========================================================
     CARDS
     =========================================================== */

  handGrid: {
    gap: 5,
  },

  handRow: {
    flexDirection: 'row',

    gap: 5,
  },

  /* ===========================================================
     BOTTOM
     =========================================================== */

  bottomRow: {
    flex: 1,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 8,
  },

  /* Nút chat đang mở khung: viền sáng hơn để biết cái gì đang phủ bàn cờ. */
  squareBtnOn: {
    borderColor: boardColors.blue,
    boxShadow: '0 0 12px rgba(47,143,255,0.5)',
  },
  /* Số tin chưa đọc - chép `unread` của designs/GameBoardScreen.tsx. */
  unread: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#ff2d4d',
    borderWidth: 1.5,
    borderColor: '#0a0d22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  squareBtn: {
    width: 50,

    height: 48,

    borderRadius: 12,

    borderWidth: 1.5,

    borderColor:
      'rgba(47,143,255,0.6)',

    backgroundColor: '#081A40',

    alignItems: 'center',

    justifyContent: 'center',
  },

  diceBlock: {
    flex: 1,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,

    height: 48,

    borderRadius: 24,

    borderWidth: 1.5,

    borderColor:
      'rgba(140,160,210,0.28)',

    /*
     * ⚠️ PHẢI có nền. Không đặt thì nút trong suốt và nền sân khấu (có cả vệt
     * sáng lẫn quầng tím) lọt thẳng qua chữ ROLL DICE - lúc nút đang xám thì gần
     * như không đọc được.
     */
    backgroundColor: '#0A0D22',
  },

  replaced: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(4,4,14,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
    borderWidth: 1.4,
    borderColor: 'rgba(251,113,133,0.5)',
  },
  replacedTitle: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#FB7185',
    textAlign: 'center',
  },
  replacedBody: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(226,232,255,0.82)',
    textAlign: 'center',
  },

  notice: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    zIndex: 30,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.3,
    borderColor: 'rgba(255,198,30,0.6)',
    backgroundColor: 'rgba(40,28,4,0.95)',
    boxShadow: '0 0 14px rgba(255,198,30,0.35)',
  },
  noticeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: '#FFC61E' },

  diceBtn: {
    width: 40,

    height: 40,

    alignItems: 'center',

    justifyContent: 'center',

    opacity: 0.55,
  },

  diceBtnLive: {
    opacity: 1,
  },

  diceBlockLive: {
    borderColor:
      neon.purple.stroke,

    backgroundColor: '#1B0E3A',

    boxShadow: `0 0 16px rgba(${neon.purple.rgb},0.45)`,
  },

  diceLabel: {
    fontSize: 11,

    fontWeight: '700',

    letterSpacing: 1.4,

    color:
      'rgba(198,212,240,0.5)',
  },

  dicePressed: { opacity: 0.7 },
  diceLabelLive: {
    color: text.primary,
  },

  /* ===========================================================
     COMMON
     =========================================================== */

  centerBlock: {
    alignItems: 'center',

    justifyContent: 'center',
  },

  note: {
    color: boardColors.dim,

    fontSize: 13,

    textAlign: 'center',
  },
});