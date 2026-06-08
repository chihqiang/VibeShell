import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TagSelectProps {
  open: boolean;
  onClose: () => void;
  availableTags: string[];
  selectedTags: string[];
  onConfirm: (tags: string[]) => void;
  title?: string;
  placeholder?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  emptyLabel?: string;
}

export default function TagSelect({
  open,
  onClose,
  availableTags,
  selectedTags,
  onConfirm,
  title = 'Select tags',
  placeholder = 'Tag name',
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  emptyLabel = 'No tags',
}: TagSelectProps) {
  const [pending, setPending] = useState<string[]>(selectedTags);
  const [newTag, setNewTag] = useState('');

  function toggle(name: string) {
    setPending((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  }

  function addNew() {
    const name = newTag.trim();
    if (!name) return;
    setPending((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setNewTag('');
  }

  function handleConfirm() {
    onConfirm(pending);
    onClose();
  }

  function handleCancel() {
    setPending(selectedTags);
    setNewTag('');
    onClose();
  }

  const allItems = [...new Set([...availableTags, ...pending])];
  const noContent = availableTags.length === 0 && pending.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleCancel();
      }}
    >
      <DialogContent className="w-[360px] sm:max-w-[360px] p-0">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-2">
          <div className="flex items-center gap-1.5">
            <Input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder={placeholder}
              className="h-7 text-xs flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addNew();
              }}
            />
            <Button size="xs" onClick={addNew} disabled={!newTag.trim()}>
              <Plus size={12} />
            </Button>
          </div>
        </div>

        <div className="max-h-[240px] overflow-y-auto border-t border-border p-4">
          {noContent ? (
            <div className="text-center text-muted-foreground text-xs py-6">{emptyLabel}</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allItems.map((item) => (
                <button
                  key={item}
                  onClick={() => toggle(item)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer',
                    pending.includes(item)
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-input text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-4 pb-4">
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              {cancelLabel}
            </Button>
            <Button size="sm" onClick={handleConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
