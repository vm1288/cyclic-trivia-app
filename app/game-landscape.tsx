import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ackFlow,
  CASE_ACTION,
  categoryChain,
  characterImageUrl,
  EMPTY_GUID,
  submitAnswer,
  submitAnswerForTurn,
  type CardStepPayload,
  type DirectionPacket,
  type GamePlayer,
  type GameQuestion,
  type MoveDirection,
  type QuestionPacket,
  type TurnCard,
  type TurnQuestionPayload,
} from '../src/api/game';
import { BoardCanvas } from '../src/components/BoardCanvas';
import { CardChoiceOverlay } from '../src/components/CardChoiceOverlay';
import { DiceRollOverlay } from '../src/components/DiceRollOverlay';
import { MoveDirectionOverlay } from '../src/components/MoveDirectionOverlay';
import { QuestionOverlay } from '../src/components/QuestionOverlay';
import { RaceWinnerOverlay } from '../src/components/RaceWinnerOverlay';
import { StageBackground } from '../src/components/StageBackground';
import { TYPE_ID } from '../src/net/gameConnection';
import { useGameState } from '../src/net/useGameState';
import {
  boardColors,
  CARD_ORDER,
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

  /**
   * Khoá ngang khi vào, trả về dọc khi rời.
   */
  useEffect(() => {
    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    );

    return () => {
      void ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    };
  }, []);

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
   * Đang đợi kết quả xúc xắc từ một lượt nạp lại state.
   *
   * Bật lên khi gói `AskMoveDirection` (52) về - lúc đó server đã ghi xong
   * `DiceOne`, nên lượt nạp lại NGAY SAU đó chắc chắn mang số đúng.
   */
  const waitingDice = useRef(false);

  const { snapshot, board, connState, connection } = useGameState({
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

      /* Tung xong: server đã chốt mặt xúc xắc, lượt nạp lại tới đây sẽ mang nó. */
      if (packet.typeID === TYPE_ID.AskMoveDirection) waitingDice.current = true;

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

  const canRoll = rollAction !== null && connState === 'connected';

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

    // Xúc xắc lăn NGAY, chưa cần biết kết quả - xem `DiceRollOverlay`.
    waitingDice.current = false;
    setDice({ value: null });
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
  const answerQuestion = (answerId: string, answerContent: string) => {
    const current = question;
    setQuestion(null);
    if (!current || !seat) return;

    /*
     * ⚠️ Hai loại câu hỏi đi HAI endpoint khác nhau. Gửi nhầm đường thì server
     * không tìm ra lượt và câu trả lời rơi vào hư không - không báo lỗi gì.
     */
    const send = current.kind === 'race' ? submitAnswerForTurn : submitAnswer;
    void send(
      { questionId: current.question.Id, answerId, questionTitle: answerContent },
      seat.token,
    );
  };

  /*
   * ⚠️ Đóng overlay NGAY khi gửi, không đợi server. Hết giờ cũng gửi, với
   * `random` - đúng như bản web. Im lặng là lượt treo.
   */
  const chooseDirection = (choice: MoveDirection) => {
    setDirection(null);
    void connection.current?.send(TYPE_ID.MoveDirectionSelected, { direction: choice });
  };

  const timeoutQuestion = () => {
    const current = question;
    setQuestion(null);
    if (!current || !seat) return;

    const send = current.kind === 'race' ? submitAnswerForTurn : submitAnswer;
    void send(
      { questionId: current.question.Id, answerId: EMPTY_GUID, isTimeout: true },
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
      <StageBackground variant="landscape" />

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

          <View style={styles.boardCol}>
            {board ? (
              <BoardCanvas
                board={board}
                players={players}
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

            {cardStep ? (
              <CardChoiceOverlay
                cards={cardStep.cards}
                categoryTitle={cardStep.title}
                durationSeconds={cardStep.duration}
                onUse={useCard}
                onSkip={skipCard}
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