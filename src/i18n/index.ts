import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Language } from '@/constants/language';
import { setStorage } from '@/lib/storage';
import zh from '@/i18n/zh.json';
import en from '@/i18n/en.json';

const LANG_KEY = 'vibeshell-language';

function readLanguage(): Language {
  try {
    const parsed = JSON.parse(localStorage.getItem(LANG_KEY) || '');
    if (parsed === 'zh' || parsed === 'en') return parsed as Language;
  } catch {
    const raw = localStorage.getItem(LANG_KEY);
    if (raw === 'zh' || raw === 'en') {
      setStorage(LANG_KEY, raw);
      return raw as Language;
    }
  }
  return Language.ZH;
}

const savedLang = readLanguage();

i18n.use(initReactI18next).init({
  resources: {
    [Language.ZH]: { translation: zh },
    [Language.EN]: { translation: en },
  },
  lng: savedLang,
  fallbackLng: Language.ZH,
  interpolation: {
    escapeValue: false,
  },
});

export const changeLanguage = (lang: Language) => {
  setStorage(LANG_KEY, lang);
  i18n.changeLanguage(lang);
};

export default i18n;
