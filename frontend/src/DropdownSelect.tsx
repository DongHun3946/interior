import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type DropdownOption = {
  value: string;
  label: string;
  dotClass?: string;
  disabled?: boolean;
};

export default function DropdownSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  disabled = false,
  compact = false,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
    upward: boolean;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const updateMenuPosition = () => {
      const root = rootRef.current?.getBoundingClientRect();
      if (!root) return;
      const estimatedHeight = Math.min(options.length * (compact ? 40 : 48) + 12, 320);
      const spaceBelow = window.innerHeight - root.bottom - 8;
      const spaceAbove = root.top - 8;
      const upward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
      const width = Math.max(root.width, 180);
      setMenuPosition({
        left: Math.max(8, Math.min(root.left, window.innerWidth - width - 8)),
        top: upward ? root.top - 8 : root.bottom + 8,
        width,
        maxHeight: Math.max(96, Math.min(estimatedHeight, upward ? spaceAbove : spaceBelow)),
        upward,
      });
    };
    updateMenuPosition();
    setActiveIndex(selectedIndex);
    const focusFrame = window.requestAnimationFrame(() =>
      optionRefs.current[selectedIndex]?.focus(),
    );
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
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [compact, open, options.length, selectedIndex]);

  const focusOption = (nextIndex: number) => {
    let normalized = (nextIndex + options.length) % options.length;
    while (options[normalized]?.disabled && normalized !== activeIndex) {
      normalized = (normalized + (nextIndex > activeIndex ? 1 : -1) + options.length) % options.length;
    }
    setActiveIndex(normalized);
    optionRefs.current[normalized]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={`relative ${className}`}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          setOpen(false);
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!open) {
            setOpen(true);
          } else {
            focusOption(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
          }
        } else if (open && event.key === "Home") {
          event.preventDefault();
          focusOption(0);
        } else if (open && event.key === "End") {
          event.preventDefault();
          focusOption(options.length - 1);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`${
          compact
            ? "flex w-full items-center justify-between gap-2 rounded-lg border border-[#dfe6df] bg-white px-2.5 py-1.5 text-left text-xs outline-none transition"
            : "field flex items-center justify-between gap-3 text-left"
        } disabled:cursor-not-allowed disabled:bg-[#f4f6f4] disabled:opacity-70 ${
          open ? "border-[#628b72] ring-2 ring-[#d9e9dd]" : ""
        }`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {selected?.dotClass && (
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${selected.dotClass}`} />
          )}
          <span className="truncate font-semibold text-[#31483a]">
            {selected?.label || "선택"}
          </span>
        </span>
        <ChevronDown
          size={compact ? 15 : 17}
          className={`shrink-0 text-[#7f8d84] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            className="fixed z-[100] overflow-y-auto rounded-2xl border border-[#dce5dd] bg-white p-1.5 shadow-[0_18px_45px_rgba(29,55,40,.16)]"
            style={{
              left: menuPosition.left,
              top: menuPosition.top,
              width: menuPosition.width,
              maxHeight: menuPosition.maxHeight,
              transform: menuPosition.upward ? "translateY(-100%)" : undefined,
            }}
          >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <button
                key={`${option.value}-${index}`}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                className={`flex w-full items-center justify-between rounded-xl text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  compact ? "px-3 py-2 text-xs" : "px-3.5 py-3 text-sm"
                } ${
                  isSelected
                    ? "bg-[#edf5ee] text-[#214c33]"
                    : "text-[#43564a] hover:bg-[#f5f8f5]"
                }`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  window.requestAnimationFrame(() => triggerRef.current?.focus());
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {option.dotClass && (
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${option.dotClass}`} />
                  )}
                  <span className={`truncate ${isSelected ? "font-bold" : "font-medium"}`}>
                    {option.label}
                  </span>
                </span>
                {isSelected && (
                  <Check
                    size={compact ? 14 : 16}
                    strokeWidth={2.5}
                    className="shrink-0 text-[#3f7f56]"
                  />
                )}
              </button>
            );
          })}
          </div>,
          document.body,
        )}
    </div>
  );
}
