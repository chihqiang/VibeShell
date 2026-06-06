import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { ConnectionConfig } from '@/lib/types';

interface SftpHeaderProps {
  conn: ConnectionConfig;
}

export function SftpHeader({ conn }: SftpHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-border">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <h2 className="text-sm font-semibold text-foreground">
          {t('sftp.title')} — {conn.username}@{conn.hostname}:{conn.port}
        </h2>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={() => navigate('/')}>
        <X size={14} />
      </Button>
    </div>
  );
}
