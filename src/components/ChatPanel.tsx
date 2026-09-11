import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BackHandler,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { ChatMessage } from '../api/game';
import { useT } from '../i18n/I18nProvider';
import { boardColors, fill } from './GameBoardParts';
import { text } from '../theme/colors';

/**
 * Khung chat trong ván - đè lên CỘT BÀN CỜ, mở từ nút chat ở cột phải.
 *
 * ⚠️ Bản web KHÔNG có chat (không gói, không handler, không view - quét
 * 2026-09-11). Đây là tính năng của riêng app, dựng từ bản thiết kế
 * `designs/GameBoardScreen.tsx` (chỉ có nút + số tin chưa đọc). Vì thế chữ ở
 * đây là chữ của app, không có bản web để chép.
 *
 * Tin tới qua gói 89 (`Chat`), gửi cũng bằng gói 89 - server chuyển tiếp cho mọi
 * ghế KỂ CẢ người gửi, nên danh sách ở đây chỉ vẽ theo gói, không tự chép tin
 * mình vừa gõ (đỡ một đường đồng bộ). Lịch sử 50 tin gần nhất lấy qua
 * `GET /public/game/chat` lúc mở màn ván.
 *
 * Chỉ phủ cột bàn cờ: cột phải (xúc xắc, bài, người tới lượt) vẫn thấy và bấm
 * được, chat không chặn nhịp chơi.
 *
 * ⚠️ Bàn phím: manifest có `adjustResize` nhưng máy thật KHÔNG co màn (đo K50,
 * Android 15 edge-to-edge bỏ qua cờ đó) - bàn phím đè lên ô nhập. Nên tự dịch:
 * `KeyboardAvoidingView behavior="position"` đẩy ruột khung lên đúng phần bị
 * che; phần đầu (tiêu đề) chui lên trên và bị `overflow: hidden` cắt, còn vài
 * tin cuối + ô nhập nằm ngay trên bàn phím - đúng thứ cần khi đang gõ.
 */
export function ChatPanel({
  messages,
  meId,
  onSend,
  onClose,
}: {
  messages: ChatMessage[];
  meId: string;
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const list = useRef<FlatList<ChatMessage>>(null);
  const root = useRef<View>(null);
  /*
   * Khung này cách mép trên màn hình bao nhiêu (dp). KeyboardAvoidingView đo
   * chính nó theo toạ độ CỦA CHA, nên với một khung nằm giữa màn thì nó dịch
   * thiếu đúng khoảng này (đo K50: thiếu ~112dp, ô nhập vẫn chìm dưới bàn phím).
   * Bù lại qua `keyboardVerticalOffset`.
   */
  const [windowY, setWindowY] = useState(0);
  /*
   * Bàn phím đang mở thì khung VƯƠN LÊN TỚI MÉP TRÊN màn hình (`top: -windowY`,
   * đè lên dải người chơi) - chỗ còn hở giữa đỉnh cột bàn cờ và bàn phím chỉ
   * ~90dp, vừa đủ ô nhập mà không thấy tin nào (đo K50). Vươn lên thì thấy thêm
   * ~110dp tin nhắn. Đo `windowY` CHỈ khi bàn phím đóng, vì vươn lên rồi thì
   * `measureInWindow` trả 0 và khung tự "trôi" về.
   */
  const [keyboardUp, setKeyboardUp] = useState(false);
  const keyboardUpRef = useRef(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      keyboardUpRef.current = true;
      setKeyboardUp(true);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardUpRef.current = false;
      setKeyboardUp(false);
    });
    return () => {
      show.remove();
      hide.remove();
      /*
       * Khung bị đóng (tay bấm ✕, hoặc tự đóng vì câu hỏi tới) thì hạ bàn phím
       * theo. Ô nhập biến mất mà bàn phím còn đứng đó là che nửa câu hỏi (đo K50).
       */
      Keyboard.dismiss();
    };
  }, []);

  /*
   * Nút BACK cứng đóng khung chat, KHÔNG rời màn ván. Đo K50: bàn phím vừa hạ
   * mà bấm BACK là expo-router pop luôn màn ván - người chơi văng về Home giữa
   * lượt. Bàn phím đang mở thì IME nuốt BACK trước, tới lượt này mới đóng khung.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  /* Tin mới thì cuộn xuống cuối - kể cả tin của mình vừa về qua gói. */
  useEffect(() => {
    if (messages.length === 0) return;
    const id = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [messages.length]);

  const send = () => {
    const txt = draft.trim();
    if (!txt) return;
    onSend(txt);
    setDraft('');
  };

  return (
    <View
      ref={root}
      style={[styles.root, keyboardUp && { top: -windowY }]}
      onLayout={() => {
        if (keyboardUpRef.current) return;
        root.current?.measureInWindow?.((_x, y) => setWindowY(y));
      }}
    >
      <LinearGradient
        colors={['rgba(6,14,40,0.98)', 'rgba(8,10,30,0.98)']}
        style={[fill, styles.bg]}
      />

      <KeyboardAvoidingView
        behavior="position"
        keyboardVerticalOffset={keyboardUp ? 0 : windowY}
        style={styles.avoid}
        contentContainerStyle={styles.avoidContent}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('chat.title')}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={10}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => m.Id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>{t('chat.empty')}</Text>}
          renderItem={({ item }) => {
            const mine = item.PlayerId === meId;
            return (
              <View style={[styles.row, mine && styles.rowMine]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                  {!mine ? (
                    <Text
                      style={[styles.name, { color: item.PlayerColor || boardColors.blueSoft }]}
                      numberOfLines={1}
                    >
                      {item.NickName}
                    </Text>
                  ) : null}
                  <Text style={styles.body}>{item.Text}</Text>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            placeholder={t('chat.placeholder')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            selectionColor={boardColors.blue}
            returnKeyType="send"
            blurOnSubmit={false}
            /*
             * ⚠️ Android NGANG: không có cờ này thì bàn phím Samsung mở "extract UI"
             * toàn màn hình - ô soạn to đùng che hết chat, người gõ không thấy tin
             * nào (đo K50, ảnh 11:20). Cờ này = IME_FLAG_NO_EXTRACT_UI.
             */
            disableFullscreenUI
            maxLength={300}
            style={styles.input}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel={t('chat.send')}
            style={({ pressed }) => [
              styles.sendBtn,
              !draft.trim() && styles.sendBtnOff,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.sendText}>{t('chat.send')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    /* Trên câu hỏi (20) và thông báo (15), dưới tấm tạm dừng (30). */
    zIndex: 25,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(47,143,255,0.55)',
    overflow: 'hidden',
  },
  bg: { borderRadius: 16 },
  avoid: { flex: 1 },
  /* Ruột khung cao bằng khung; `position` dịch nó lên bằng `bottom`. */
  avoidContent: { height: '100%' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: boardColors.hair,
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: boardColors.blueSoft,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 13, fontWeight: '800', color: text.primary },
  pressed: { opacity: 0.6 },

  list: { flex: 1 },
  /*
   * Tin dồn XUỐNG ĐÁY: ít tin thì nằm sát ô nhập, và khi bàn phím đẩy khung lên
   * thì phần bị cắt là khoảng trống phía trên chứ không phải tin (đo K50).
   */
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  empty: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: text.muted,
    fontSize: 13,
    paddingTop: 30,
  },

  row: { flexDirection: 'row', justifyContent: 'flex-start' },
  rowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
  },
  bubbleOther: {
    backgroundColor: 'rgba(40,60,110,0.7)',
    borderTopLeftRadius: 3,
  },
  bubbleMine: {
    backgroundColor: 'rgba(47,143,255,0.35)',
    borderTopRightRadius: 3,
  },
  name: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  body: { fontSize: 14, lineHeight: 19, color: text.primary },

  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: boardColors.hair,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: 'rgba(47,143,255,0.5)',
    backgroundColor: 'rgba(4,8,26,0.9)',
    paddingHorizontal: 12,
    color: text.primary,
    fontSize: 14,
  },
  sendBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: boardColors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { backgroundColor: 'rgba(47,143,255,0.3)' },
  sendText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#fff',
  },
});
