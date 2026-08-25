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
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={text.primary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.todo}>{todo}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070B1F' },
  safe: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 2 },
  backText: { color: text.primary, fontSize: 17 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  title: { color: text.primary, fontSize: 26, fontWeight: '800', letterSpacing: 1.5 },
  todo: { color: text.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
