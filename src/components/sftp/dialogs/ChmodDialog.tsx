import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Autocomplete from '@/components/ui/autocomplete';

interface ChmodFormData {
  mode: string;
  uid: string;
  gid: string;
  recursive: boolean;
}

interface ChmodDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  formData: ChmodFormData;
  onChange: (data: ChmodFormData) => void;
  onConfirm: () => void;
  isDirectory: boolean;
  users: string[];
  groups: string[];
  error?: string;
}

function permToFlags(perm: string) {
  const num = parseInt(perm, 8);
  if (isNaN(num))
    return {
      ur: false,
      uw: false,
      ux: false,
      gr: false,
      gw: false,
      gx: false,
      or: false,
      ow: false,
      ox: false,
    };
  return {
    ur: !!(num & 0o400),
    uw: !!(num & 0o200),
    ux: !!(num & 0o100),
    gr: !!(num & 0o040),
    gw: !!(num & 0o020),
    gx: !!(num & 0o010),
    or: !!(num & 0o004),
    ow: !!(num & 0o002),
    ox: !!(num & 0o001),
  };
}

function flagsToPerm(flags: ReturnType<typeof permToFlags>): string {
  const num =
    (flags.ur ? 0o400 : 0) |
    (flags.uw ? 0o200 : 0) |
    (flags.ux ? 0o100 : 0) |
    (flags.gr ? 0o040 : 0) |
    (flags.gw ? 0o020 : 0) |
    (flags.gx ? 0o010 : 0) |
    (flags.or ? 0o004 : 0) |
    (flags.ow ? 0o002 : 0) |
    (flags.ox ? 0o001 : 0);
  return num.toString(8).padStart(3, '0');
}

type FlagKey = keyof ReturnType<typeof permToFlags>;

const flagMeta: {
  key: FlagKey;
  category: 'u' | 'g' | 'o';
  label: 'read' | 'write' | 'execute';
}[] = [
  { key: 'ur', category: 'u', label: 'read' },
  { key: 'uw', category: 'u', label: 'write' },
  { key: 'ux', category: 'u', label: 'execute' },
  { key: 'gr', category: 'g', label: 'read' },
  { key: 'gw', category: 'g', label: 'write' },
  { key: 'gx', category: 'g', label: 'execute' },
  { key: 'or', category: 'o', label: 'read' },
  { key: 'ow', category: 'o', label: 'write' },
  { key: 'ox', category: 'o', label: 'execute' },
];

const categories = [
  { key: 'u', title: 'owner' },
  { key: 'g', title: 'group' },
  { key: 'o', title: 'other' },
] as const;

export default function ChmodDialog({
  open,
  onOpenChange,
  formData,
  onChange,
  onConfirm,
  isDirectory,
  users,
  groups,
  error,
}: ChmodDialogProps) {
  const { t } = useTranslation();
  const flags = permToFlags(formData.mode);

  const toggleFlag = (key: FlagKey) => {
    const next = { ...flags, [key]: !flags[key] };
    onChange({ ...formData, mode: flagsToPerm(next) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('sftp.permissions')}</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4 space-y-5">
          {/* Permission checkboxes */}
          <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-x-4 gap-y-2 items-center text-xs">
            <div />
            {categories.map((cat) => (
              <div key={cat.key} className="text-center font-medium text-muted-foreground">
                {t(`sftp.${cat.title}`)}
              </div>
            ))}
            {(['read', 'write', 'execute'] as const).map((perm) => (
              <>
                <div className="text-muted-foreground">{t(`sftp.${perm}`)}</div>
                {categories.map((cat) => {
                  const meta = flagMeta.find((f) => f.category === cat.key && f.label === perm)!;
                  return (
                    <label key={meta.key} className="flex justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={flags[meta.key]}
                        onChange={() => toggleFlag(meta.key)}
                        className="accent-primary size-4"
                      />
                    </label>
                  );
                })}
              </>
            ))}
          </div>

          {/* Numeric display (read-only hint) */}
          <div className="text-center text-xs text-muted-foreground/60 font-mono">{formData.mode}</div>

          {/* User / Group */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>{t('sftp.user')}</Label>
              <Autocomplete
                value={formData.uid}
                onChange={(v) => onChange({ ...formData, uid: v })}
                options={users}
                placeholder="root"
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <Label>{t('sftp.group')}</Label>
              <Autocomplete
                value={formData.gid}
                onChange={(v) => onChange({ ...formData, gid: v })}
                options={groups}
                placeholder="root"
                className="mt-1"
              />
            </div>
          </div>

          {isDirectory && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
              <input
                type="checkbox"
                checked={formData.recursive}
                onChange={(e) => onChange({ ...formData, recursive: e.target.checked })}
                className="accent-primary"
              />
              {t('sftp.recursive')}
            </label>
          )}
        </div>
        {error && <p className="px-5 pb-1 text-xs text-red-500">{error}</p>}
        <DialogFooter>
          <DialogClose className="h-8 px-2.5 inline-flex items-center justify-center rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground cursor-pointer">
            {t('common.cancel')}
          </DialogClose>
          <Button size="sm" onClick={onConfirm}>
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
