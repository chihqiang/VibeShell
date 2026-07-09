import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export default function Field({
  label,
  compact,
  className,
  children,
}: {
  label: string;
  compact?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (compact) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
        {children}
      </div>
    );
  }
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
