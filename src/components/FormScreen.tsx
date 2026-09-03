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
  /**
   * Phần đặt xuống CỘT TRÁI, ngay dưới phụ đề.
   *
   * Có mặt vì bố cục ngang: cột phải chỉ cao ~340dp, mà màn nhận ghế có tới
   * bốn khối (tên, giới tính, lưới nhân vật, nút gửi). Nhét cả bốn vào một cột
   * là người chơi phải cuộn mới thấy nút - dồn hai khối nhỏ sang cột trái thì
   * vừa hết, và cột trái vốn đang trống bên dưới tiêu đề.
   */
  aside?: React.ReactNode;
  onBack?: () => void;
};

/**
 * Khung chung cho các màn có form (nhập license, nhập thông tin, nhập OTP,
 * nhận ghế).
 *
 * BỐ CỤC NGANG (2026-09-03): tiêu đề bên trái, form bên phải. Xếp dọc như bản
 * cũ thì riêng tiêu đề + phụ đề đã ăn hết một phần ba của 393dp bề cao, và
 * form phải cuộn ngay từ trường đầu tiên.
 *
 * Bàn phím: `KeyboardAvoidingView` + ScrollView `handled` - trên Android bàn
 * phím che mất nút submit nếu để mặc định, và người dùng sẽ tưởng nút biến mất.
 * Ở chiều ngang bàn phím còn cao tương đối hơn nhiều, nên phần này càng cần.
 */
export function FormScreen({ title, subtitle, children, aside, onBack }: Props) {
  const router = useRouter();
  const t = useT();

  return (
    <View style={styles.root}>
      <StageBackground />

      {/* Ngang thì tai thỏ nằm ở cạnh trái/phải - phải khai báo cả `left`/`right`. */}
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.body}>
          {/*
            Nút back nổi ĐÈ LÊN, không nằm trong dòng chảy: ở chiều ngang mỗi
            dp bề cao đều đắt, mà nút này chỉ chiếm một góc vốn đang trống.
          */}
          <Pressable
            style={styles.back}
            onPress={onBack ?? (() => router.back())}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color={text.primary} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>

          <View style={styles.row}>
            <View style={styles.titleCol}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              {aside ? <View style={styles.aside}>{aside}</View> : null}
            </View>

            <KeyboardAvoidingView
              style={styles.formCol}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.form}>{children}</View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: bg.deep },
  safe: { flex: 1 },
  /** Mốc định vị cho nút back nổi - `position: 'absolute'` bám vào đây. */
  body: { flex: 1 },

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

  /**
   * `paddingTop` chừa chỗ cho nút back nổi phía trên. Không có nó thì tiêu đề
   * dài hai dòng sẽ chui lên dưới nút.
   */
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 12,
    paddingHorizontal: 20,
    gap: 20,
  },

  titleCol: { flex: 1, justifyContent: 'center' },
  /**
   * Form rộng hơn hẳn cột tiêu đề: nó chứa ô nhập, nút, và ở màn nhận ghế là
   * cả lưới nhân vật - mà số ô trên một hàng của lưới đó phụ thuộc thẳng vào
   * bề ngang chỗ này (xem `character` trong `app/seat.tsx`).
   */
  formCol: { flex: 1.5 },

  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 4 },
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
  aside: { marginTop: 18, gap: 12 },
  /** `marginTop` cũ bỏ đi: tiêu đề không còn nằm ngay trên form nữa. */
  form: { gap: 16 },
});
