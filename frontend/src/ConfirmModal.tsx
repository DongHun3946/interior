import type { ReactNode } from "react";
import Modal from "./Modal";

export default function ConfirmModal({
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  busy = false,
  tone = "default",
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  tone?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      closeDisabled={busy}
      maxWidthClass="max-w-md"
    >
      <div>
        {children && (
          <div className="border-t border-[#e7ebe8] px-5 py-4">{children}</div>
        )}
        <div className="flex justify-end gap-2 border-t border-[#e7ebe8] bg-[#fafbfa] px-5 py-4">
          <button
            type="button"
            className="inline-flex min-w-16 items-center justify-center rounded-lg border border-[#d8ded9] bg-white px-4 py-2 text-sm font-semibold text-[#405449] transition hover:bg-[#f3f5f3] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              tone === "danger"
                ? "inline-flex min-w-16 items-center justify-center rounded-lg bg-[#c83d45] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ad333a] disabled:cursor-not-allowed disabled:opacity-50"
                : "inline-flex min-w-16 items-center justify-center rounded-lg bg-[#234c38] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#193c2b] disabled:cursor-not-allowed disabled:opacity-50"
            }
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
