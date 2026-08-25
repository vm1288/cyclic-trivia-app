import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  FALLBACK,
  toLanguage,
  translations,
  type Language,
  type TranslationKey,
} from './translations';
import { useLicense } from '../session/LicenseSession';

const OVERRIDE_KEY = 'cyclic.language.override';

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

type I18nContextValue = {
  language: Language;
  t: Translate;
  /** Người dùng tự chọn ngôn ngữ; truyền null để quay về mặc định theo sponsor. */
  setLanguage: (language: Language | null) => Promise<void>;
  /** true khi ngôn ngữ hiện tại do người dùng chọn chứ không phải suy ra. */
  isOverridden: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const license = useLicense();
  const [override, setOverride] = useState<Language | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(OVERRIDE_KEY);
        if (alive) setOverride(toLanguage(saved));
      } catch {
        /* không đọc được thì coi như chưa chọn gì */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Thứ tự ưu tiên:
   *   1. người dùng tự chọn
   *   2. ngôn ngữ chính của sponsor gắn với license (server trả về lúc kích hoạt)
   *   3. tiếng Anh
   *
   * CỐ Ý KHÔNG đọc ngôn ngữ của máy. Tiếng Anh luôn là mặc định: sản phẩm bán
   * theo sponsor, ngôn ngữ do sponsor quyết định chứ không phải do máy người
   * dùng đang để tiếng gì. Đã thử cách đọc ngôn ngữ máy và nó gây bất ngờ đúng
   * kiểu này - máy để tiếng Việt thì app hiện tiếng Việt dù chưa có license nào
   * nói rằng nên như vậy.
   */
  const sponsorLanguage =
    license.status === 'active' || license.status === 'pending'
      ? toLanguage(license.session.languageCode)
      : null;

  const language = override ?? sponsorLanguage ?? FALLBACK;

  const t = useCallback<Translate>(
    (key, vars) => {
      const table = translations[language];
      // Bản dịch thiếu key thì rơi về tiếng Anh chứ không hiện key trần ra màn hình.
      const raw: string = table[key] ?? translations[FALLBACK][key] ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (match, name) =>
        name in vars ? String(vars[name]) : match,
      );
    },
    [language],
  );

  const setLanguage = useCallback(async (next: Language | null) => {
    setOverride(next);
    if (next) await SecureStore.setItemAsync(OVERRIDE_KEY, next);
    else await SecureStore.deleteItemAsync(OVERRIDE_KEY);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ language, t, setLanguage, isOverridden: override !== null }),
    [language, t, setLanguage, override],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n phải nằm trong <I18nProvider>');
  return value;
}

/** Lối tắt cho trường hợp hay gặp nhất: chỉ cần hàm dịch. */
export function useT(): Translate {
  return useI18n().t;
}
