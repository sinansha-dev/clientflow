import { X } from 'lucide-react';
import { useToastStore } from '../../stores/toast-store';

const styles = {
  success: 'border-success',
  error: 'border-danger',
  warning: 'border-warning',
  info: 'border-primary',
};

export function ToastViewport() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 grid w-[min(360px,calc(100vw-2rem))] gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border-l-4 bg-card p-4 shadow-lg ${styles[toast.type]}`}
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.message ? (
                <p className="mt-1 text-sm text-foreground/70">{toast.message}</p>
              ) : null}
            </div>
            <button
              aria-label="Dismiss notification"
              className="rounded-md p-1 hover:bg-muted"
              type="button"
              onClick={() => dismiss(toast.id)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
