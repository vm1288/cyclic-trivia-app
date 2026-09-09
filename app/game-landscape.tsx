import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ackFlow,
  CASE_ACTION,
  categoryChain,
  characterImageUrl,
  EMPTY_GUID,
  submitAnswer,
  submitAnswerForTurn,
  type AnswerResult,
  type CardStepPayload,
  type DirectionPacket,
  type GamePlayer,
  type GameQuestion,
  type MoveDirection,
  type QuestionPacket,
  type TurnCard,
  type TurnQuestionPayload,
} from '../src/api/game';
import { BoardCanvas, HOP_MS, type PendingMove } from '../src/components/BoardCanvas';
import { CardChoiceOverlay } from '../src/components/CardChoiceOverlay';
import { DiceRollOverlay } from '../src/components/DiceRollOverlay';
import { MoveDirectionOverlay } from '../src/components/MoveDirectionOverlay';
import { FlyingReward } from '../src/components/FlyingReward';
import { QuestionOverlay } from '../src/components/QuestionOverlay';
import { TurnResultOverlay, type TurnResult } from '../src/components/TurnResultOverlay';
import { RaceWinnerOverlay } from '../src/components/RaceWinnerOverlay';
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
  Stars,
  TurnPulse,
} from '../src/components/GameBoardParts';
import { useT } from '../src/i18n/I18nProvider';
import { usePlayer } from '../src/session/PlayerSession';
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
type ActiveQuestion = {
  kind: 'race' | 'turn';
  question: GameQuestion;
  categories: string[];
  duration: number;
};

export default function GameLandscapeScreen() {
  const player = usePlayer();
  const t = useT();
  const insets = useSafeAreaInsets();

  const seat = player.status === 'ready' ? player.seat : null;

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
  const [dice, setDice] = useState<{ value: number | null } | null>(null);

  /** Thông báo thoáng qua: người khác vừa dùng thẻ gì. */
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * Kết quả câu trả lời vừa gửi - hiện giữa bàn cờ vài giây.
   *
   * Nguồn dữ liệu là HTTP response của chính lượt trả lời (đúng/sai/điểm/sao),
   * hoặc gói `TimeoutQuestion` khi có người chốt câu trước mình.
   */
  const [turnResult, setTurnResult] = useState<TurnResult | null>(null);

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

  const { snapshot, board, connState, connection, refresh } = useGameState({
    gameId: seat?.gameId ?? null,
    token: seat?.token ?? null,
    includeBoard: true,
    asBoard: true,
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

        const isMine = !!seat && moverId.toLowerCase() === seat.playerId.toLowerCase();
        /* Dư 400ms cho máy yếu; `HOP_MS` là thời gian đi MỘT ô. */
        const walkMs = HOP_MS * steps + 400;
        setTimeout(() => {
          if (isMine) {
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
      if (packet.typeID === TYPE_ID.RaceWinner) {
        const name = typeof packet.NickName === 'string' ? packet.NickName : '';
        if (!name) return;
        setRaceWinner({ name, isMe: packet.PlayerId === seat?.playerId });
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

  const canRoll =
    rollAction !== null &&
    connState === 'connected' &&
    !stepOverlayOpen &&
    (rollAction !== TYPE_ID.RollDice || isMyTurn);

  /*
   * Chặn bấm dồn 2 giây, chép theo `canTriggerRollDice` của bản web.
   *
   * ⚠️ Cần thật: gửi hai lần `RollDice` cho cùng một lượt thì server xử lý cả
   * hai và quân cờ đi hai lần. Dùng `ref` chứ không phải state - đây là cái
   * chốt, không phải thứ để vẽ lại màn hình.
   */
  const lastRoll = useRef(0);

  const rollDice = () => {
    if (!canRoll || rollAction === null) return;

    const now = Date.now();
    if (now - lastRoll.current < ROLL_COOLDOWN_MS) return;
    lastRoll.current = now;

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
  const showAnswerResult = (res: Awaited<ReturnType<typeof submitAnswer>>) => {
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
    setTurnResult({ kind: 'correct', point: result.point, earnedStar });

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

  const answerQuestion = (answerId: string, answerContent: string) => {
    const current = question;
    setQuestion(null);
    if (!current || !seat) return;

    /*
     * ⚠️ Hai loại câu hỏi đi HAI endpoint khác nhau. Gửi nhầm đường thì server
     * không tìm ra lượt và câu trả lời rơi vào hư không - không báo lỗi gì.
     */
    answered.current = current.question.Id;

    const send = current.kind === 'race' ? submitAnswerForTurn : submitAnswer;
    void send(
      { questionId: current.question.Id, answerId, questionTitle: answerContent },
      seat.token,
    ).then((res) => {
      // Vòng đua có thông báo riêng - xem ghi chú trong `showAnswerResult`.
      if (current.kind === 'turn') showAnswerResult(res);
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
  useEffect(() => {
    if (!pendingMove) return;
    const mover = (snapshot?.Players ?? []).find((pl) => pl.Id === pendingMove.playerId);
    if (!mover) return;
    if (mover.CurrentStepIndex !== pendingMove.fromStepIndex) setPendingMove(null);
  }, [snapshot, pendingMove]);

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

    const send = current.kind === 'race' ? submitAnswerForTurn : submitAnswer;
    void send(
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

    const send = current.kind === 'race' ? submitAnswerForTurn : submitAnswer;
    void send(
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
            {board ? (
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

            {turnResult ? (
              <TurnResultOverlay
                result={turnResult}
                /* Bản web luôn nêu TÊN người vừa trả lời, không nói trống không. */
                name={me?.NickName ?? ''}
                unit={pointUnit}
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
                banner={question.kind === 'race' ? t('question.race') : null}
                onAnswer={answerQuestion}
                onTimeout={timeoutQuestion}
              />
            ) : null}

            {notice ? (
              <View style={styles.notice} pointerEvents="none">
                <Text style={styles.noticeText} numberOfLines={1}>
                  {notice}
                </Text>
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

              <View
                style={styles.iconBtn}
              >
                <View
                  style={
                    styles.pauseBars
                  }
                >
                  <View
                    style={
                      styles.pauseBar
                    }
                  />
                  <View
                    style={
                      styles.pauseBar
                    }
                  />
                </View>
              </View>

              <View
                style={styles.iconBtn}
              >
                <View
                  style={styles.dots}
                >
                  <View
                    style={styles.dot}
                  />
                  <View
                    style={styles.dot}
                  />
                  <View
                    style={styles.dot}
                  />
                </View>
              </View>
            </View>

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
                  {row.map((key) => (
                    <HandTile
                      key={key}
                      cardKey={key}
                      label={t(
                        `game.card.${key}` as 'game.card.Joker',
                      )}
                      count={
                        cards[key]
                      }
                      dimmed
                      compact
                    />
                  ))}
                </View>
              ))}
            </View>

            {/* BOTTOM */}

            <View
              style={styles.bottomRow}
            >
              <View
                style={styles.squareBtn}
              >
                <ChatIcon size={22} />
              </View>

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
      {dice ? <DiceRollOverlay value={dice.value} /> : null}

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