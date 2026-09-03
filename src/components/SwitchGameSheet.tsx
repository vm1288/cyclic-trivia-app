import { LinearGradient } from 'expo-linear-gradient';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckCircle, lobbyColors } from './LobbyParts';
import { TrashIcon } from './NeonIcons';
import { useT } from '../i18n/I18nProvider';
import type { LicenseSession } from '../session/LicenseSession';
import { text } from '../theme/colors';

/**
 * Danh sách game (license) trên máy, và chỗ thêm license mới.
 *
 * Mỗi license là một sản phẩm khác nhau - đổi license là đổi logo, ngôn ngữ
 * mặc định, bàn cờ và bộ câu hỏi. Vì vậy hàng nào cũng hiện LOGO sponsor: tên
 * chữ không đủ để nhận ra ngay khi người ta có hai hộp trông giống nhau.
 */
export function SwitchGameSheet({
  visible,
  sessions,
  activeHostId,
  onSelect,
  onRemove,
  onAdd,
  onClose,
}: {
  visible: boolean;
  sessions: LicenseSession[];
  activeHostId: string | null;
  onSelect: (hostId: string) => void;
  onRemove: (hostId: string) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const t = useT();
  /*
   * Modal nằm NGOÀI `SafeAreaView` của màn hình, nên phải tự chừa mọi cạnh.
   *
   * ⚠️ Ở chiều ngang thì `insets.bottom` gần như bằng 0, còn tai thỏ và thanh
   * điều hướng chuyển sang hai cạnh BÊN. Chỉ chừa đáy như bản dọc là logo
   * sponsor bị tai thỏ cắt ở mép trái và nút gỡ bị thanh điều hướng che ở mép
   * phải - mà `paddingHorizontal` cố định thì không cứu được.
   */
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Phủ cả thanh trạng thái; thiếu cờ này thì trên Android có một dải sáng
      // ở đỉnh không bị làm tối.
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} accessibilityRole="button" />

        <View
          style={[
            styles.sheet,
            {
              paddingBottom: 20 + insets.bottom,
              paddingLeft: 20 + insets.left,
              paddingRight: 20 + insets.right,
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(24,16,56,0.97)', 'rgba(9,6,30,1)']}
            style={styles.fill}
          />

          <View style={styles.grabber} />

          <Text style={styles.title}>{t('switch.title')}</Text>
          <Text style={styles.subtitle}>{t('switch.subtitle')}</Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
            {sessions.map((s) => {
              const inUse = s.hostId === activeHostId;
              return (
                <Pressable
                  key={s.hostId}
                  onPress={() => onSelect(s.hostId)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: inUse }}
                  style={({ pressed }) => [
                    styles.row,
                    inUse && styles.rowActive,
                    pressed && styles.pressed,
                  ]}
                >
                  {s.sponsorLogoUri ? (
                    <Image source={{ uri: s.sponsorLogoUri }} style={styles.logo} resizeMode="contain" />
                  ) : (
                    <View style={styles.logoBlank} />
                  )}

                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {s.sponsorName || t('switch.unnamed', { code: s.licenseCode })}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {s.activated ? s.licenseCode : t('switch.pending')}
                    </Text>
                  </View>

                  {inUse ? (
                    <View style={styles.inUse}>
                      <CheckCircle />
                      <Text style={styles.inUseText}>{t('switch.inUse')}</Text>
                    </View>
                  ) : null}

                  {/*
                    Nút gỡ nằm TRONG hàng nhưng là một Pressable riêng, nên bấm
                    vào nó không kích hoạt việc chọn license của hàng.
                    `hitSlop` rộng vì icon nhỏ mà hành động lại không hoàn tác được.
                  */}
                  <Pressable
                    onPress={() => onRemove(s.hostId)}
                    accessibilityRole="button"
                    accessibilityLabel={t('switch.remove')}
                    hitSlop={12}
                    style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
                  >
                    <TrashIcon color="rgba(255,120,150,0.85)" />
                  </Pressable>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addWrap, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={[lobbyColors.violet, lobbyColors.purple]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.add}
            >
              <Text style={styles.addText}>{t('switch.add')}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,3,14,0.75)', justifyContent: 'flex-end' },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // Không dùng `StyleSheet.absoluteFillObject`: RN 0.86 bỏ khai báo kiểu của nó.
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  pressed: { opacity: 0.75 },

  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.5,
    borderColor: 'rgba(200,107,255,0.55)',
    overflow: 'hidden',
    // Lề ngang do chỗ dùng đặt (`20 + insets.left/right`), đừng đặt lại
    // `paddingHorizontal` ở đây - nó sẽ ghi đè và mất phần chừa tai thỏ.
    paddingTop: 10,
    /*
     * Chừa chỗ để vẫn thấy mình đang đứng trên màn nào, nhưng không nhiều.
     *
     * ⚠️ 80% như bản dọc là sai ở chiều ngang: 80% của 393dp chỉ còn ~314dp, và
     * sau tiêu đề + phụ đề + nút ADD thì danh sách chỉ hiện nổi một hàng rưỡi -
     * hàng thứ hai bị nút đè lên, nhìn như hỏng. 92% của 393dp là ~360dp, đủ
     * hai hàng trọn vẹn.
     */
    maxHeight: '92%',
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(190,205,255,0.35)',
    marginBottom: 14,
  },

  title: { fontSize: 15, fontWeight: '800', letterSpacing: 2, color: lobbyColors.cyan },
  subtitle: { marginTop: 6, fontSize: 13, lineHeight: 19, color: lobbyColors.dim },

  list: { marginTop: 14 },
  listInner: { gap: 10, paddingBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(120,150,220,0.25)',
    backgroundColor: 'rgba(12,14,38,0.72)',
  },
  rowActive: {
    borderColor: lobbyColors.green,
    boxShadow: '0 0 12px rgba(46,232,95,0.35)',
  },
  logo: { width: 52, height: 52, borderRadius: 10 },
  logoBlank: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: text.primary },
  rowSub: { fontSize: 12.5, color: lobbyColors.dim },
  inUse: { alignItems: 'center', gap: 3 },
  inUseText: { fontSize: 11, fontWeight: '700', color: lobbyColors.green },
  remove: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,120,150,0.35)',
  },

  addWrap: { marginTop: 16 },
  add: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 14px rgba(200,107,255,0.5)',
  },
  addText: { fontSize: 14.5, fontWeight: '800', letterSpacing: 1.4, color: '#FFFFFF' },
});
