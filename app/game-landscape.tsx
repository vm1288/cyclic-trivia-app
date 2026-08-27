import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  characterImageUrl,
  getGameState,
  type GameBoard,
  type GamePlayer,
  type GameSnapshot,
} from '../src/api/game';
import { BoardCanvas } from '../src/components/BoardCanvas';
import { StageBackground } from '../src/components/StageBackground';
import { useGameConnection } from '../src/net/useGameConnection';
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

const POLL_MS = 3000;

/**
 * CHẾ ĐỘ THỬ: cho nhân vật của người tới lượt tự nhảy vòng quanh bàn cờ.
 *
 * ⚠️ TẠM THỜI. Nước đi thật đi qua packet `Pub` của SignalR mà app chưa nối, nên
 * đây là đường duy nhất hiện có để thấy nhân vật di chuyển và kiểm toạ độ từng
 * ô. Nối SignalR xong thì đặt `false` (hoặc xoá hẳn) và để `CurrentStepIndex`
 * tự lái - cơ chế nhảy đã dùng chung một đường, không phải viết lại.
 */
const DEMO_JUMP = true;

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

export default function GameLandscapeScreen() {
  const player = usePlayer();
  const t = useT();
  const insets = useSafeAreaInsets();

  const seat = player.status === 'ready' ? player.seat : null;

  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [board, setBoard] = useState<GameBoard | null>(null);

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

  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    let timer: ReturnType<typeof setTimeout>;
    let hasBoard = false;

    async function tick() {
      if (!seat || !alive.current) {
        return;
      }

      const result = await getGameState(
        seat.gameId,
        !hasBoard,
      );

      if (!alive.current) {
        return;
      }

      if (result.isSuccess) {
        setSnapshot({
          Game: result.Game,
          Players: result.Players,
        });

        if (!hasBoard && result.Board) {
          setBoard(result.Board);
          hasBoard = true;
        }
      }

      timer = setTimeout(
        tick,
        POLL_MS,
      );
    }

    void tick();

    return () => {
      alive.current = false;
      clearTimeout(timer);
    };
  }, [seat]);

  /*
   * ============================================================
   * SIGNALR
   * ============================================================
   *
   * Bước một: NỐI và NGHE. Poll 3 giây ở trên vẫn giữ nguyên - nó là nguồn dữ
   * liệu, còn kết nối này mới chỉ chứng minh gói tin về được tới app.
   *
   * ⚠️ Đừng bỏ poll cho tới khi từng loại gói tin đã có chỗ xử lý. Bỏ sớm là
   * mất luôn đường cập nhật mà chưa có gì thay thế.
   *
   * `asBoard` bật vì màn này CHÍNH LÀ một bàn cờ - mỗi điện thoại đều vẽ bàn cờ
   * riêng (NEXT_STEPS đã sửa lại điều tài liệu từng ghi sai). Server đọc
   * `connKind=board` và cho `BoardStepWatchdog` lui về vai lưới an toàn.
   */
  const [lastPacket, setLastPacket] = useState<{ typeID: number; at: number } | null>(null);

  const { state: connState } = useGameConnection({
    token: seat?.token ?? null,
    asBoard: true,
    onPacket: (packet) => {
      // Chưa xử lý theo từng loại - mới chỉ ghi lại để nhìn thấy trên màn hình.
      setLastPacket({ typeID: packet.typeID, at: Date.now() });
    },
  });

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

  const cards = countCards(
    me?.Cards ?? [],
  );

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
                ⚠️ TẠM THỜI - chấm trạng thái SignalR + typeID gói tin cuối, để
                nhìn được kết nối trong lúc dựng. Bỏ khi các màn đã bỏ poll.
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
              {lastPacket ? (
                <Text style={styles.netText}>{lastPacket.typeID}</Text>
              ) : null}

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

              <View
                style={[
                  styles.diceBlock,
                  isMyTurn &&
                    styles.diceBlockLive,
                ]}
              >
                <View
                  style={[
                    styles.diceBtn,
                    isMyTurn &&
                      styles.diceBtnLive,
                  ]}
                >
                  <Dice3D size={34} />
                </View>

                <Text
                  style={[
                    styles.diceLabel,
                    isMyTurn &&
                      styles.diceLabelLive,
                  ]}
                >
                  {t('game.rollDice')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
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

  /* ⚠️ TẠM THỜI - chỉ báo SignalR trong lúc dựng, xem ghi chú ở chỗ dùng. */
  netDot: { width: 9, height: 9, borderRadius: 5 },
  netOk: { backgroundColor: boardColors.green },
  netBusy: { backgroundColor: boardColors.amber },
  netDead: { backgroundColor: boardColors.red },
  netText: { fontSize: 10, fontWeight: '700', color: boardColors.dim },

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
  },

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

    boxShadow: `0 0 16px rgba(${neon.purple.rgb},0.45)`,
  },

  diceLabel: {
    fontSize: 11,

    fontWeight: '700',

    letterSpacing: 1.4,

    color:
      'rgba(198,212,240,0.5)',
  },

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