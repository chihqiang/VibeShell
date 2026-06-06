import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Language, languageDisplayName, languageOptions, changeLanguage } from '@/hooks/use-lang';
import { type Theme, themeOptions, useTheme } from '@/hooks/use-theme';
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

  const handleLanguageChange = (lang: Language) => {
    changeLanguage(lang);
    onSaved();
  };

  const handleThemeChange = (v: Theme) => {
    setTheme(v);
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
                      {th === 'dark' ? t('settings.dark') : t('settings.light')}
                    </SelectItem>
                  ))}
                </SelectList>
              </SelectPopup>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
