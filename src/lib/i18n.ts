import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const supportedLngs = ['en', 'ur'] as const;
type AppLanguage = (typeof supportedLngs)[number];

function normalizeLanguage(input: string | null | undefined): AppLanguage {
  if (!input) return 'en';
  const value = input.toLowerCase();
  if (value.startsWith('ur')) return 'ur';
  return 'en';
}

function detectInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem('aow_language');
  if (stored) return normalizeLanguage(stored);
  return normalizeLanguage(window.navigator.language);
}

function applyDocumentDirection(lng: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng;
  document.documentElement.dir = lng.startsWith('ur') ? 'rtl' : 'ltr';
}

async function loadLocaleFromPublic(lng: AppLanguage): Promise<Record<string, string> | null> {
  try {
    const response = await fetch(`/locales/${lng}.json`);
    if (!response.ok) return null;
    return (await response.json()) as Record<string, string>;
  } catch {
    return null;
  }
}

async function loadAndRegisterLocales(): Promise<void> {
  const locales = await Promise.all(
    supportedLngs.map(async (lng) => {
      const data = await loadLocaleFromPublic(lng);
      return { lng, data };
    })
  );

  for (const entry of locales) {
    if (!entry.data) continue;
    i18n.addResourceBundle(entry.lng, 'translation', entry.data, true, true);
  }
}

void i18n.use(initReactI18next).init({
  lng: detectInitialLanguage(),
  fallbackLng: 'en',
  supportedLngs: [...supportedLngs],
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('aow_language', normalizeLanguage(lng));
  }
  applyDocumentDirection(lng);
});

void loadAndRegisterLocales().then(() => {
  applyDocumentDirection(i18n.language);
});

void i18n.changeLanguage(detectInitialLanguage());

export default i18n;
