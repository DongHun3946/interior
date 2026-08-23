import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus } from "lucide-react";

export default function PhotoClassificationEditor({
  value,
  options,
  disabled = false,
  onSave,
}: {
  value: string;
  options: string[];
  disabled?: boolean;
  onSave: (value: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
    upward: boolean;
  } | null>(null);
  const rootRef = useRef<HTMLFormElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);

  const normalizedDraft = draft.trim();
  const filteredOptions = useMemo(() => {
    const query = normalizedDraft.toLocaleLowerCase("ko");
    return options.filter(
      (option) =>
        !query || option.toLocaleLowerCase("ko").includes(query),
    );
  }, [normalizedDraft, options]);
  const isNewClassification =
    Boolean(normalizedDraft) &&
    !options.some(
      (option) =>
        option.toLocaleLowerCase("ko") ===
        normalizedDraft.toLocaleLowerCase("ko"),
    );

  useEffect(() => {
    if (!open) return;
    const updateMenuPosition = () => {
      const root = rootRef.current?.getBoundingClientRect();
      if (!root) return;
      const estimatedHeight = Math.min(
        filteredOptions.length * 40 + (isNewClassification ? 44 : 0) + 12,
        260,
      );
      const spaceBelow = window.innerHeight - root.bottom - 8;
      const spaceAbove = root.top - 8;
      const upward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
      setMenuPosition({
        left: Math.max(8, Math.min(root.left, window.innerWidth - root.width - 8)),
        top: upward ? root.top - 8 : root.bottom + 8,
        width: root.width,
        maxHeight: Math.max(
          96,
          Math.min(estimatedHeight, upward ? spaceAbove : spaceBelow),
        ),
        upward,
      });
    };
    updateMenuPosition();
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      )
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [filteredOptions.length, isNewClassification, open]);

  const save = (nextValue = draft) => {
    const classification = nextValue.trim();
    setDraft(classification);
    setOpen(false);
    if (classification !== value) void onSave(classification);
  };

  return (
    <>
      <form
        ref={rootRef}
        className="flex overflow-hidden rounded-xl border border-[#d7e1d9] bg-white shadow-sm transition focus-within:border-[#628b72] focus-within:ring-2 focus-within:ring-[#d9e9dd]"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <input
          ref={inputRef}
          value={draft}
          maxLength={100}
          disabled={disabled}
          placeholder="분류를 선택하거나 입력하세요"
          aria-label="사진 분류 입력"
          aria-haspopup="listbox"
          aria-expanded={open}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-xs font-semibold text-[#31483a] outline-none placeholder:font-normal placeholder:text-[#94a198] disabled:cursor-not-allowed disabled:bg-[#f4f6f4]"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
          }}
        />
        <button
          type="button"
          disabled={disabled}
          className="flex w-9 shrink-0 items-center justify-center text-[#7f8d84] transition hover:bg-[#f1f5f1] disabled:cursor-not-allowed"
          aria-label="사진 분류 목록 열기"
          onClick={() => {
            const nextOpen = !open;
            setOpen(nextOpen);
            if (nextOpen) inputRef.current?.focus();
          }}
        >
          <ChevronDown
            size={15}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <button
          type="submit"
          disabled={disabled || draft.trim() === value}
          className="flex w-10 shrink-0 items-center justify-center bg-[#244c38] text-white transition hover:bg-[#18372b] disabled:cursor-default disabled:bg-[#dfe7e1] disabled:text-[#91a097]"
          aria-label="사진 분류 저장"
          title="분류 저장"
        >
          <Check size={15} strokeWidth={2.5} />
        </button>
      </form>
      {open && menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="사진 분류 목록"
            className="fixed z-[100] overflow-y-auto rounded-2xl border border-[#dce5dd] bg-white p-1.5 shadow-[0_18px_45px_rgba(29,55,40,.16)]"
            style={{
              left: menuPosition.left,
              top: menuPosition.top,
              width: menuPosition.width,
              maxHeight: menuPosition.maxHeight,
              transform: menuPosition.upward ? "translateY(-100%)" : undefined,
            }}
          >
            {isNewClassification && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl bg-[#edf5ee] px-3 py-2.5 text-left text-xs font-bold text-[#28543a] transition hover:bg-[#e3efe5]"
                onClick={() => save(normalizedDraft)}
              >
                <Plus size={14} strokeWidth={2.5} />
                <span className="min-w-0 truncate">
                  ‘{normalizedDraft}’ 새 분류로 추가
                </span>
              </button>
            )}
            {filteredOptions.map((option) => {
              const selected = option === value;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  key={option}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition ${
                    selected
                      ? "bg-[#edf5ee] font-bold text-[#214c33]"
                      : "font-medium text-[#43564a] hover:bg-[#f5f8f5]"
                  }`}
                  onClick={() => save(option)}
                >
                  <span className="truncate">{option}</span>
                  {selected && (
                    <Check size={14} strokeWidth={2.5} className="shrink-0" />
                  )}
                </button>
              );
            })}
            {!isNewClassification && !filteredOptions.length && (
              <p className="px-3 py-3 text-xs text-[#87948b]">
                일치하는 분류가 없습니다.
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
