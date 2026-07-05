import type { HTMLAttributes } from 'react';
import { cn } from '@clientflow/ui';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn('rounded-lg border border-border bg-card p-5 shadow-sm', className)}
      {...props}
    />
  );
}
