import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { ToastMessage } from '../utils/toast';

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast.id, onDismiss]);

  const Icon = toast.kind === 'error' ? XCircle : toast.kind === 'info' ? Info : CheckCircle2;
  const color = toast.kind === 'error' ? 'text-red-600' : toast.kind === 'info' ? 'text-blue-600' : 'text-emerald-600';

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl"
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} aria-hidden="true" />
      <p className="flex-1 text-sm font-medium text-slate-800">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label="Fermer la notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const toast = (event as CustomEvent<ToastMessage>).detail;
      setToasts(current => [...current.slice(-3), toast]);
    };

    window.addEventListener('gestock:toast', handleToast);
    return () => window.removeEventListener('gestock:toast', handleToast);
  }, []);

  const dismiss = useCallback(
    (id: number) => setToasts(current => current.filter(toast => toast.id !== id)),
    []
  );

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[10000] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
    >
      {toasts.map(toast => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />)}
    </div>
  );
}
