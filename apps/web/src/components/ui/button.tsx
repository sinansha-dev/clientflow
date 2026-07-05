import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@clientflow/ui';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:opacity-90',
  secondary: 'bg-secondary text-white hover:opacity-90',
  ghost: 'bg-transparent hover:bg-muted',
  danger: 'bg-danger text-white hover:opacity-90',
};

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
