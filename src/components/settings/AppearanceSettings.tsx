import { useTranslation } from 'react-i18next';
import { useTheme, type Theme, themeOptions } from '@/hooks/use-theme';
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

interface AppearanceSettingsProps {
  onSaved: () => void;
}

export function AppearanceSettings({ onSaved }: AppearanceSettingsProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (v: Theme) => {
    setTheme(v);
    onSaved();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.appearance')}</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
