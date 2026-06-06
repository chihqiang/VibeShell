import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { saveHost, saveGroup } from '@/apis/api/hosts';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import HostForm from '@/components/host/HostForm';
import type { AuthMethod, HostFormData, HostFormState } from '@/lib/types';
import type { HostConfig } from '@/apis/types/hosts';
import type { KeyEntry } from '@/apis/types/keys';
import { getSshDefaults } from '@/storage/config';
import { useNotify } from '@/hooks/use-notify';
function formFromHost(host: HostConfig): HostFormState {
  return {
    name: host.name,
    hostname: host.hostname,
    port: host.port,
    username: host.username,
    authMethod: (host.auth_method as AuthMethod) || 'password',
    password: host.password || '',
    privateKeyPath: host.private_key_path || '',
    keyPassphrase: host.auth_method === 'key' ? host.password || '' : '',
    group: host.group || null,
  };
}

interface HostDialogProps {
  open: boolean;
  onClose: () => void;
  host?: HostConfig | null;
  groups: string[];
  keys: KeyEntry[];
}

export { type HostConfig };

export default function HostDialog({ open, onClose, host, groups, keys }: HostDialogProps) {
  const { t } = useTranslation();
  const { notifyError } = useNotify();
  const editing = !!host;
  const [form, setForm] = useState<HostFormState>(() =>
    host
      ? formFromHost(host)
      : {
          name: '',
          hostname: '',
          port: 22,
          username: '',
          authMethod: 'password',
          password: '',
          privateKeyPath: '',
          keyPassphrase: '',
          group: null,
        },
  );
  const [saving, setSaving] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState('');
  const groupRef = useRef<HTMLDivElement>(null);

  // Fetch SSH defaults and fill form when opening for new host
  useEffect(() => {
    if (open && !host) {
      getSshDefaults().then((d) => {
        setForm({
          name: '',
          hostname: d.hostname,
          port: d.port,
          username: d.username,
          authMethod: 'password',
          password: '',
          privateKeyPath: '',
          keyPassphrase: '',
          group: null,
        });
      });
    }
  }, [open, host]);

  useEffect(() => {
    if (host) {
      setForm(formFromHost(host));
    }
  }, [host, open]);

  useEffect(() => {
    if (!groupOpen) {
      setAddingGroup(false);
      setNewGroup('');
    }
  }, [groupOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setGroupOpen(false);
      }
    }
    if (groupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [groupOpen]);

  function updateField<K extends keyof HostFormState>(key: K, v: HostFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: v }));
  }

  const handleFormChange = (data: HostFormData) => {
    setForm((prev) => ({ ...prev, ...data }));
  };

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        id: host?.id || '',
        name: form.name,
        hostname: form.hostname,
        port: form.port || 22,
        username: form.username,
        auth_method: form.authMethod,
        password: form.authMethod === 'password' ? form.password : form.keyPassphrase || null,
        private_key_path: form.authMethod === 'key' ? form.privateKeyPath || null : null,
        group: form.group,
        created_at: host?.created_at || 0,
        updated_at: Date.now(),
      };
      await saveHost({ host: payload });
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddGroup() {
    const name = newGroup.trim();
    if (!name) return;
    try {
      await saveGroup({ group: name });
      updateField('group', name);
      setAddingGroup(false);
      setNewGroup('');
    } catch (e) {
      notifyError(e);
    }
  }

  const selectedGroupLabel = form.group || t('sidebar.noGroup');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="w-[460px] sm:max-w-[460px] p-0">
        <DialogHeader>
          <DialogTitle>{editing ? t('sidebar.editHost') : t('sidebar.addHost')}</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          <div>
            <Label>{t('connection.name')}</Label>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="My Server"
            />
          </div>

          <HostForm
            value={{
              hostname: form.hostname,
              port: form.port,
              username: form.username,
              authMethod: form.authMethod,
              password: form.password,
              privateKeyPath: form.privateKeyPath,
              keyPassphrase: form.keyPassphrase,
            }}
            onChange={handleFormChange}
            keys={keys}
          />

          <div ref={groupRef} className="relative">
            <Label>{t('sidebar.selectGroup')}</Label>
            <button
              type="button"
              onClick={() => setGroupOpen(!groupOpen)}
              className={cn(
                'flex items-center justify-between w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm transition-colors',
                'hover:border-muted-foreground cursor-pointer',
              )}
            >
              <span className={form.group ? 'text-foreground' : 'text-muted-foreground'}>{selectedGroupLabel}</span>
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>

            {groupOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                {addingGroup ? (
                  <div className="flex items-center gap-1 p-2 border-b border-border">
                    <Input
                      type="text"
                      value={newGroup}
                      onChange={(e) => setNewGroup(e.target.value)}
                      placeholder={t('sidebar.groupName')}
                      className="h-7 text-xs flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddGroup();
                      }}
                    />
                    <Button size="xs" onClick={handleAddGroup} disabled={!newGroup.trim()}>
                      <Check size={12} />
                    </Button>
                  </div>
                ) : null}

                <button
                  onClick={() => {
                    updateField('group', null);
                    setGroupOpen(false);
                  }}
                  className={cn(
                    'flex items-center w-full h-8 px-3 text-sm text-left transition-colors hover:bg-muted cursor-pointer',
                    !form.group ? 'bg-primary/5 text-primary' : 'text-muted-foreground',
                  )}
                >
                  {t('sidebar.noGroup')}
                </button>

                {groups.length > 0 && <div className="h-px bg-border mx-2" />}

                {groups.map((g) => (
                  <button
                    key={g}
                    onClick={() => {
                      updateField('group', g);
                      setGroupOpen(false);
                    }}
                    className={cn(
                      'flex items-center w-full h-8 px-3 text-sm text-left transition-colors hover:bg-muted cursor-pointer',
                      form.group === g ? 'bg-primary/5 text-primary' : 'text-foreground',
                    )}
                  >
                    {g}
                  </button>
                ))}

                <div className="h-px bg-border mx-2" />

                {addingGroup ? null : (
                  <button
                    onClick={() => setAddingGroup(true)}
                    className="flex items-center gap-1.5 w-full h-8 px-3 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                    {t('sidebar.addGroup')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('connection.cancel')}
            </Button>
            <Button size="sm" disabled={!form.name || !form.hostname || !form.username || saving} onClick={handleSave}>
              {saving ? t('common.loading') : t('connection.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
