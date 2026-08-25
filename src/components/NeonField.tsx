import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { buttonBody, text, type NeonColor } from '../theme/colors';

type Props = TextInputProps & {
  label: string;
  color: NeonColor;
  /** Thông báo lỗi hiện ngay dưới ô; đồng thời đổi viền sang đỏ. */
  error?: string | null;
};

const ERROR_STROKE = '#FF4D6A';

/**
 * Ô nhập theo cùng ngôn ngữ hình với NeonButton: viền gradient mảnh, thân tối.
 *
 * Viền ở đây mỏng hơn nút (2px so với 4px) và KHÔNG có quầng sáng ngoài - ô
 * nhập mà cũng phát sáng như nút thì cả màn hình không còn đâu là chỗ để bấm.
 */
export const NeonField = forwardRef<TextInput, Props>(function NeonField(
  { label, color, error, style, ...inputProps },
  ref,
) {
  const stroke = error ? ERROR_STROKE : color.stroke;
  const mid = error ? '#FF93A6' : color.mid;

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>

      <LinearGradient
        colors={[mid, stroke, stroke, mid]}
        locations={[0, 0.22, 0.78, 1]}
        style={styles.rim}
      >
        <LinearGradient colors={[...buttonBody]} locations={[0, 0.55, 1]} style={styles.body}>
          <TextInput
            ref={ref}
            placeholderTextColor="rgba(255,255,255,0.32)"
            selectionColor={color.stroke}
            style={[styles.input, style]}
            {...inputProps}
          />
        </LinearGradient>
      </LinearGradient>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: 8 },
  label: {
    color: text.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  rim: { padding: 2, borderRadius: 14 },
  body: { borderRadius: 12, overflow: 'hidden' },
  input: {
    height: 54,
    paddingHorizontal: 16,
    color: text.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  error: { color: ERROR_STROKE, fontSize: 13, lineHeight: 18 },
});
