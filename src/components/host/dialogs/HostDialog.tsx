import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { saveHost } from '@/apis/api/hosts';
import { hostConfigToFormState, formStateToHostPayload } from '@/apis/utils/hosts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TagSelect from '@/components/ui/tag-select';
import HostForm from '@/components/host/HostForm';
import type { HostFormData, HostFormState } from '@/lib/types';
import type { HostConfig } from '@/apis/types/hosts';
import type { KeyEntry } from '@/apis/types/keys';
import { getSshDefaults } from '@/storage/config';
import { useNotify } from '@/hooks/use-notify';
interface HostDialogProps {
  open: boolean;
  onClose: () => void;
  host?: HostConfig | null;
  tags: string[];
  keys: KeyEntry[];
}

export { type HostConfig };

export default function HostDialog({ open, onClose, host, tags: allTags, keys }: HostDialogProps) {
  const { t } = useTranslation();
  const { notifyError } = useNotify();
  const editing = !!host;
  const [form, setForm] = useState<HostFormState>(() =>
    host
      ? hostConfigToFormState(host)
      : {
          name: '',
          hostname: '',
          port: 22,
          username: '',
          authMethod: 'password',
          password: '',
          privateKeyPath: '',
          keyPassphrase: '',
          tags: [],
        },
  );
  const [saving, setSaving] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);

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
          tags: [],
        });
      });
    }
  }, [open, host]);

  useEffect(() => {
    if (host) {
      setForm(hostConfigToFormState(host));
    }
  }, [host, open]);

  function updateField<K extends keyof HostFormState>(key: K, v: HostFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: v }));
  }

  const handleFormChange = (data: HostFormData) => {
    setForm((prev) => ({ ...prev, ...data }));
  };

  async function handleSave() {
    setSaving(true);
    try {
      await saveHost({ host: formStateToHostPayload(form, host) });
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  function openTagDialog() {
    setTagDialogOpen(true);
  }

  function handleConfirmTags(tags: string[]) {
    setForm((prev) => ({ ...prev, tags }));
  }

  return (
    <>
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

            <div>
              <Label>{t('sidebar.selectTag')}</Label>
              <button
                type="button"
                onClick={openTagDialog}
                className="flex items-center gap-1 flex-wrap w-full min-h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm transition-colors hover:border-muted-foreground cursor-pointer"
              >
                {form.tags.length > 0 ? (
                  form.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="h-5 text-[11px]">
                      {t}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">{t('sidebar.noTag')}</span>
                )}
              </button>
            </div>
          </div>

          <DialogFooter>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={onClose}>
                {t('connection.cancel')}
              </Button>
              <Button
                size="sm"
                disabled={!form.name || !form.hostname || !form.username || saving}
                onClick={handleSave}
              >
                {saving ? t('common.loading') : t('connection.save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TagSelect
        open={tagDialogOpen}
        onClose={() => setTagDialogOpen(false)}
        availableTags={allTags}
        selectedTags={form.tags}
        onConfirm={handleConfirmTags}
        title={t('sidebar.selectTag')}
        placeholder={t('sidebar.tagName')}
        cancelLabel={t('connection.cancel')}
        confirmLabel={t('common.confirm')}
        emptyLabel={t('sidebar.noTag')}
      />
    </>
  );
}
