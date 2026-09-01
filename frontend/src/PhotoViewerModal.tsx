import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, Printer, RotateCcw, X } from "lucide-react";

const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const ZOOM_STEP = 25;

export default function PhotoViewerModal({
  imageUrl,
  alt,
  projectTitle,
  classification,
  onClose,
}: {
  imageUrl: string;
  alt: string;
  projectTitle: string;
  classification?: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(100);
  const [dragging, setDragging] = useState(false);
  const titleId = useId();
  const canvasRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const changeZoom = (nextZoom: number) =>
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom)));

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "+" || event.key === "=")
        setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP));
      if (event.key === "-")
        setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP));
      if (event.key === "0") setZoom(100);
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="photo-viewer-overlay fixed inset-0 z-[200] flex items-center justify-center bg-[#101713]/90 p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="photo-viewer-dialog flex h-[calc(100dvh-1rem)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#17211b] shadow-[0_28px_80px_rgba(0,0,0,.48)] sm:h-[calc(100dvh-2rem)]">
        <header className="photo-viewer-toolbar flex flex-col gap-3 border-b border-white/10 bg-[#1d2922] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="min-w-0 pr-10 sm:pr-0">
            <h2 id={titleId} className="truncate text-sm font-bold text-white">
              {projectTitle}
            </h2>
            <p className="mt-0.5 truncate text-xs text-white/55">
              {classification || "미분류 사진"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center overflow-hidden rounded-xl border border-white/15 bg-white/8">
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-35"
                disabled={zoom <= MIN_ZOOM}
                onClick={() => changeZoom(zoom - ZOOM_STEP)}
                aria-label="사진 축소"
                title="축소 (-)"
              >
                <Minus size={17} />
              </button>
              <button
                type="button"
                className="flex h-11 min-w-16 items-center justify-center gap-1 border-x border-white/10 px-2 text-xs font-bold text-white transition hover:bg-white/10"
                onClick={() => setZoom(100)}
                aria-label="사진 배율 초기화"
                title="배율 초기화 (0)"
              >
                <RotateCcw size={13} /> {zoom}%
              </button>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-35"
                disabled={zoom >= MAX_ZOOM}
                onClick={() => changeZoom(zoom + ZOOM_STEP)}
                aria-label="사진 확대"
                title="확대 (+)"
              >
                <Plus size={17} />
              </button>
            </div>
            <button
              type="button"
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3 text-xs font-bold text-white transition hover:bg-white/15"
              onClick={() => window.print()}
              aria-label="사진 인쇄"
            >
              <Printer size={16} />
              <span className="hidden sm:inline">인쇄</span>
            </button>
            <button
              type="button"
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white sm:static sm:border sm:border-white/15 sm:bg-white/8"
              onClick={onClose}
              aria-label="사진 닫기"
            >
              <X size={19} />
            </button>
          </div>
        </header>
        <div
          ref={canvasRef}
          className={`photo-viewer-canvas relative min-h-0 flex-1 overflow-auto bg-[#111814] p-3 select-none sm:p-6 ${
            zoom > 100
              ? dragging
                ? "cursor-grabbing touch-none"
                : "cursor-grab touch-none"
              : ""
          }`}
          onWheel={(event) => {
            event.preventDefault();
            const canvas = canvasRef.current;
            if (!canvas) return;
            const nextZoom = Math.min(
              MAX_ZOOM,
              Math.max(MIN_ZOOM, zoom + (event.deltaY < 0 ? 15 : -15)),
            );
            if (nextZoom === zoom) return;
            const rect = canvas.getBoundingClientRect();
            const pointerX = event.clientX - rect.left;
            const pointerY = event.clientY - rect.top;
            const contentX =
              (canvas.scrollLeft + pointerX) / Math.max(canvas.scrollWidth, 1);
            const contentY =
              (canvas.scrollTop + pointerY) / Math.max(canvas.scrollHeight, 1);
            setZoom(nextZoom);
            window.requestAnimationFrame(() => {
              canvas.scrollLeft = contentX * canvas.scrollWidth - pointerX;
              canvas.scrollTop = contentY * canvas.scrollHeight - pointerY;
            });
          }}
          onPointerDown={(event) => {
            if (zoom <= 100 || event.button !== 0) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            panStartRef.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              scrollLeft: canvas.scrollLeft,
              scrollTop: canvas.scrollTop,
            };
            canvas.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onPointerMove={(event) => {
            const start = panStartRef.current;
            const canvas = canvasRef.current;
            if (!start || !canvas || start.pointerId !== event.pointerId) return;
            canvas.scrollLeft = start.scrollLeft - (event.clientX - start.x);
            canvas.scrollTop = start.scrollTop - (event.clientY - start.y);
          }}
          onPointerUp={(event) => {
            const canvas = canvasRef.current;
            if (panStartRef.current?.pointerId !== event.pointerId) return;
            panStartRef.current = null;
            if (canvas?.hasPointerCapture(event.pointerId))
              canvas.releasePointerCapture(event.pointerId);
            setDragging(false);
          }}
          onPointerCancel={() => {
            panStartRef.current = null;
            setDragging(false);
          }}
        >
          <div
            className="photo-print-area mx-auto flex min-h-full items-center justify-center transition-[width] duration-200"
            style={{ width: `${zoom}%` }}
          >
            <img
              src={imageUrl}
              alt={alt}
              className="photo-viewer-image block h-auto w-full select-none object-contain shadow-[0_18px_55px_rgba(0,0,0,.42)]"
              draggable={false}
              onDoubleClick={() => setZoom((current) => (current === 100 ? 200 : 100))}
            />
          </div>
          <span className="photo-viewer-help pointer-events-none sticky bottom-0 left-1/2 inline-flex -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[10px] font-semibold text-white/75 shadow-lg backdrop-blur-sm">
            <span className="sm:hidden">버튼으로 확대 · 확대 후 드래그로 이동</span>
            <span className="hidden sm:inline">
              마우스 휠로 확대·축소 · 확대 후 드래그로 이동
            </span>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
