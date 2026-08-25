import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StageBackground } from './StageBackground';
import { useT } from '../i18n/I18nProvider';
import { bg, text } from '../theme/colors';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onBack?: () => void;
};

/**
 * Khung chung cho các màn có form (nhập license, nhập thông tin, nhập OTP).
 *
 * Bàn phím: `KeyboardAvoidingView` + ScrollView `handled` - trên Android bàn
 * phím che mất nút submit nếu để mặc định, và người dùng sẽ tưởng nút biến mất.
 */
export function FormScreen({ title, subtitle, children, onBack }: Props) {
  const router = useRouter();
  const t = useT();

  return (
    <View style={styles.root}>
      <StageBackground />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Pressable
          style={styles.back}
          onPress={onBack ?? (() => router.back())}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={26} color={text.primary} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>

        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

            <View style={styles.form}>{children}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: bg.deep },
  safe: { flex: 1 },
  fill: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 2 },
  backText: { color: text.primary, fontSize: 17 },
  content: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 40 },
  title: {
    color: text.primary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subtitle: {
    color: text.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  form: { marginTop: 30, gap: 20 },
});
