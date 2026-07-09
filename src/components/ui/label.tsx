import { cn } from '@/utils';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn('block text-xs font-medium text-muted-foreground mb-1.5', className)}
      {...props}
    />
  );
}

export { Label };
