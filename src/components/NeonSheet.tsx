import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import { Halftone } from './Halftone';

import { MODAL_ORIENTATIONS } from '../utils/modalOrientations';
/**
 * Khung tấm nổi dùng chung cho các tấm K107–K111 (Go big!, free trial, unlock, giới thiệu game,
 * nhân vật đã có người) — Tony 18/9: *"bỏ nền đen đi, mockup tôi gửi có nền là demo… hãy phác
 * thảo popup đẹp hơn"*. Cùng ngôn ngữ hình với `ConfirmDialog`: viền gradient xanh → tím,
 * thân xanh đen mờ (nền sân khấu hiện xuyên qua), chấm halftone góc phải, quầng sáng tím.
 *
 * Chạm ra ngoài = đóng. Nội dung tự lo bố cục bên trong.
 *
 * ⚠️ `Modal` KHÔNG nằm trong SafeAreaView của màn - ở chiều ngang thanh điều hướng Android (3 nút /
 * vạch cử chỉ) chiếm một cạnh trái/phải, tấm rộng sẽ chui xuống dưới nó (đã dính ở tấm giới thiệu
 * game, Tony 18/9: "nhớ tính padding cho các control mặc định của android tại left và right").
 * Nên cộng `useSafeAreaInsets()` vào lề nền.
 */
export function NeonSheet({
  visible,
  onClose,
  maxWidth = 560,
  style,
  closeButton = false,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  maxWidth?: number;
  /**
   * Nút ✕ tròn đè góc trên phải, nhô ra ngoài mép tấm 10dp (Tony 19/9: "1 nút X nằm absolute trên
   * top right -10px… padding của contents sẽ đều" - thay hàng ‹ Back chiếm cả một dòng).
   */
  closeButton?: boolean;
  /** Style thêm cho thân tấm (padding, gap, alignItems…). */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal supportedOrientations={MODAL_ORIENTATIONS} visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View
        style={[
          styles.backdrop,
          {
            paddingTop: 20 + insets.top,
            paddingBottom: 20 + insets.bottom,
            paddingLeft: 20 + insets.left,
            paddingRight: 20 + insets.right,
          },
        ]}
      >
        <Pressable style={styles.backdropTouch} onPress={onClose} accessibilityRole="button" />
        <View style={[styles.frame, { maxWidth }]}>
        <LinearGradient
          colors={['#3AA5FF', '#7B5CFF', '#E05CFF']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.rim}
        >
          <View style={[styles.card, style]}>
            <LinearGradient
              colors={['rgba(24,16,56,0.9)', 'rgba(11,7,36,0.94)', 'rgba(7,5,26,0.96)']}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fill}
            />
            <Halftone color="#7B5CFF" style={styles.dots} opacity={0.14} />
            {children}
          </View>
        </LinearGradient>
        {closeButton ? (
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
        ) : null}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Nút trong tấm - Tony 18/9: *"button same cùng màu nhìn rất rối"* (viền xanh trên nền xanh tím).
 * `primary` = nút xanh lá đặc như CONFIRM của ConfirmDialog; `danger` = đỏ đặc; `ghost` = viền mờ
 * (hành động phụ: CANCEL, SHARE LINK). `sub` là dòng nhỏ dưới nhãn ("$59 per month").
 */
export function SheetButton({
  label,
  sub,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  style,
}: {
  label: string;
  sub?: string | null;
  onPress?: () => void;
  variant?: 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off || !onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      style={({ pressed }) => [styles.btnWrap, style, pressed && !off && styles.btnPressed, off && styles.btnOff]}
    >
      {variant === 'ghost' ? (
        <View style={[styles.btn, styles.btnGhost]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnLabel}>{label}</Text>}
          {sub && !busy ? <Text style={styles.btnSub}>{sub}</Text> : null}
        </View>
      ) : (
        <LinearGradient
          colors={variant === 'danger' ? ['#C00F2A', '#FF2D2D'] : ['#1B7F3B', '#2EE85F']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.btn, { boxShadow: variant === 'danger' ? '0 4px 14px rgba(255,45,45,0.45)' : '0 4px 14px rgba(46,232,95,0.40)' }]}
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnLabel}>{label}</Text>}
          {sub && !busy ? <Text style={styles.btnSub}>{sub}</Text> : null}
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btnWrap: { minWidth: 200 },
  btnPressed: { transform: [{ scale: 0.98 }] },
  btnOff: { opacity: 0.45 },
  btn: { minHeight: 46, borderRadius: 23, paddingHorizontal: 22, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { borderWidth: 1.5, borderColor: 'rgba(190,205,255,0.55)', backgroundColor: 'rgba(8,10,32,0.6)' },
  btnLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 1.4, textAlign: 'center' },
  btnSub: { color: 'rgba(255,255,255,0.92)', fontSize: 13.5, marginTop: 1, textAlign: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(3,3,14,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  frame: { width: '100%', maxHeight: '94%' },
  rim: { width: '100%', maxHeight: '100%', padding: 2, borderRadius: 22, boxShadow: '0 0 22px rgba(106,92,255,0.45)' },
  closeBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#E05CFF',
    backgroundColor: '#12102E',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 12px rgba(224,92,255,0.55)',
  },
  card: { borderRadius: 20, paddingHorizontal: 24, paddingVertical: 20, overflow: 'hidden', alignItems: 'center', gap: 16, flexShrink: 1 },
  dots: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 160 },
});
