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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#10261c]/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <div
        className={`w-full overflow-hidden rounded-3xl bg-white shadow-2xl ${maxWidthClass}`}
      >
        <div className="flex items-start justify-between border-b border-[#e5eae5] px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-xl font-bold text-[#20392c]">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-[#7a877e]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="rounded-xl p-2 text-[#6e7b73] hover:bg-[#f1f4f1] disabled:cursor-not-allowed disabled:opacity-50"
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
