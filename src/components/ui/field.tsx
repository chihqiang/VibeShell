import { type ReactNode } from 'react';
import { cn } from '@/utils';
import { Label } from './label';

interface FieldProps {
  label: string;
  compact?: boolean;
  className?: string;
  children: ReactNode;
}

/** 通用表单字段 — 标签 + 内容，支持 compact 紧凑模式 */
export function Field({ label, compact, className, children }: FieldProps) {
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
