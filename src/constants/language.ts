export enum Language {
  ZH = 'zh',
  EN = 'en',
}

export const languageDisplayName: Record<Language, string> = {
  [Language.ZH]: '中文',
  [Language.EN]: 'English',
};

export const languageOptions = Object.values(Language);
