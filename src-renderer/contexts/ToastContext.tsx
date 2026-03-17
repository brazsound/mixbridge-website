import React, { createContext, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';

export type ToastVariant = 'success' | 'warning' | 'error';

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { showToast: () => {} };
  return ctx;
}

const TOAST_STYLES: Record<ToastVariant, React.CSSProperties> = {
  success: {
    background: 'rgba(0,0,0,0.85)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  warning: {
    background: 'rgba(255, 159, 10, 0.15)',
    border: '1px solid rgba(255, 159, 10, 0.4)',
    color: '#ffd580',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  error: {
    background: 'rgba(255, 69, 58, 0.15)',
    border: '1px solid rgba(255, 69, 58, 0.4)',
    color: '#ff8a80',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; id: number; variant: ToastVariant } | null>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = Date.now();
    setToast({ message, id, variant });
    const duration = variant === 'error' ? 4000 : variant === 'warning' ? 3000 : 2000;
    const t = setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, duration);
    return () => clearTimeout(t);
  }, []);

  const portal = toast
    ? createPortal(
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg text-sm font-medium"
          style={TOAST_STYLES[toast.variant]}
        >
          {toast.message}
        </div>,
        document.body
      )
    : null;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {portal}
    </ToastContext.Provider>
  );
}
