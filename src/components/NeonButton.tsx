import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Halftone } from './Halftone';
import type { NeonIcon } from './NeonIcons';
import {
  buttonBody,
  iconGlow,
  innerGlow,
  outerGlow,
  text,
  type NeonColor,
} from '../theme/colors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  label: string;
  color: NeonColor;
  onPress?: () => void;
  /** Bỏ trống khi dùng làm nút submit - lúc đó nhãn tự căn giữa. */
  Icon?: NeonIcon;
  /** Dòng phụ nhỏ dưới nhãn, vd "4 người · 15 phút" cho nút tiếp tục ván. */
  sublabel?: string;
  /** Đang gọi server: thay chevron bằng vòng quay và khoá nút lại. */
  busy?: boolean;
  disabled?: boolean;
};

const BODY_HEIGHT = 58;

/**
 * Nút viền neon của màn hình chính.
 *
 * Cấu tạo, từ ngoài vào - mọi con số theo `designs/Cyclic Home (standalone).html`:
 *   1. quầng sáng ngoài  - boxShadow BA lớp (18/46/90px), xem `outerGlow`
 *   2. viền              - gradient dọc `mid → stroke → mid`, dày 4px
 *   3. thân              - gradient tối 3 chặng + boxShadow inset: gờ trắng 1px
 *                          ở cạnh trên và ánh sáng neon hắt vào, xem `innerGlow`
 *   4. hoạ tiết          - lưới chấm halftone dồn về phải + sợi sáng cạnh trên
 *   5. icon & chevron    - mỗi cái hai lớp glow riêng
 *
 * Không dùng ảnh, nên nút co giãn theo bề rộng máy và đổi được nhãn theo ngôn ngữ.
 *
 * Hiệu ứng nhấn chạy bằng Reanimated (UI thread) chứ KHÔNG qua React state -
 * xem NEXT_STEPS.md: JS thread của app này sẽ bận vì packet SignalR, animation
 * chạy trên đó sẽ giật.
 */
export function NeonButton({ label, Icon, color, onPress, busy, disabled, sublabel }: Props) {
  const pressed = useSharedValue(0);
  const locked = Boolean(busy || disabled);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: pressed.value * 1 },
      { scale: 1 - pressed.value * 0.015 },
    ],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: locked, busy }}
      disabled={locked}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 160 });
      }}
      style={[animatedStyle, disabled && styles.disabled]}
    >
      <LinearGradient
        colors={[color.mid, color.stroke, color.stroke, color.mid]}
        locations={[0, 0.22, 0.78, 1]}
        style={[styles.rim, { boxShadow: outerGlow(color) }]}
      >
        <LinearGradient
          colors={[...buttonBody]}
          locations={[0, 0.55, 1]}
          style={[styles.body, { boxShadow: innerGlow(color) }]}
        >
          <Halftone color={color.stroke} />

          {Icon && (
            <View style={[styles.iconWrap, { filter: iconGlow(color) }]}>
              <Icon color={color.stroke} />
            </View>
          )}

          <View style={styles.labelBlock}>
            <Text style={[styles.label, !Icon && styles.labelCentered]} numberOfLines={1}>
              {label}
            </Text>
            {sublabel ? (
              <Text style={styles.sublabel} numberOfLines={1}>
                {sublabel}
              </Text>
            ) : null}
          </View>

          {/*
            Thiết kế gốc cho chevron hai lớp glow (14px + 30px), phải xếp chồng
            hai <Text> vì `textShadow*` của RN chỉ nhận một lớp. Đã hạ về một
            lớp mảnh - vừa dịu hơn vừa bỏ được cái chồng lớp đó.
          */}
          {Icon && !busy && (
            <Text style={[styles.chevron, { color: color.stroke, textShadowColor: color.stroke }]}>
              ›
            </Text>
          )}

          {/* Không icon = nút submit, nhãn căn giữa: đặt vòng quay ra tuyệt đối
              để nó không đẩy nhãn lệch khỏi tâm khi đang chờ server. */}
          {busy && (
            <ActivityIndicator color={color.stroke} style={!Icon && styles.busyFloating} />
          )}
        </LinearGradient>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  rim: { padding: 3, borderRadius: 16 },
  body: {
    height: BODY_HEIGHT,
    borderRadius: 13,
    paddingLeft: 8,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  iconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  labelBlock: { flex: 1 },
  label: {
    color: text.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sublabel: { marginTop: 2, color: text.muted, fontSize: 11.5, letterSpacing: 0.4 },
  labelCentered: { textAlign: 'center' },
  busyFloating: { position: 'absolute', right: 16 },
  disabled: { opacity: 0.45 },
  chevron: {
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '800',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
