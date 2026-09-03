import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StageBackground } from './StageBackground';
import { text } from '../theme/colors';

type Props = {
  title: string;
  /** Việc còn phải làm ở màn này - hiện luôn trên máy để khỏi phải tra tài liệu */
  todo: string;
};

/** Màn hình tạm để 4 nút ở trang chính bấm được trong lúc chưa dựng luồng thật. */
export function PlaceholderScreen({ title, todo }: Props) {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <StageBackground />
      {/* Ngang thì tai thỏ nằm ở cạnh trái/phải - phải khai báo cả `left`/`right`. */}
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        {/* ⚠️ Lớp bọc `flex: 1` BẮT BUỘC cho nút back nổi - xem `lobby.tsx`.
            `SafeAreaView` chèn khoảng an toàn bằng padding, mà con
            `position: 'absolute'` neo theo mép ngoài, nên thiếu lớp này là chữ
            Back chồng lên thanh trạng thái. */}
        <View style={styles.frame}>
          {/* Nút back nổi đè lên, không nằm trong dòng chảy - xem `FormScreen`. */}
          <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button">
            <Ionicons name="chevron-back" size={24} color={text.primary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.body}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.todo}>{todo}</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070B1F' },
  safe: { flex: 1 },
  /** Mốc định vị cho nút back nổi - xem ghi chú ở chỗ dùng. */
  frame: { flex: 1 },
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
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 16,
    gap: 12,
  },
  title: { color: text.primary, fontSize: 26, fontWeight: '800', letterSpacing: 1.5 },
  // Chặn bề ngang: ở màn ngang, một dòng chữ trải hết 850dp rất khó đọc.
  todo: { color: text.muted, fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 560 },
});
