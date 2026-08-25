import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Halftone } from './Halftone';

/**
 * Hộp thoại xác nhận dùng chung, thay cho `Alert.alert` của hệ thống.
 *
 * VÌ SAO KHÔNG DÙNG ALERT HỆ THỐNG: nó mang giao diện của Android/iOS - nền
 * xám, nút phẳng - đặt giữa một app neon tối thì như rơi từ app khác sang. Nó
 * cũng không đổi được màu để phân biệt hành động phá huỷ với hành động thường.
 *
 * CÁCH DÙNG - không tự quản `visible`, gọi như một hàm và chờ kết quả:
 *
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Bỏ ván đang mở?',
 *     message: '...',
 *     confirmLabel: 'BỎ VÁN',
 *     destructive: true,
 *   });
 *   if (ok) { ... }
 *
 * Đóng bằng nút ✕ hoặc nút back đều tính là HUỶ - trả về false.
 */

export type ConfirmOptions = {
  title: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  /** true = hành động phá huỷ, nút xác nhận chuyển sang đỏ. */
  destructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  /*
   * Giữ `resolve` trong ref chứ không trong state: đổi nó KHÔNG được kéo theo
   * một lần render nữa, và nó phải sống sót qua các lần render giữa lúc mở và
   * lúc người dùng bấm.
   */
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    return new Promise<boolean>((resolve) => {
      // Mở hộp mới trong khi hộp cũ còn treo thì đóng lời hứa cũ lại bằng
      // `false`, nếu không chỗ gọi kia sẽ chờ mãi.
      resolveRef.current?.(false);
      resolveRef.current = resolve;
      setOptions(next);
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setOptions(null);
    resolveRef.current?.(value);
    resolveRef.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        visible={options !== null}
        options={options}
        onCancel={() => settle(false)}
        onConfirm={() => settle(true)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const value = useContext(ConfirmContext);
  if (!value) throw new Error('useConfirm phải nằm trong <ConfirmProvider>');
  return value;
}

function ConfirmDialog({
  visible,
  options,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  options: ConfirmOptions | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const destructive = options?.destructive ?? false;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Để lớp nền phủ cả thanh trạng thái; thiếu cờ này thì trên Android có
      // một dải sáng ở đỉnh không bị làm tối.
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        {/* Bấm ra ngoài = huỷ, giống thói quen của hộp thoại hệ thống. */}
        <Pressable style={styles.backdropTouch} onPress={onCancel} accessibilityRole="button" />

        <LinearGradient
          colors={['#3AA5FF', '#7B5CFF', '#E05CFF']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.rim}
        >
          <View style={styles.card}>
            <LinearGradient
              colors={['rgba(24,16,56,0.95)', 'rgba(11,7,36,0.98)', 'rgba(7,5,26,1)']}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fill}
            />
            <Halftone color="#7B5CFF" style={styles.dots} opacity={0.16} />

            <Pressable
              onPress={onCancel}
              style={styles.close}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={options?.cancelLabel ?? 'Close'}
            >
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>

            <View style={styles.copy}>
              <Text style={styles.title}>{options?.title}</Text>
              {options?.message ? <Text style={styles.message}>{options.message}</Text> : null}
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <View style={styles.cancel}>
                  <Text style={styles.actionLabel}>{options?.cancelLabel ?? 'CANCEL'}</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={onConfirm}
                accessibilityRole="button"
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={destructive ? ['#C00F2A', '#FF2D2D'] : ['#1B7F3B', '#2EE85F']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[
                    styles.confirm,
                    {
                      boxShadow: destructive
                        ? '0 4px 14px rgba(255,45,45,0.45)'
                        : '0 4px 14px rgba(46,232,95,0.40)',
                    },
                  ]}
                >
                  <Text style={styles.actionLabel}>{options?.confirmLabel ?? 'OK'}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,3,14,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  // Phủ kín phía sau thẻ để bắt cú chạm ra ngoài, nhưng nằm DƯỚI thẻ nên không
  // nuốt mất cú chạm vào chính các nút.
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // Không dùng `StyleSheet.absoluteFillObject`: RN 0.86 bỏ khai báo kiểu của nó.
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  rim: {
    width: '100%',
    maxWidth: 392,
    padding: 2.5,
    borderRadius: 24,
    boxShadow: '0 0 22px rgba(106,92,255,0.5)',
  },
  card: {
    borderRadius: 22,
    paddingHorizontal: 26,
    paddingTop: 26,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  dots: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 160 },

  close: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(190,205,255,0.55)',
    backgroundColor: 'rgba(12,10,34,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { color: '#E6ECFF', fontSize: 17 },

  copy: { paddingRight: 44, gap: 12 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: '#FFFFFF' },
  message: { fontSize: 15, lineHeight: 22, color: 'rgba(186,198,226,0.78)' },

  actions: { marginTop: 26, flexDirection: 'row', gap: 14 },
  action: { flex: 1 },
  pressed: { transform: [{ scale: 0.98 }] },
  cancel: {
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#35B7FF',
    backgroundColor: 'rgba(8,12,30,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 10px rgba(53,183,255,0.4)',
  },
  confirm: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 1.4, color: '#FFFFFF' },
});
