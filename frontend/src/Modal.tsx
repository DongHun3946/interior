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
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeDisabled, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <div
        className={`w-full overflow-hidden rounded-2xl border border-[#dfe4e0] bg-white shadow-[0_12px_32px_rgba(20,32,25,.18)] ${maxWidthClass}`}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4">
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
            className="-mr-1 rounded-lg p-1.5 text-[#77827b] hover:bg-[#f1f3f1] disabled:cursor-not-allowed disabled:opacity-50"
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
    document.body,
  );
}
