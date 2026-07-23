import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 已翻译的标题文本 */
  title: string;
  /** 已翻译的标签文本，默认取 common.name */
  label?: string;
  value: string;
  onValueChange: (v: string) => void;
  onConfirm: () => void;
  placeholder?: string;
  /** 确认按钮文案 i18n key，默认 common.confirm */
  confirmKey?: string;
}

/** 通用输入对话框 — 标题 + 标签 + 输入框 + 取消/确认 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  label,
  value,
  onValueChange,
  onConfirm,
  placeholder,
  confirmKey = 'common.confirm',
}: PromptDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4">
          {label && <Label>{label}</Label>}
          <Input
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm();
            }}
            className="mt-1"
            placeholder={placeholder}
            autoFocus
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button size="sm" onClick={onConfirm}>
            {t(confirmKey)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
