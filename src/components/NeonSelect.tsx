import { Pressable, StyleSheet, Text, View } from 'react-native';

import { outerGlow, text, type NeonColor } from '../theme/colors';

export type SelectOption<T> = { value: T; label: string };

type Props<T> = {
  label: string;
  color: NeonColor;
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
};

/**
 * Chọn một trong nhiều lựa chọn, hiển thị thành các viên thuốc xếp tràn dòng.
 *
 * Dùng kiểu này thay vì dropdown: số lựa chọn ít (1-6 người chơi, 3-4 mốc thời
 * lượng) và mọi lựa chọn nhìn thấy được cùng lúc thì nhanh hơn - đây là màn
 * hình dựng ván trước khi chơi, không phải form dài.
 *
 * Chỉ viên ĐANG CHỌN mới phát sáng. Cho tất cả cùng sáng thì không còn phân
 * biệt được cái nào đang chọn, và cả màn hình thành một mảng chói.
 */
export function NeonSelect<T extends string | number>({
  label,
  color,
  options,
  value,
  onChange,
  disabled,
}: Props<T>) {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[
                styles.pill,
                selected
                  ? { borderColor: color.stroke, boxShadow: outerGlow(color) }
                  : styles.pillIdle,
                disabled && styles.disabled,
              ]}
            >
              <Text
                style={[styles.pillText, selected ? { color: color.stroke } : styles.pillTextIdle]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  label: { color: text.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1.6 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    minWidth: 56,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0812',
  },
  pillIdle: { borderColor: 'rgba(255,255,255,0.16)' },
  pillText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.4 },
  pillTextIdle: { color: 'rgba(255,255,255,0.62)' },
  disabled: { opacity: 0.45 },
});
