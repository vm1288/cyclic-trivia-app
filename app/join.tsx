import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  claimSeat,
  isRoomCodeShaped,
  normaliseRoomCode,
  resolveRoom,
  roomCodeFromScan,
  ROOM_CODE_LENGTH,
  type FreeJoinsUsedBody,
} from '../src/api/room';
import { FreeTrialDialog, type TrialInfo } from '../src/components/FreeTrialDialog';
import { UnlockDialog, type UnlockInfo } from '../src/components/UnlockDialog';
import { storeTrialGone } from '../src/api/storeTrial';
import { NeonButton } from '../src/components/NeonButton';
import { NeonField } from '../src/components/NeonField';
import { StageBackground } from '../src/components/StageBackground';
import { apiErrorText } from '../src/i18n/apiError';
import { useT } from '../src/i18n/I18nProvider';
import { useLicense } from '../src/session/LicenseSession';
import { usePlayer } from '../src/session/PlayerSession';
import { bg, neon, text } from '../src/theme/colors';

import { MODAL_ORIENTATIONS } from '../src/utils/modalOrientations';
import { glowRoom } from '../src/theme/glow';
/**
 * Vào ván bằng mã phòng HOẶC quét QR (K108, Tony 18/9 - bố cục theo ảnh mẫu, style giữ nguyên):
 *
 *   BACK      [ JOIN MATCH BY QR CODE OR MATCH ROOM CODE ]
 *   ENTER MATCH ROOM CODE          |   You can join a match by scanning
 *   [ A 2 W N H R ]                |   the QR code shown on the host's phone
 *   Ask the host for the "Room     |            [ ⛶ ]  (mở camera)
 *   code" and enter it above…      |
 *        ( JOIN MATCH )            |
 *
 * QR quét là **Common QR Code** ở lobby - nội dung `{SiteUrl}join/{CODE}` (K89); `roomCodeFromScan`
 * rút mã ra, cũng nhận `cyclic://join?code=` và mã trần. Quét xong là vào luôn (không bắt bấm JOIN).
 *
 * Đường vào dành cho người KHÔNG có license: chưa mua game của phòng thì server cho **3 lượt vào
 * miễn phí mỗi game** (K108, `FreeJoinRule`); hết thì `free_joins_used` → hiện lỗi + nút EXPLORE
 * GAMES. App gửi kèm id host của các license đã kích hoạt để server biết đã mua chưa.
 *
 * Nhận sẵn `?code=` từ deep link `cyclic://join?code=ABC123` (K89: điền sẵn, KHÔNG tự gửi).
 */
export default function JoinScreen() {
  const router = useRouter();
  const player = usePlayer();
  const license = useLicense();
  const t = useT();
  const params = useLocalSearchParams<{ code?: string }>();

  const existingSeat = player.status === 'ready' ? player.seat : null;

  const [code, setCode] = useState(() => normaliseRoomCode(params.code ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  /* K109: hết lượt + chưa dùng thử → hai tấm "7-day free trial" thay cho dòng lỗi. */
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  const [trialTotal, setTrialTotal] = useState(3);
  /* K110: hết lượt + đã dùng thử → hai tấm "UNLOCK NOW" → mua. */
  const [unlock, setUnlock] = useState<UnlockInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  /* Camera bắn onBarcodeScanned liên tục - chỉ nhận lần đầu, tránh xin hai ghế. */
  const scanned = useRef(false);

  const submit = useCallback(
    async (raw: string) => {
      const normalised = normaliseRoomCode(raw);

      if (!isRoomCodeShaped(normalised)) {
        setError(t('join.codeInvalid', { length: ROOM_CODE_LENGTH }));
        return;
      }

      // Chưa đọc xong SecureStore thì chưa có deviceId bền để xin ghế. Xin bằng
      // id tạm sẽ làm người dùng ăn hai ghế khi họ thử lại.
      if (player.status !== 'ready') return;

      setError(null);
      setHint(null);
      setExhausted(false);
      setBusy(true);

      const room = await resolveRoom(normalised);
      if (!room.isSuccess) {
        setBusy(false);
        setError(apiErrorText(room, t));
        return;
      }

      if (room.IsGameOver) {
        setBusy(false);
        setError(t('join.gameOver'));
        return;
      }

      // Phòng có thật nhưng chủ phòng chưa chọn thời lượng/số người, nên chưa
      // có ghế nào tồn tại. Nói đúng chuyện đó - báo "sai mã" ở đây sẽ khiến
      // người ta gõ đi gõ lại một mã hoàn toàn đúng.
      if (!room.IsGameCreated) {
        setBusy(false);
        setHint(t('join.notReady'));
        return;
      }

      const hostIds = license.all.filter((g) => g.activated).map((g) => g.hostId);
      const seat = await claimSeat(normalised, player.deviceId, hostIds);

      if (!seat.isSuccess) {
        if (seat.errorCode === 'free_joins_used') {
          const body = (seat.data ?? {}) as FreeJoinsUsedBody;
          /*
           * Tony 1/10 (lỗi 4): server bảo "còn dùng thử" nhưng tài khoản store đã tiêu nó rồi →
           * hỏi store trước; store nói hết thì đi thẳng tấm UNLOCK NOW (mockup "Purchase").
           */
          const trialGone =
            body.Trial?.Available && body.Trial.ProductId && body.Unlock
              ? await storeTrialGone(body.Trial.ProductId)
              : null;
          setBusy(false);
          if (body.Trial?.Available && trialGone !== true) {
            setTrialTotal(body.FreeJoinsTotal ?? 3);
            setTrial({
              days: body.Trial.Days,
              durationDays: body.Trial.DurationDays,
              sponsorId: body.Trial.SponsorId,
              gameName: body.Trial.GameName ?? t('games.unnamed'),
              logoUrl: body.Trial.LogoUrl,
            });
            return;
          }
          if (body.Unlock) {
            setTrialTotal(body.FreeJoinsTotal ?? 3);
            setUnlock({
              sponsorId: body.Trial?.SponsorId ?? '',
              gameName: body.Trial?.GameName ?? t('games.unnamed'),
              logoUrl: body.Trial?.LogoUrl ?? null,
              price: body.Unlock.Price,
              currency: body.Unlock.Currency,
              durationDays: body.Unlock.DurationDays,
              tagline: body.Unlock.Tagline,
              description: body.Unlock.Description,
              players: body.Unlock.Players,
              ageRange: body.Unlock.AgeRange,
            });
            return;
          }
          setExhausted(true);
        }
        setBusy(false);
        setError(apiErrorText(seat, t));
        return;
      }
      setBusy(false);

      await player.saveSeat({
        gameId: seat.GameId,
        roomCode: seat.RoomCode,
        playerId: seat.PlayerId,
        token: seat.Token,
        nickname: seat.NickName,
        characterId: seat.CharacterId,
        freeJoin: seat.FreeJoin ? { used: seat.FreeJoin.Used, total: seat.FreeJoin.Total } : null,
      });

      // Máy này đã nhận ghế xong từ trước (vào lại sau khi rớt mạng) thì đừng
      // bắt đặt lại tên - đi thẳng vào phòng chờ.
      router.replace(seat.IsClaimed ? '/waiting' : '/seat');
    },
    [player, license.all, router, t],
  );

  async function openScanner() {
    setError(null);
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        setError(t('join.scanNoPermission'));
        return;
      }
    }
    scanned.current = false;
    setScanning(true);
  }

  function onScanned(data: string) {
    if (scanned.current) return;
    const found = roomCodeFromScan(data);
    if (!found) return; // QR lạ: bỏ qua, camera vẫn chạy
    scanned.current = true;
    setScanning(false);
    setCode(found);
    void submit(found);
  }

  return (
    <View style={styles.root}>
      <StageBackground />

      {/* Ngang thì tai thỏ nằm ở cạnh trái/phải - phải khai báo cả `left`/`right`. */}
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.body}>
          {/* Nút back nổi đè lên, không nằm trong dòng chảy - cùng khuôn `FormScreen`. */}
          <Pressable
            style={styles.back}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color={text.primary} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>

          {/* Tiêu đề trong khung viền, căn giữa, ngang hàng nút back (ảnh mẫu). */}
          <View style={styles.titleRow}>
            <View style={styles.titleBox}>
              <Text style={styles.title} numberOfLines={2}>{t('join.title')}</Text>
            </View>
          </View>

          <View style={styles.columns}>
            {/* Trái: nhập mã. */}
            <ScrollView
              style={styles.col}
              contentContainerStyle={styles.colInner}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <NeonField
                label={t('join.codeTitle')}
                color={neon.blue}
                value={code}
                onChangeText={(value) => {
                  // Chuẩn hoá ngay lúc gõ: người ta hay chép cả khoảng trắng hoặc gạch
                  // nối từ tin nhắn mời.
                  setCode(normaliseRoomCode(value));
                  if (error) setError(null);
                  if (hint) setHint(null);
                  if (exhausted) setExhausted(false);
                }}
                error={error}
                placeholder={t('join.codePlaceholder')}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                maxLength={ROOM_CODE_LENGTH}
                returnKeyType="go"
                onSubmitEditing={() => submit(code)}
                editable={!busy}
              />

              <Text style={styles.codeHint}>{hint ?? t('join.codeHint')}</Text>

              <View style={styles.joinWrap}>
                <NeonButton label={t('join.submit')} color={neon.blue} onPress={() => submit(code)} busy={busy} />
              </View>

              {/* Hết 3 lượt miễn phí → dẫn sang mua (K108). */}
              {exhausted ? (
                <View style={styles.joinWrap}>
                  <NeonButton label={t('join.explore')} color={neon.orange} onPress={() => router.push('/purchase')} />
                </View>
              ) : null}

              {/*
                Đường về ghế cũ. Máy đã nhận ghế rồi mà tắt app đi thì chỉ nhớ mã phòng
                mới quay lại được - trong khi ghế vẫn còn nguyên ở server. KHÔNG tự động
                chuyển hướng: người dùng có thể đang muốn vào một phòng KHÁC.
              */}
              {existingSeat?.nickname ? (
                <View style={styles.joinWrap}>
                  <NeonButton label={t('join.backToRoom')} color={neon.green} onPress={() => router.replace('/waiting')} />
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.divider} />

            {/* Phải: quét QR. */}
            <View style={[styles.col, styles.qrCol]}>
              <Text style={styles.qrCopy}>{t('join.qrCopy')}</Text>
              <Pressable
                onPress={openScanner}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t('join.scan')}
                hitSlop={10}
                style={({ pressed }) => [styles.scanBtn, pressed && styles.pressed]}
              >
                <Ionicons name="scan-outline" size={44} color="#FFD84D" />
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <FreeTrialDialog
        info={trial}
        total={trialTotal}
        onClose={() => setTrial(null)}
        onProceed={(info) => {
          setTrial(null);
          // /purchase tự bấm mua gói có kỳ dùng thử của game này (K109).
          router.push({ pathname: '/purchase', params: { trialFor: info.sponsorId } });
        }}
      />

      <UnlockDialog
        info={unlock}
        freeJoinsTotal={trialTotal}
        onClose={() => setUnlock(null)}
        onPurchase={(info) => {
          setUnlock(null);
          router.push({ pathname: '/purchase', params: { autoBuy: info.sponsorId } });
        }}
      />

      {/* Camera toàn màn hình; thoát bằng nút ✕ hoặc BACK cứng. */}
      <Modal supportedOrientations={MODAL_ORIENTATIONS} visible={scanning} animationType="fade" statusBarTranslucent onRequestClose={() => setScanning(false)}>
        <View style={styles.scanRoot}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={(r) => onScanned(r.data)}
          />
          <View style={styles.scanOverlay} pointerEvents="box-none">
            <Text style={styles.scanTitle}>{t('join.scanTitle')}</Text>
            <View style={styles.scanFrame} />
            <Text style={styles.scanHint}>{t('join.scanHint')}</Text>
          </View>
          <Pressable
            onPress={() => setScanning(false)}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={12}
            style={styles.scanClose}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: bg.deep },
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 20, paddingBottom: 10 },
  pressed: { opacity: 0.7 },

  back: {
    position: 'absolute',
    top: 8,
    left: 12,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 12,
    gap: 2,
  },
  backText: { color: text.primary, fontSize: 16 },

  /* Hàng tiêu đề cao 56: khung viền căn giữa, chừa chỗ nút back bên trái. */
  titleRow: { height: 56, alignItems: 'center', justifyContent: 'center', paddingLeft: 90, paddingRight: 90 },
  /* Tony 18/9: bỏ viền quanh tiêu đề - chữ trần, cùng kiểu tiêu đề các màn khác. */
  titleBox: { paddingHorizontal: 18, paddingVertical: 6 },
  title: {
    color: '#F4F9FF',
    fontSize: 18,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(140,200,255,0.65)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
    ...glowRoom(14),
  },

  columns: { flex: 1, flexDirection: 'row', alignItems: 'stretch', gap: 18, paddingTop: 6 },
  col: { flex: 1 },
  colInner: { flexGrow: 1, justifyContent: 'center', gap: 12, paddingVertical: 4 },
  codeHint: { color: text.muted, fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  joinWrap: { alignSelf: 'center', width: '78%', minWidth: 220 },

  divider: { width: 1, backgroundColor: 'rgba(150,190,235,0.35)', marginVertical: 18 },

  qrCol: { alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 12 },
  qrCopy: { color: text.primary, fontSize: 15.5, lineHeight: 22, textAlign: 'center' },
  scanBtn: {
    width: 76,
    height: 76,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,216,77,0.55)',
    backgroundColor: 'rgba(10,13,34,0.8)',
    boxShadow: '0 0 14px rgba(255,216,77,0.35)',
  },

  scanRoot: { flex: 1, backgroundColor: '#000' },
  camera: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scanOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  scanTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 1.5 },
  scanFrame: { width: 220, height: 220, borderRadius: 18, borderWidth: 3, borderColor: '#FFD84D' },
  scanHint: { color: 'rgba(255,255,255,0.85)', fontSize: 13.5, textAlign: 'center', paddingHorizontal: 30 },
  scanClose: { position: 'absolute', top: 18, right: 18, padding: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)' },
});
