"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useClientReady } from "@/hooks/useClientState";
import { createPortal } from "react-dom";

type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastOptions {
  title: string;
  description?: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastItem {
  id: number;
  title: string;
  description?: React.ReactNode;
  variant: ToastVariant;
  duration: number;
  leaving: boolean;
}

interface ToastApi {
  show: (opts: ToastOptions) => number;
  success: (title: string, description?: React.ReactNode, duration?: number) => number;
  error: (title: string, description?: React.ReactNode, duration?: number) => number;
  info: (title: string, description?: React.ReactNode, duration?: number) => number;
  warning: (title: string, description?: React.ReactNode, duration?: number) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const EXIT_MS = 260;

const VARIANT = {
  success: {
    accent: "#4a6b50",
    chipBg: "#eef4ef",
    chipBorder: "#cfe0d2",
  },
  error: {
    accent: "#a8503a",
    chipBg: "#f8ece6",
    chipBorder: "#e7c6b8",
  },
  info: {
    accent: "#1b1b19",
    chipBg: "#f1f0ea",
    chipBorder: "#e0ddd3",
  },
  warning: {
    accent: "#b5764a",
    chipBg: "#f6ede3",
    chipBorder: "#ecd8c2",
  },
} as const;

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (variant) {
    case "success":
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "error":
      return (
        <svg {...common}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    case "warning":
      return (
        <svg {...common}>
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      );
  }
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const c = VARIANT[item.variant];
  return (
    <div
      role="status"
      aria-live="polite"
      className="toastCard pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border border-[#e7e4da] bg-white px-4 py-3.5 shadow-[0_12px_34px_-12px_rgba(27,27,25,0.28)]"
      data-leaving={item.leaving ? "true" : undefined}
      style={{ fontFamily: "var(--font-be-vietnam), system-ui, sans-serif" }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: c.accent }}
      />

      <span
        aria-hidden
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
        style={{ backgroundColor: c.chipBg, borderColor: c.chipBorder, color: c.accent }}
      >
        <ToastIcon variant={item.variant} />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[14.5px] font-semibold leading-snug text-[#1b1b19]">
          {item.title}
        </p>
        {item.description && (
          <p className="mt-0.5 text-[13px] leading-relaxed text-[#6b6b66]">
            {item.description}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Đóng thông báo"
        className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-[#b0aea6] transition-colors hover:bg-[#f1f0ea] hover:text-[#1b1b19]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {item.duration > 0 && !item.leaving && (
        <span
          aria-hidden
          className="toastProgress absolute bottom-0 left-0 h-[3px] w-full origin-left"
          style={{
            backgroundColor: c.accent,
            animationDuration: `${item.duration}ms`,
          }}
        />
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const mounted = useClientReady();
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach((t) => clearTimeout(t));
      activeTimers.clear();
    };
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
      );
      const old = timers.current.get(id);
      if (old) clearTimeout(old);
      const t = setTimeout(() => remove(id), EXIT_MS);
      timers.current.set(id, t);
    },
    [remove]
  );

  const show = useCallback(
    (opts: ToastOptions) => {
      const id = ++idRef.current;
      const duration = opts.duration ?? 4500;
      const item: ToastItem = {
        id,
        title: opts.title,
        description: opts.description,
        variant: opts.variant ?? "info",
        duration,
        leaving: false,
      };
      setToasts((prev) => [...prev, item]);
      if (duration > 0) {
        const t = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, t);
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, description, duration) =>
        show({ variant: "success", title, description, duration }),
      error: (title, description, duration) =>
        show({ variant: "error", title, description, duration }),
      info: (title, description, duration) =>
        show({ variant: "info", title, description, duration }),
      warning: (title, description, duration) =>
        show({ variant: "warning", title, description, duration }),
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] flex flex-col items-center gap-2.5 px-4 py-4 sm:inset-x-auto sm:right-4 sm:top-4 sm:max-w-sm sm:items-end sm:px-0 sm:py-0">
            {toasts.map((t) => (
              <ToastCard key={t.id} item={t} onDismiss={dismiss} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast phải được dùng bên trong <ToastProvider>");
  }
  return ctx;
}
