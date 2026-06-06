import { useTranslation } from 'react-i18next';

export function KeychainSettings() {
  const { t } = useTranslation();

  return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
}
