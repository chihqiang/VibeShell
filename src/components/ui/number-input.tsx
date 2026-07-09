import { Input } from './input';

interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  compact?: boolean;
  className?: string;
}

/** 数字输入框 — 自动过滤非数字字符 */
export function NumberInput({
  value,
  onChange,
  placeholder,
  compact,
  className,
}: NumberInputProps) {
  return (
    <Input
      value={value || ''}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '');
        onChange(v === '' ? 0 : parseInt(v, 10));
      }}
      placeholder={placeholder}
      className={compact ? `h-8 w-16 text-xs ${className || ''}` : className}
    />
  );
}
