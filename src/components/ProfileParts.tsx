import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { assetUrl } from '../api/game';
import { lobbyColors } from './LobbyParts';
import { StageBackground } from './StageBackground';
import { useT } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/translations';
import { bg, text } from '../theme/colors';

/**
 * Khung chung cho các màn của mockup V6 (Profile, Leaderboards, Account, đăng ký/đăng nhập email):
 * nền sân khấu, nút Back góc trái, tiêu đề giữa - cùng kiểu `FormScreen` nhưng không ép bố cục
 * hai cột (Profile và Leaderboards tự chia cột).
 */
export function ScreenShell({ title, children, onBack, right }: { title: string; children: ReactNode; onBack?: () => void; right?: ReactNode }) {
  const router = useRouter();
  const t = useT();
  return (
    <View style={styles.root}>
      <StageBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.head}>
          <Pressable
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            onPress={onBack ?? (() => router.back())}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color={text.primary} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={styles.headRight}>{right}</View>
        </View>
        <View style={styles.body}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

/** Ảnh đại diện tròn viền cam như mockup (nhân vật trong bộ CricTriv). */
export function Avatar({ url, size = 44, style }: { url: string | null | undefined; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {url ? (
        <Image source={{ uri: assetUrl(url) }} style={{ width: size * 0.86, height: size * 0.86 }} resizeMode="contain" />
      ) : (
        <Ionicons name="person" size={size * 0.5} color="#FF8A3D" />
      )}
    </View>
  );
}

/** Mã lỗi server của hồ sơ → câu dịch. */
export function profileErrorKey(code: string | null | undefined): TranslationKey {
  switch (code) {
    case 'nickname_taken': return 'profile.err.taken';
    case 'nickname_too_short': return 'profile.err.short';
    case 'nickname_too_long': return 'profile.err.long';
    case 'nickname_invalid': return 'profile.err.invalid';
    case 'email_invalid': return 'account.err.emailInvalid';
    case 'email_taken': return 'account.err.emailTaken';
    case 'email_not_found': return 'account.err.emailNotFound';
    case 'email_already_linked': return 'account.err.alreadyLinked';
    case 'otp_invalid': return 'account.err.codeInvalid';
    case 'otp_expired': return 'account.err.codeExpired';
    case 'otp_too_many': return 'account.err.codeTooMany';
    case 'otp_too_soon': return 'account.err.tooSoon';
    case 'email_send_failed': return 'account.err.sendFailed';
    case 'network': return 'error.network';
    default: return 'profile.err.generic';
  }
}

export const profileStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(120,150,220,0.25)',
    backgroundColor: 'rgba(12,14,38,0.78)',
  },
  sectionBar: {
    backgroundColor: 'rgba(120,130,170,0.28)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sectionText: { color: text.primary, fontSize: 15, fontWeight: '800' },
  dim: { color: lobbyColors.dim },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: bg.deep },
  safe: { flex: 1 },
  head: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  back: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 12, minWidth: 110 },
  backText: { color: text.primary, fontSize: 16 },
  title: { flex: 1, color: text.primary, fontSize: 22, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  headRight: { minWidth: 110, alignItems: 'flex-end' },
  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 8 },
  pressed: { opacity: 0.7 },
  avatar: {
    borderWidth: 2,
    borderColor: '#FF8A3D',
    backgroundColor: 'rgba(40,20,10,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
