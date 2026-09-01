import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  pageSize,
  total,
  loading = false,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const move = (nextPage: number) => {
    onPageChange(nextPage);
    window.requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  };

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-3 py-3"
      aria-label="페이지 이동"
    >
      <span className="mr-1 text-xs font-semibold text-[#718078]">
        {page} / {totalPages} 페이지
      </span>
      <button
        type="button"
        className="btn-secondary h-11 px-3"
        disabled={page <= 1 || loading}
        onClick={() => move(Math.max(1, page - 1))}
      >
        <ChevronLeft size={16} /> 이전
      </button>
      <button
        type="button"
        className="btn-secondary h-11 px-3"
        disabled={page >= totalPages || loading}
        onClick={() => move(Math.min(totalPages, page + 1))}
      >
        다음 <ChevronRight size={16} />
      </button>
    </nav>
  );
}
