import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Modal({
  title,
  description,
  onClose,
  children,
  closeDisabled = false,
  maxWidthClass = "max-w-lg",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  closeDisabled?: boolean;
  maxWidthClass?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeDisabled, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <div
        className={`max-h-[calc(100dvh-0.5rem)] w-full overflow-y-auto rounded-t-3xl border border-b-0 border-[#dfe4e0] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_12px_32px_rgba(20,32,25,.18)] sm:my-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border-b sm:pb-0 ${maxWidthClass}`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#eef1ee] bg-white/95 px-4 py-4 backdrop-blur sm:static sm:border-b-0 sm:px-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-[#24382d]">
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1 text-sm leading-5 text-[#737f78]"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-[#77827b] hover:bg-[#f1f3f1] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.fullscreenElement ?? document.body,
  );
}
