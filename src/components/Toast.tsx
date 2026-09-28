import { useCallback, useRef, useState } from "react";
import {
  ToastContext,
  type ToastType,
} from "./toastContext";
import "./Toast.css";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  exiting: boolean;
}

const TOAST_DURATION_MS = 3000;

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "success", duration = TOAST_DURATION_MS) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, type, exiting: false }]);

      const timer = setTimeout(() => {
        timers.current.delete(id);
        removeToast(id);
      }, duration);
      timers.current.set(id, timer);
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}${toast.exiting ? " toast-exiting" : ""}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
