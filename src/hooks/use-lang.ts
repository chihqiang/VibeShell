import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getStorage, setStorage } from '@/utils/storage';
import { STORAGE_KEYS } from '@/constants/storage-keys';
import { Language } from '@/types/common';

export type { Language };

const LANG_KEY = STORAGE_KEYS.LANGUAGE;

const modules = import.meta.glob<{ default: Record<string, unknown> }>('@/i18n/*.json', {
  eager: true,
  import: 'default',
});

const resources: Record<string, { translation: Record<string, unknown> }> = {};
const availableLangs: string[] = [];

for (const [path, content] of Object.entries(modules)) {
  const lang = path.match(/\/([^/]+)\.json$/)?.[1];
  if (lang) {
    resources[lang] = { translation: content };
    availableLangs.push(lang);
  }
}

function readLanguage(): string {
  const raw = getStorage<string>(LANG_KEY, '');
  if (raw && availableLangs.includes(raw)) return raw;
  const browserLang = navigator.language.split('-')[0];
  if (availableLangs.includes(browserLang)) return browserLang;
  return availableLangs[0] || 'en';
}

const savedLang = readLanguage();

i18n.use(initReactI18next).init({
  resources,
  lng: savedLang,
  fallbackLng: availableLangs[0] || 'en',
  interpolation: {
    escapeValue: false,
  },
});

export const languageDisplayName: Record<Language, string> = {
  [Language.ZH]: '中文',
  [Language.EN]: 'English',
};

export const languageOptions = Object.values(Language);

export const changeLanguage = (lang: string) => {
  setStorage(LANG_KEY, lang);
  i18n.changeLanguage(lang);
};

export default i18n;
