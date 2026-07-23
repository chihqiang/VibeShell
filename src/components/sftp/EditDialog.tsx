import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface EditDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  content: string;
  onContentChange: (v: string) => void;
  saving: boolean;
  path: string;
  onSave: () => void;
}

export function EditDialog({ open, onOpenChange, content, onContentChange, saving, path, onSave }: EditDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('sftp.editFile', { name: path.split('/').pop() })}</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4">
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            className="w-full h-64 rounded-lg border border-input bg-background p-3 text-xs font-mono text-foreground outline-none resize-none transition-all duration-200 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? t('sftp.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
