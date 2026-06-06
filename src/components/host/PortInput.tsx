import { Input } from '@/components/ui/input';

export default function PortInput({
  value,
  onChange,
  compact,
}: {
  value: number;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  return (
    <Input
      value={value || ''}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '');
        onChange(v === '' ? 0 : parseInt(v, 10));
      }}
      placeholder="22"
      className={compact ? 'h-8 w-16 text-xs' : ''}
    />
  );
}
