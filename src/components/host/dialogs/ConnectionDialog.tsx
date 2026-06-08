import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, KeyRound, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSshDefaults } from '@/storage/config';
import { sshTestConnect } from '@/apis/api/ssh';
import { useNotify } from '@/hooks/use-notify';
import type { ConnectionConfig } from '@/lib/types';

interface ConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: (config: ConnectionConfig) => void;
}

export default function ConnectionDialog({ open, onClose, onConnect }: ConnectionDialogProps) {
  const { t } = useTranslation();
  const { notify, notifyError } = useNotify();
  const [config, setConfig] = useState<ConnectionConfig>({
    name: '',
    hostname: '',
    port: 22,
    username: '',
    authMethod: 'password',
    password: '',
    privateKeyPath: '',
    keyPassphrase: '',
  });
  const [testing, setTesting] = useState(false);
  const defaultsRef = useRef<{ hostname: string; port: number; username: string } | null>(null);

  // Fetch defaults from backend when dialog opens
  useEffect(() => {
    if (open) {
      getSshDefaults().then((d) => {
        defaultsRef.current = d;
        setConfig({
          name: '',
          hostname: d.hostname,
          port: d.port,
          username: d.username,
          authMethod: 'password',
          password: '',
          privateKeyPath: '',
          keyPassphrase: '',
        });
      });
    }
  }, [open]);

  const handleConnect = () => {
    onConnect({ ...config, port: config.port || 22 });
    if (defaultsRef.current) {
      const d = defaultsRef.current;
      setConfig({
        name: '',
        hostname: d.hostname,
        port: d.port,
        username: d.username,
        authMethod: 'password',
        password: '',
        privateKeyPath: '',
        keyPassphrase: '',
      });
    }
  };

  const updateField = <K extends keyof ConnectionConfig>(key: K, value: ConnectionConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await sshTestConnect({
        hostname: config.hostname,
        port: config.port || 22,
        username: config.username,
        password: config.authMethod === 'password' ? config.password || null : null,
        privateKeyPath: config.authMethod === 'key' ? config.privateKeyPath || null : null,
      });
      notify('Connection successful');
    } catch (e) {
      notifyError(e);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="w-[440px] sm:max-w-[440px] p-0">
        <DialogHeader>
          <DialogTitle>{t('connection.connect')}</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          <div>
            <Label>{t('connection.name')}</Label>
            <Input
              type="text"
              value={config.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="My Server"
            />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <Label>{t('connection.hostname')}</Label>
              <Input
                type="text"
                value={config.hostname}
                onChange={(e) => updateField('hostname', e.target.value)}
                placeholder="192.168.1.1"
              />
            </div>
            <div>
              <Label>{t('connection.port')}</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={config.port || ''}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '');
                  updateField('port', v === '' ? 0 : parseInt(v, 10));
                }}
              />
            </div>
          </div>

          <div>
            <Label>{t('connection.username')}</Label>
            <Input type="text" value={config.username} onChange={(e) => updateField('username', e.target.value)} />
          </div>

          <div>
            <Label>{t('connection.authMethod')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['password', 'key'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => updateField('authMethod', method)}
                  className={cn(
                    'flex items-center justify-center gap-2 h-9 text-sm rounded-lg border transition-all cursor-pointer',
                    config.authMethod === method
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-background border-input text-muted-foreground hover:border-muted-foreground',
                  )}
                >
                  {method === 'password' ? <Lock size={14} /> : <KeyRound size={14} />}
                  {method === 'password' ? t('connection.passwordAuth') : t('connection.keyAuth')}
                </button>
              ))}
            </div>
          </div>

          {config.authMethod === 'password' ? (
            <div>
              <Label>{t('connection.password')}</Label>
              <Input
                type="password"
                value={config.password}
                onChange={(e) => updateField('password', e.target.value)}
              />
            </div>
          ) : (
            <>
              <div>
                <Label>{t('connection.privateKey')}</Label>
                <Input
                  type="text"
                  value={config.privateKeyPath}
                  onChange={(e) => updateField('privateKeyPath', e.target.value)}
                  placeholder="~/.ssh/id_rsa"
                />
              </div>
              <div>
                <Label>{t('sidebar.keyPassphrase')}</Label>
                <Input
                  type="password"
                  value={config.keyPassphrase}
                  onChange={(e) => updateField('keyPassphrase', e.target.value)}
                  placeholder={t('sidebar.keyPassphrasePlaceholder')}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleTest}
            disabled={testing || !config.hostname || !config.username}
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Info size={14} />}
            {t('connection.testConnection')}
          </Button>
          <div className="flex gap-2">
            <DialogClose render={<Button variant="outline" size="sm" />}>{t('connection.cancel')}</DialogClose>
            <Button size="sm" disabled={!config.hostname || !config.username} onClick={handleConnect}>
              {t('connection.connect')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
