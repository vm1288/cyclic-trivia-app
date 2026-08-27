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
 * Bàn cờ chiếm phần lớn bên trái; cột phải là mã phòng, người chơi chính, bộ
 * bài và xúc xắc. Dải người chơi khác trải một hàng trên cùng.
 *
 * VÌ SAO NẰM NGANG: ở bố cục dọc, bàn cờ đã chiếm 93% bề ngang màn hình mà chỉ
 * dùng 23% chiều cao - nó bị chặn bởi BỀ NGANG, và mọi cách chỉnh lề/cắt ảnh
 * đều đã cạn. Hình bàn cờ vốn nằm ngang (tỉ lệ 2.21), nên xoay màn là cách duy
 * nhất còn lại để nó to lên đáng kể. Đo được: vòng bàn cờ ~1490px so với
 * 1000px ở bố cục dọc.
 *
 * ⚠️ Màn này TỰ KHOÁ hướng ngang khi mở và TRẢ VỀ dọc khi rời đi.
 *
 * `app.json` để `orientation: "default"` (cho phép cả hai) chứ không phải
 * `"landscape"` - mọi màn còn lại đều thiết kế cho chiều dọc và sẽ vỡ nếu bị
 * xoay. Việc khoá từng màn do `expo-screen-orientation` lo: root layout khoá
 * dọc, riêng màn này khoá ngang.
 *
 * ⚠️ Đổi `app.json` thì PHẢI prebuild + build lại APK. `npx expo run:android`
 * bỏ qua prebuild khi thư mục `android/` đã tồn tại, nên thay đổi sẽ im lặng
 * không có tác dụng - build vẫn báo SUCCESSFUL. Dùng `scripts/build-apk.ps1`.
 */

const POLL_MS = 3000;

/**
 * Bề ngang cột phải (dp).
 *
 * Đánh đổi trực tiếp với độ lớn bàn cờ: mỗi dp cho cột phải là một dp bàn cờ
 * mất đi. Hạ xuống thì bàn cờ to hơn nhưng nhãn thẻ bài bắt đầu bị cắt.
 */
const SIDE_WIDTH = 224;

/** Luôn 5 chỗ, thiếu người thì chừa trống - xem ghi chú ở dải người chơi. */
const STRIP_SLOTS = 5;

export default function GameLandscapeScreen() {
  const player = usePlayer();
  const t = useT();
  const insets = useSafeAreaInsets();

  const seat = player.status === 'ready' ? player.seat : null;

  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [board, setBoard] = useState<GameBoard | null>(null);

  /*
   * Khoá ngang khi vào, trả về dọc khi rời.
   *
   * Trả về trong hàm dọn dẹp là BẮT BUỘC: không có nó thì bấm back ra khỏi ván
   * là mọi màn còn lại kẹt ở chiều ngang, mà chúng đều dựng cho chiều dọc.
   */
  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout>;
    let hasBoard = false;

    async function tick() {
      if (!seat || !alive.current) return;

      const result = await getGameState(seat.gameId, !hasBoard);
      if (!alive.current) return;

      if (result.isSuccess) {
        setSnapshot({ Game: result.Game, Players: result.Players });
        if (!hasBoard && result.Board) {
          setBoard(result.Board);
          hasBoard = true;
        }
      }

      timer = setTimeout(tick, POLL_MS);
    }

    void tick();
    return () => {
      alive.current = false;
      clearTimeout(timer);
    };
  }, [seat]);

  const players = snapshot?.Players ?? [];
  const me: GamePlayer | null = players.find((p) => p.Id === seat?.playerId) ?? null;
  const others = players.filter((p) => p.Id !== seat?.playerId);
  const currentTurnPlayerId = snapshot?.Game.CurrentTurnPlayerId ?? '';
  const isMyTurn = !!me && currentTurnPlayerId === me.Id;
  const cards = countCards(me?.Cards ?? []);

  /*
   * Lề hai bên theo safe-area THẬT của chiều ngang.
   *
   * Ở landscape, thanh trạng thái và thanh điều hướng ảo nằm ở hai cạnh dọc,
   * nên `insets.left`/`insets.right` mới là con số đúng. (Bản thử trước đây
   * phải tự ánh xạ `top`/`bottom` vì nó xoay khung bằng transform, hệ điều hành
   * không biết - giờ hướng là thật nên không cần mẹo đó nữa.)
   */
  const stagePad = {
    paddingLeft: 10 + insets.left,
    paddingRight: 10 + insets.right,
  };

  if (!seat) {
    return (
      <View style={[styles.root, styles.centerBlock]}>
        <Text style={styles.note}>{t('game.noSeat')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.stageInner, stagePad]}>
          {/* ── TRÊN: 5 người chơi khác, trải một hàng ──────────────── */}
          <View style={styles.strip}>
            {others.map((p) => {
              const isTurn = p.Id === currentTurnPlayerId;
              return (
                <View key={p.Id} style={styles.stripSlot}>
                  {/*
                    Gradient vien phai sang o CA HAI mep (mid -> mau -> mid).
                    Ban dau chay tu mau nhan vat sang gan-trong-suot, nen nua
                    duoi-phai cua vien tat han va trong nhu bi mat border.
                  */}
                  <LinearGradient
                    colors={[
                      lighten(p.PlayerColor || '#2F8FFF', 0.5),
                      p.PlayerColor || '#2F8FFF',
                      lighten(p.PlayerColor || '#2F8FFF', 0.5),
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.pillRim}
                  >
                    <View style={styles.pill}>
                      <Image
                        source={{ uri: characterImageUrl(p.CharacterId) }}
                        style={styles.pillAvatar}
                        resizeMode="contain"
                      />
                      <View style={styles.pillInfo}>
                        {/*
                          Chừa sẵn ĐÚNG hai hàng, không bao giờ tràn sang hàng
                          ba. Chiều cao cố định giữ mọi ô cao bằng nhau dù tên
                          một chữ hay hai hàng - không thì cả dải so le và bàn
                          cờ bị đẩy lên xuống mỗi lần có người đổi tên.
                        */}
                        <Text style={styles.pillName} numberOfLines={2} ellipsizeMode="tail">
                          {p.IsSetupNickName ? p.NickName : t('lobby.seatEmpty')}
                        </Text>
                        <Stars filled={p.Stars} size={9} />
                      </View>

                      {/*
                        Điểm là CỘT RIÊNG bên phải, căn giữa theo chiều dọc.

                        ⚠️ Cột này ăn mất bề ngang của phần chữ, mà ô chỉ rộng
                        ~148dp và avatar đã lấy 50dp. Đó là lý do sao phải nhỏ
                        (cỡ 9): năm ngôi sao cỡ 13 chiếm 65dp, vượt quá ~48dp
                        còn lại và điểm sẽ bị cắt đôi - đã dính đúng lỗi đó.
                      */}
                      <View style={styles.pillScoreCol}>
                        <Text
                          style={[styles.pillScore, { color: p.PlayerColor || boardColors.blue }]}
                          numberOfLines={1}
                        >
                          {p.Point}
                        </Text>
                      </View>
                    </View>
                    {isTurn ? <TurnPulse radius={11} /> : null}
                  </LinearGradient>
                </View>
              );
            })}
          </View>

          {/* ── DƯỚI: bàn cờ trái, thông tin phải ───────────────────── */}
          <View style={styles.main}>
            {/*
              ⚠️ ĐỪNG kéo bàn cờ ra sát cạnh máy bằng lề âm. Đã thử và sai:
              thanh trạng thái của điện thoại đè lên ngay. Bàn cờ "sát mép" là
              sát mép KHUNG HÌNH của chính nó - việc đó do `CROP` trong
              `BoardCanvas` lo, không phải do lề của cột.
            */}
            <View style={styles.boardCol}>
              {board ? (
                <View style={styles.boardGlow}>
                <BoardCanvas
                  board={board}
                  players={players}
                  currentTurnPlayerId={currentTurnPlayerId}
                />
                </View>
              ) : (
                <View style={styles.boardLoading}>
                  <ActivityIndicator color={boardColors.blue} size="large" />
                </View>
              )}
            </View>

            <View style={styles.sideCol}>
              <View style={styles.sideHeader}>
                <Text style={styles.roomText} numberOfLines={1}>
                  {seat.roomCode ? t('waiting.room', { code: seat.roomCode }) : t('game.title')}
                </Text>
                {/* Chi ICON, bo chu - hang nay hep va ma phong can cho. */}
                <View style={styles.iconBtn}>
                  <View style={styles.pauseBars}>
                    <View style={styles.pauseBar} />
                    <View style={styles.pauseBar} />
                  </View>
                </View>

                <View style={styles.iconBtn}>
                  <View style={styles.dots}>
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                  </View>
                </View>
              </View>

              {me ? (
                <View style={[styles.meRow, isMyTurn && styles.meRowTurn]}>
                  {isMyTurn ? <TurnPulse radius={12} /> : null}
                  <Image
                    source={{ uri: characterImageUrl(me.CharacterId) }}
                    style={styles.meAvatar}
                    resizeMode="contain"
                  />
                  <View style={styles.meInfo}>
                    <Text style={styles.meName} numberOfLines={1}>
                      {me.NickName}
                    </Text>
                    {/*
                      Chủ phòng = ICON vương miện nằm cùng hàng sao, không phải
                      chữ "(HOST)": chữ ăn mất chỗ của tên trong cột hẹp, mà
                      hàng sao thì còn trống bên phải.
                    */}
                    <View style={styles.meStarsRow}>
                      <Stars filled={me.Stars} size={14} />
                      {me.IsHost ? <CrownIcon size={15} /> : null}
                    </View>
                  </View>
                  <View style={styles.meScoreBox}>
                    <Text style={styles.meScore}>{me.Point}</Text>
                  </View>
                </View>
              ) : null}

              {/*
                Bai xep 2 HANG x 2 COT: moi la rong gap doi nen "ELIMINATOR"
                khong con bi cat, va cot phai doc theo chieu doc gon hon.

                KHONG boc `HandTile` trong View trung gian - no da co san
                `flex: 1` + chieu cao rieng; nam trong o cha khong co chieu cao
                thi `flex: 1` keo no co ve 0 va ca hang bai bep thanh vach manh.
              */}
              <View style={styles.handGrid}>
                {[CARD_ORDER.slice(0, 2), CARD_ORDER.slice(2)].map((row, i) => (
                  <View key={i} style={styles.handRow}>
                    {row.map((key) => (
                      <HandTile
                        key={key}
                        cardKey={key}
                        label={t(`game.card.${key}` as 'game.card.Joker')}
                        count={cards[key]}
                        dimmed
                        compact
                      />
                    ))}
                  </View>
                ))}
              </View>

              <View style={styles.bottomRow}>
                <View style={styles.squareBtn}>
                  <ChatIcon size={22} />
                </View>

                {/* Chu nam CUNG HANG voi xuc xac, khong xuong dong duoi. */}
                <View style={[styles.diceBlock, isMyTurn && styles.diceBlockLive]}>
                  <View style={[styles.diceBtn, isMyTurn && styles.diceBtnLive]}>
                    <Dice3D size={34} />
                  </View>
                  <Text style={[styles.diceLabel, isMyTurn && styles.diceLabelLive]}>
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
  root: { flex: 1, backgroundColor: '#04040E' },
  stageInner: { flex: 1, paddingTop: 8, paddingBottom: 8, gap: 8 },

  /* ── dải người chơi trên cùng ── */
  /*
   * Mỗi ô chiếm ĐÚNG 1/5 bề ngang dù bàn có mấy người; thiếu người thì cả dải
   * dồn vào giữa. Cho ô co giãn theo số người thì bàn 2 người sẽ có hai ô rộng
   * gấp đôi bàn 6 người, và hàng trên nuốt mất chỗ của bàn cờ.
   */
  strip: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  stripSlot: { width: `${100 / STRIP_SLOTS}%` },
  pillRim: { borderRadius: 12, padding: 1.5 },
  /*
   * Ô người chơi phụ để TO, không thu nhỏ cho gọn.
   *
   * Chỗ đang là ảnh nhân vật sẽ thành KHUNG VIDEO khi làm tính năng gọi hình.
   * Ô nhỏ thì khuôn mặt chỉ còn vài chục pixel, nhìn không ra ai - nên thà lấy
   * bớt chiều cao của bàn cờ (vốn đang thừa chiều dọc) còn hơn phải dựng lại
   * cả dải này lúc thêm video.
   */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    // Lề hẹp: avatar đã to cho khung video, mỗi dp lề là một dp chữ mất đi.
    gap: 5,
    height: 74,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: '#080C1E',
  },
  pillAvatar: { width: 50, height: 50 },
  pillInfo: { flex: 1, gap: 2, justifyContent: 'center' },
  pillScoreCol: { justifyContent: 'center', minWidth: 26 },
  /*
   * Đúng hai hàng chữ 13px (lineHeight 16).
   *
   * ⚠️ KHÔNG `flex: 1`. Nó sót lại từ hồi tên nằm trong hàng ngang; trong cột
   * thì `flex` nở theo chiều DỌC, đẩy hàng sao rơi xuống tận đáy ô và để lại
   * một khoảng trống to giữa tên với sao.
   */
  pillName: { height: 32, fontSize: 13, lineHeight: 16, fontWeight: '700', color: '#EAF1FF' },
  pillScore: { fontSize: 15, fontWeight: '800', textAlign: 'right' },

  /* ── phần dưới ── */
  main: { flex: 1, flexDirection: 'row', gap: 8 },
  boardCol: { flex: 1, justifyContent: 'center' },
  // Quầng sáng mảnh quanh bàn cờ cho nó tách hẳn khỏi nền.
  boardGlow: {
    borderRadius: 16,
    boxShadow: '0 0 14px rgba(120,170,255,0.35), 0 0 34px rgba(120,170,255,0.15)',
  },
  boardLoading: {
    width: '100%',
    aspectRatio: 2,
    borderRadius: 16,
    backgroundColor: '#07160D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /*
   * Lùi xuống một chút cho ngang tầm mắt với bàn cờ - dính sát mép trên thì
   * hàng mã phòng trông như bị treo lơ lửng trên đầu cột.
   */
  sideCol: { width: SIDE_WIDTH, gap: 7, paddingTop: 10 },
  sideHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomText: { flex: 1, fontSize: 13, fontWeight: '700', color: text.primary, letterSpacing: 0.6 },
  iconBtn: {
    width: 30,
    height: 28,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,59,78,0.55)',
    backgroundColor: 'rgba(48,6,14,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBars: { flexDirection: 'row', gap: 2 },
  pauseBar: { width: 2.5, height: 11, borderRadius: 1.5, backgroundColor: boardColors.red },
  dots: { flexDirection: 'row', gap: 2.5 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#CDDCFF' },

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
  meRowTurn: { borderColor: boardColors.green },
  meAvatar: { width: 42, height: 42 },
  meInfo: { flex: 1 },
  meStarsRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  meName: { fontSize: 13.5, lineHeight: 17, fontWeight: '700', color: text.primary },
  meMeta: { fontWeight: '400', color: boardColors.dim },
  meScoreBox: {
    minWidth: 38,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(46,232,95,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  meScore: { fontSize: 17, fontWeight: '800', color: boardColors.green },

  handGrid: { gap: 5 },
  handRow: { flexDirection: 'row', gap: 5 },

  bottomRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  squareBtn: {
    // Cao bang thanh xuc xac ben canh de hang duoi thang hang.
    width: 50,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(47,143,255,0.6)',
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
    borderColor: 'rgba(140,160,210,0.28)',
  },
  // KHÔNG viền: thanh bao ngoài đã có viền rồi, thêm một vòng nữa là rối.
  diceBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.55,
  },
  diceBtnLive: { opacity: 1 },
  diceBlockLive: {
    borderColor: neon.purple.stroke,
    boxShadow: `0 0 16px rgba(${neon.purple.rgb},0.45)`,
  },
  diceLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: 'rgba(198,212,240,0.5)' },
  diceLabelLive: { color: text.primary },

  centerBlock: { alignItems: 'center', justifyContent: 'center' },
  note: { color: boardColors.dim, fontSize: 13, textAlign: 'center' },
});
