import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

type ToastItem = {
  id: number;
  message: string;
  closing: boolean;
};

type ToastListener = (items: ToastItem[]) => void;

let nextToastId = 1;
let toastItems: ToastItem[] = [];
const toastListeners = new Set<ToastListener>();

const emitToasts = () => {
  toastListeners.forEach((listener) => listener([...toastItems]));
};

const removeToast = (id: number) => {
  toastItems = toastItems.filter((item) => item.id !== id);
  emitToasts();
};

export function dismissToast(id: number) {
  const toast = toastItems.find((item) => item.id === id);
  if (!toast || toast.closing) return;
  toast.closing = true;
  toastItems = [...toastItems];
  emitToasts();
  window.setTimeout(() => removeToast(id), 240);
}

export function showSuccessToast(message: string) {
  const id = nextToastId++;
  toastItems = [...toastItems.slice(-2), { id, message, closing: false }];
  emitToasts();
  window.setTimeout(() => dismissToast(id), 3200);
}

export default function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>(toastItems);

  useEffect(() => {
    toastListeners.add(setItems);
    setItems([...toastItems]);
    return () => {
      toastListeners.delete(setItems);
    };
  }, []);

  return (
    <div
      className="safe-area-toast pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-[#0f4b30] bg-[#17603a] px-4 py-3.5 text-[15px] text-white shadow-[0_14px_36px_rgba(12,44,28,.34)] ring-1 ring-white/50 ${
            item.closing ? "toast-exit" : "toast-enter"
          }`}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#17603a] shadow-sm">
            <CheckCircle2 size={20} strokeWidth={2.5} />
          </span>
          <p className="min-w-0 flex-1 font-bold leading-5">{item.message}</p>
          <button
            type="button"
            className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={() => dismissToast(item.id)}
            aria-label="알림 닫기"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
