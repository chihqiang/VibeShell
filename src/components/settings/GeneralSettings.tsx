import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { cn } from '@/utils';
import { Language, languageDisplayName, languageOptions, changeLanguage } from '@/hooks/use-lang';
import { type Theme, themeOptions, useTheme } from '@/hooks/use-theme';
import { terminalThemes, getStoredThemeId, setStoredThemeId } from '@/utils/terminal-themes';
import { DOM_EVENTS } from '@/constants';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectPopup,
  SelectList,
  SelectItem,
} from '@/components/ui/select';

interface GeneralSettingsProps {
  onSaved: () => void;
}

export function GeneralSettings({ onSaved }: GeneralSettingsProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [termThemeId, setTermThemeId] = useState(getStoredThemeId());

  const handleLanguageChange = (lang: Language) => {
    changeLanguage(lang);
    onSaved();
  };

  const handleThemeChange = (v: Theme) => {
    setTheme(v);
    onSaved();
  };

  const handleTermThemeChange = (id: string) => {
    setTermThemeId(id);
    setStoredThemeId(id);
    // Notify all live terminal instances to update their theme
    window.dispatchEvent(new CustomEvent(DOM_EVENTS.TERM_THEME_CHANGE));
    onSaved();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.general')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>{t('settings.language')}</Label>
          <div className="flex gap-2">
            {languageOptions.map((lang) => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                className={cn(
                  'h-8 px-4 text-xs rounded-lg border transition-all cursor-pointer',
                  i18n.language === lang
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-background border-input text-muted-foreground hover:border-muted-foreground',
                )}
              >
                {languageDisplayName[lang]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>{t('settings.theme')}</Label>
          <div className="mt-1">
            <Select value={theme} onValueChange={(v) => handleThemeChange(v as Theme)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('settings.themeSelect')} />
                <SelectIcon />
              </SelectTrigger>
              <SelectPopup>
                <SelectList>
                  {themeOptions.map((th) => (
                    <SelectItem key={th} value={th}>
                      {th === 'dark'
                        ? t('settings.dark')
                        : th === 'light'
                          ? t('settings.light')
                          : t('settings.auto', 'Auto')}
                    </SelectItem>
                  ))}
                </SelectList>
              </SelectPopup>
            </Select>
          </div>
        </div>
        <div>
          <Label>{t('settings.terminalTheme', 'Terminal Theme')}</Label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {terminalThemes.map((tt) => (
              <button
                key={tt.id}
                onClick={() => handleTermThemeChange(tt.id)}
                className={cn(
                  'flex items-center gap-2 h-8 px-3 text-xs rounded-lg border transition-all cursor-pointer',
                  termThemeId === tt.id
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-background border-input text-muted-foreground hover:border-muted-foreground',
                )}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 border border-border/50"
                  style={{ backgroundColor: tt.colors.background }}
                />
                {tt.name}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
