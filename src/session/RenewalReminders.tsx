import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { useI18n } from '../i18n/I18nProvider';
import { useLicense } from './LicenseSession';

/**
 * Nhắc "gói sắp TỰ GIA HẠN" bằng thông báo trên máy, 1 ngày trước ngày store thu tiền
 * (Tony 2/10: "chỉ nên notification thông báo tự động gia hạn trước vài ngày hoặc 1 ngày",
 * thay cho popup "Licence expired" lúc hết hạn).
 *
 * Thông báo HẸN SẴN trên máy (local), không qua server: hẹn lại mỗi lần danh sách licence
 * đổi (mua, refresh token - lúc đó `licenseExpiresAt` theo ngày gia hạn mới). Chỉ licence
 * server báo `renews` (mua qua store, chưa tắt tự gia hạn).
 *
 * ⚠️ App không mở suốt một kỳ thì kỳ sau không có nhắc - local notification chỉ hẹn được
 * khi app chạy. Chấp nhận: refresh token chạy mỗi lần mở app trong 3 ngày cuối kỳ, nên ai
 * mở app quanh ngày gia hạn đều được hẹn đúng.
 *
 * Gói test của Play gia hạn 5 phút/lần → "1 ngày trước" đã qua, không hẹn gì - đúng.
 */
const KIND = 'renewal-reminder';

/* Không đặt handler thì thông báo tới lúc app ĐANG MỞ bị nuốt im lặng. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
const LEAD_MS = 24 * 60 * 60 * 1000;

export function RenewalReminders() {
  const { all: sessions } = useLicense();
  const { t, language } = useI18n();

  /* Chỉ những gì quyết định lịch hẹn - đổi token thôi thì không hẹn lại. */
  const key = sessions
    .map((s) => `${s.hostId}|${s.licenseExpiresAt ?? ''}|${s.renews === true}|${s.inTrial === true}|${s.sponsorName ?? ''}`)
    .join(';') + `#${language}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const due = sessions
          .filter((s) => s.renews === true && !!s.licenseExpiresAt)
          .map((s) => ({ s, at: Date.parse(s.licenseExpiresAt!) - LEAD_MS }))
          .filter((x) => !Number.isNaN(x.at) && x.at > Date.now() + 60_000);

        /* Huỷ mọi nhắc cũ của mình rồi hẹn lại từ đầu - ngày gia hạn đổi thì nhắc cũ là sai. */
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const n of scheduled) {
          if (n.content.data?.kind === KIND) await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }
        if (cancelled || due.length === 0) return;

        const perm = await Notifications.getPermissionsAsync();
        const granted = perm.granted || (perm.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
        if (!granted || cancelled) return;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('subscription', {
            name: 'Subscription',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const store = t(Platform.OS === 'ios' ? 'purchase.storeApple' : 'purchase.storeGoogle');
        for (const { s, at } of due) {
          const sponsor = s.sponsorName ?? t('expired.sponsorFallback');
          const date = new Date(Date.parse(s.licenseExpiresAt!)).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          const trial = s.inTrial === true;
          await Notifications.scheduleNotificationAsync({
            content: {
              title: t(trial ? 'reminder.trialTitle' : 'reminder.renewTitle', { sponsor }),
              body: t(trial ? 'reminder.trialBody' : 'reminder.renewBody', { date, store }),
              data: { kind: KIND, hostId: s.hostId },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(at),
              ...(Platform.OS === 'android' ? { channelId: 'subscription' } : {}),
            },
          });
        }
      } catch (e) {
        /* Nhắc là phần phụ - lỗi (máy chặn thông báo, bản cũ chưa có module) không được làm vỡ app. */
        console.warn('renewal reminder', e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
