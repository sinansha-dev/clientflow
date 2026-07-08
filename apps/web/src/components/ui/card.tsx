import type { HTMLAttributes } from 'react';
import { cn } from '@clientflow/ui';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card p-5 card-shadow transition-all duration-200',
        className,
      )}
      {...props}
    />
  );
}
