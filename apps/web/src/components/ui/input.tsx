import type { InputHTMLAttributes } from 'react';
import { cn } from '@clientflow/ui';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
}

export function Input({ className, label, error, id, ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <label className="grid gap-2 text-sm font-medium" htmlFor={inputId}>
      {label}
      <input
        id={inputId}
        className={cn(
          'h-11 rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20',
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs font-normal text-danger">{error}</span> : null}
    </label>
  );
}
