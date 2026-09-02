import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  FilePlus2,
  FolderKanban,
  House,
  ImageIcon,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MapPin,
  Maximize2,
  Menu,
  Minimize2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import { AUTH_EXPIRED_EVENT, api, mediaUrl } from "./api";
import type {
  Cost,
  ContractEstimateReference,
  Image,
  ImageCategory,
  Project,
  ProjectListItem,
  ProjectStatus,
  ProjectType,
  Payment,
  PaymentMethod,
  PaymentStage,
  PaymentSummary,
  CostSummary,
  GeocodeResult,
  EstimateInquiry,
  ManagementOverview,
} from "./types";
import PublicPortfolio from "./PublicPortfolio";
import NaverMap from "./NaverMap";
import EstimateInquiriesPage from "./EstimateInquiries";
import CompanySettingsPage from "./CompanySettings";
import SimulationWorkspace from "./SimulationWorkspace";
import { showDatePicker } from "./datePicker";
import MoneyInput from "./MoneyInput";
import IntegerInput from "./IntegerInput";
import DropdownSelect, { type DropdownOption } from "./DropdownSelect";
import PhotoClassificationEditor from "./PhotoClassificationEditor";
import PhotoLibrary from "./PhotoLibrary";
import PhotoViewerModal from "./PhotoViewerModal";
import ConfirmModal from "./ConfirmModal";
import Modal from "./Modal";
import Pagination from "./Pagination";
import { showSuccessToast } from "./Toast";

const SIMULATION_ENABLED = import.meta.env.VITE_ENABLE_SIMULATION === "true";

const statusLabels: Record<ProjectStatus, string> = {
  PLANNING: "공사 예정",
  IN_PROGRESS: "공사 중",
  COMPLETED: "공사 완료",
  ON_HOLD: "공사 보류",
  CANCELLED: "공사 취소",
};
const statusStyles: Record<ProjectStatus, string> = {
  PLANNING: "bg-[#fff0d8] text-[#94611f] ring-1 ring-inset ring-[#efd4a8]",
  IN_PROGRESS: "bg-[#e8f1ff] text-[#326aa8] ring-1 ring-inset ring-[#c9dcf6]",
  COMPLETED: "bg-[#e6f4ea] text-[#2f7d4c] ring-1 ring-inset ring-[#c6e4cf]",
  ON_HOLD: "bg-[#f1ebff] text-[#7451a6] ring-1 ring-inset ring-[#ddd0f5]",
  CANCELLED: "bg-[#fdecec] text-[#a65358] ring-1 ring-inset ring-[#f1cbcd]",
};
const statusDots: Record<ProjectStatus, string> = {
  PLANNING: "bg-[#d5a044]",
  IN_PROGRESS: "bg-[#4387d6]",
  COMPLETED: "bg-[#3b9b60]",
  ON_HOLD: "bg-[#8a68bd]",
  CANCELLED: "bg-[#cf686f]",
};
const projectCardStatusStyles: Record<ProjectStatus, string> = {
  PLANNING: "border-l-[#c58a2d] bg-[#fff8eb] text-[#83591e]",
  IN_PROGRESS: "border-l-[#3f72aa] bg-[#f2f7fc] text-[#315f91]",
  COMPLETED: "border-l-[#4b8560] bg-[#f1f7f3] text-[#376849]",
  ON_HOLD: "border-l-[#7a62a0] bg-[#f6f3fa] text-[#685384]",
  CANCELLED: "border-l-[#b85d64] bg-[#fbf2f3] text-[#944d53]",
};
const projectStatusOptions = Object.keys(statusLabels) as ProjectStatus[];
const projectTypeLabels: Record<ProjectType, string> = {
  INTERIOR: "전체 인테리어",
  PARTIAL_INTERIOR: "부분 인테리어",
  REPAIR: "보수 공사",
  OTHER: "기타",
};
const projectTypeStyles: Record<ProjectType, string> = {
  INTERIOR: "bg-[#e8f2e8] text-[#477653] ring-[#cfe0d2]",
  PARTIAL_INTERIOR: "bg-[#e9f0fa] text-[#426b9d] ring-[#cfdbeb]",
  REPAIR: "bg-[#fff1df] text-[#99611f] ring-[#efd5ae]",
  OTHER: "bg-[#f0edf5] text-[#71627f] ring-[#ddd5e6]",
};
const projectTypeOptions: DropdownOption[] = Object.entries(
  projectTypeLabels,
).map(([value, label]) => ({ value, label }));
const projectTypeFilterOptions: DropdownOption[] = [
  { value: "", label: "모든 공사 구분" },
  ...projectTypeOptions,
];
const photoClassificationPresets = [
  "거실",
  "주방",
  "싱크대",
  "도배",
  "욕실",
  "침실",
  "현관",
  "베란다",
  "붙박이장",
  "바닥",
  "조명",
];
const projectStatusFilterOptions: DropdownOption[] = [
  { value: "", label: "모든 상태" },
  ...projectStatusOptions.map((status) => ({
    value: status,
    label: statusLabels[status],
    dotClass: statusDots[status],
  })),
];
const paymentStageOptions: DropdownOption[] = [
  { value: "DEPOSIT", label: "계약금" },
  { value: "INTERIM", label: "중도금" },
  { value: "BALANCE", label: "잔금" },
  { value: "LUMP_SUM", label: "일시불" },
  { value: "OTHER", label: "기타" },
];
const paymentMethodOptions: DropdownOption[] = [
  { value: "BANK_TRANSFER", label: "계좌이체" },
  { value: "CASH", label: "현금" },
  { value: "CARD", label: "카드" },
  { value: "OTHER", label: "기타" },
];
const money = (value: number) =>
  new Intl.NumberFormat("ko-KR").format(value) + "원";
const shortDate = (date?: string) =>
  date
    ? new Date(date).toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
      })
    : "—";
const fullDate = (date?: string) =>
  date
    ? new Date(date).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "미정";
const dateInputValue = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function Badge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[13px] font-bold ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function ProjectTypeBadge({ projectType }: { projectType: ProjectType }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${projectTypeStyles[projectType]}`}
    >
      {projectTypeLabels[projectType]}
    </span>
  );
}

function ProjectStatusSelect({
  value,
  onChange,
}: {
  value: ProjectStatus;
  onChange: (status: ProjectStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const selectedIndex = projectStatusOptions.indexOf(value);
    setActiveIndex(selectedIndex);
    const focusFrame = window.requestAnimationFrame(() =>
      optionRefs.current[selectedIndex]?.focus(),
    );
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, value]);

  const focusOption = (index: number) => {
    const normalized =
      (index + projectStatusOptions.length) % projectStatusOptions.length;
    setActiveIndex(normalized);
    optionRefs.current[normalized]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          setOpen(false);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!open) {
            setOpen(true);
            return;
          }
          focusOption(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
        } else if (open && event.key === "Home") {
          event.preventDefault();
          focusOption(0);
        } else if (open && event.key === "End") {
          event.preventDefault();
          focusOption(projectStatusOptions.length - 1);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`field flex items-center justify-between gap-3 text-left ${open ? "border-[#628b72] ring-2 ring-[#d9e9dd]" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="project-status-options"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${statusDots[value]}`} />
          <span className="font-semibold text-[#31483a]">
            {statusLabels[value]}
          </span>
        </span>
        <ChevronDown
          size={17}
          className={`shrink-0 text-[#7f8d84] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="listbox"
          id="project-status-options"
          aria-label="공사 상태"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(300px,50vh)] overflow-y-auto rounded-2xl border border-[#dce5dd] bg-white p-1.5 shadow-[0_18px_45px_rgba(29,55,40,.16)]"
        >
          {projectStatusOptions.map((status, index) => {
            const selected = status === value;
            return (
              <button
                key={status}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-sm transition-colors ${selected ? "bg-[#edf5ee] text-[#214c33]" : "text-[#43564a] hover:bg-[#f5f8f5]"}`}
                onClick={() => {
                  onChange(status);
                  setOpen(false);
                  window.requestAnimationFrame(() =>
                    triggerRef.current?.focus(),
                  );
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${statusDots[status]}`}
                  />
                  <span className={selected ? "font-bold" : "font-medium"}>
                    {statusLabels[status]}
                  </span>
                </span>
                {selected && (
                  <Check
                    size={16}
                    strokeWidth={2.5}
                    className="text-[#3f7f56]"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
function Empty({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex min-h-72 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 rounded-2xl bg-[#f0f5ef] p-4 text-[#54745f]">
        <FolderKanban size={26} />
      </div>
      <h3 className="serif text-xl text-[#20362b]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#7d8981]">
        {message}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [loginId, setLoginId] = useState(
    () => localStorage.getItem("interior_login_id") || "",
  );
  const [rememberLoginId, setRememberLoginId] = useState(() =>
    Boolean(localStorage.getItem("interior_login_id")),
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.login(loginId, password);
      if (rememberLoginId) {
        localStorage.setItem("interior_login_id", loginId);
      } else {
        localStorage.removeItem("interior_login_id");
      }
      localStorage.setItem("interior_token", result.access_token);
      onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="noise flex min-h-screen items-center justify-center bg-[#eff3ec] px-5 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-[0_30px_100px_rgba(26,55,40,.16)] lg:grid-cols-[1fr_410px]">
        <div className="relative hidden min-h-[600px] overflow-hidden bg-[#17372b] p-12 text-white lg:block">
          <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute bottom-12 left-12 h-28 w-28 rounded-full border border-white/10" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.25em] text-[#b6d2bd]">
                Jeil Interior
              </p>
              <h1 className="serif mt-16 max-w-sm text-5xl leading-[1.15]">
                공간의 변화,
                <br />
                <span className="text-[#cce2cb]">정교한 기록.</span>
              </h1>
              <p className="mt-7 max-w-sm text-sm leading-7 text-[#c4d6c7]">
                오늘의 현장부터 완성된 공간까지.
                <br />
                우리 팀의 모든 프로젝트를 한눈에 관리하세요.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#aac6af]">
              <span className="h-2 w-2 rounded-full bg-[#9bc5a2]" /> Interior
              project workspace
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center p-8 sm:p-14">
          <form onSubmit={submit} className="w-full max-w-sm">
            <div className="mb-10">
              <div className="mb-5 flex items-center gap-2 text-[#17372b]">
                <div className="rounded-lg bg-[#dfeee1] p-2">
                  <House size={18} />
                </div>
                <span className="font-bold tracking-tight">Jeil Interior</span>
              </div>
              <h2 className="serif text-3xl text-[#1b3025]">다시 오셨군요.</h2>
              <p className="mt-2 text-sm text-[#7c887f]">
                관리자 계정으로 현장에 접속하세요.
              </p>
            </div>
            <label className="label">아이디</label>
            <input
              className="field mb-4"
              type="text"
              autoComplete="username"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
            />
            <label className="label">비밀번호</label>
            <input
              className="field"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[#65736a]">
              <input
                type="checkbox"
                checked={rememberLoginId}
                onChange={(e) => setRememberLoginId(e.target.checked)}
                className="h-4 w-4 accent-[#315f40]"
              />
              아이디 저장
            </label>
            {error && (
              <p className="mt-3 rounded-lg bg-[#fff0ef] px-3 py-2 text-xs text-[#a14e4e]">
                {error}
              </p>
            )}
            <button
              className="btn-primary mt-7 w-full py-3.5"
              disabled={loading}
            >
              {loading ? "접속 중…" : "워크스페이스 열기"}
              <ArrowUpRight size={16} />
            </button>
            <a
              href="/projects"
              className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold text-[#557060] hover:text-[#315f40]"
            >
              공개 시공 사례 보기 <ArrowUpRight size={14} />
            </a>
          </form>
        </div>
      </div>
    </main>
  );
}

function Sidebar({
  page,
  setPage,
  onLogout,
  mobileOpen,
  closeMobile,
}: {
  page: string;
  setPage: (page: string) => void;
  onLogout: () => void;
  mobileOpen: boolean;
  closeMobile: () => void;
}) {
  const items = [
    { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
    { id: "estimates", label: "견적·상담", icon: ClipboardList },
    { id: "projects", label: "전체 현장", icon: FolderKanban },
    { id: "photos", label: "사진 관리", icon: Camera },
    { id: "map", label: "현장 지도", icon: MapPin },
    { id: "management", label: "경영 현황", icon: LockKeyhole },
  ];
  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 transform flex-col overflow-y-auto bg-[#17372b] px-5 py-7 text-white transition-transform lg:static lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#b5d1b9]">
              Jeil Interior
            </p>
            <p className="serif mt-1 text-xl">Studio desk</p>
          </div>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white lg:hidden"
            onClick={closeMobile}
            aria-label="메뉴 닫기"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-12 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setPage(item.id);
                  closeMobile();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${page === item.id ? "bg-white/12 text-white" : "text-[#aec7b5] hover:bg-white/7 hover:text-white"}`}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="mt-8 border-t border-white/10 pt-7">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#769681]">
            Workspace
          </p>
          <button
            onClick={() => {
              setPage("settings");
              closeMobile();
            }}
            className={`mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[#aec7b5] hover:bg-white/7 hover:text-white ${page === "settings" ? "bg-white/12 text-white" : ""}`}
          >
            <Pencil size={17} />
            업체 설정
          </button>
          <a
            href="/projects"
            target="_blank"
            rel="noreferrer"
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[#aec7b5] hover:bg-white/7 hover:text-white"
          >
            <ArrowUpRight size={17} /> 공개 시공 사례
          </a>
        </div>
        <button
          onClick={onLogout}
          className="mt-auto flex items-center gap-3 px-3 pt-8 text-sm text-[#aec7b5] hover:text-white"
        >
          <LogOut size={17} />
          로그아웃
        </button>
      </aside>
      {mobileOpen && (
        <button
          aria-label="메뉴 닫기"
          className="fixed inset-0 z-[29] bg-[#10261c]/45 lg:hidden"
          onClick={closeMobile}
        />
      )}
    </>
  );
}

function MobileBottomNav({
  page,
  setPage,
}: {
  page: string;
  setPage: (page: string) => void;
}) {
  const items = [
    { id: "dashboard", label: "홈", icon: LayoutDashboard },
    { id: "estimates", label: "견적", icon: ClipboardList },
    { id: "projects", label: "현장", icon: FolderKanban },
    { id: "photos", label: "사진", icon: Camera },
    { id: "map", label: "지도", icon: MapPin },
  ];
  return (
    <nav className="mobile-bottom-nav">
      {items.map((item) => {
        const Icon = item.icon;
        const active = page === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-semibold transition ${active ? "bg-[#edf5ef] text-[#2f7a4b]" : "text-[#78867d]"}`}
          >
            <Icon size={19} strokeWidth={active ? 2.5 : 2} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function Header({ title, onMenu }: { title: string; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#e6eae5] bg-white/95 px-3 py-3 backdrop-blur sm:px-6 sm:py-4 xl:px-8">
      <div className="flex items-center gap-3">
        <button
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[#54705e] hover:bg-[#f1f5f2] sm:h-11 sm:w-11 lg:hidden"
          onClick={onMenu}
          aria-label="메뉴 열기"
        >
          <Menu size={21} />
        </button>
        <div>
          <p className="text-xs font-semibold text-[#91a097]">현장 관리</p>
          <h1 className="serif mt-0.5 text-xl text-[#1d3328] sm:text-2xl">
            {title}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-xs font-semibold text-[#304a3a]">관리자 계정</p>
          <p className="text-[11px] text-[#91a097]">
            오늘도 좋은 공간을 만드세요
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dcecdf] text-xs font-bold text-[#365943] sm:h-10 sm:w-10 sm:text-sm">
          JI
        </div>
      </div>
    </header>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string | number;
  tone: string;
  icon: typeof House;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className={`inline-flex shrink-0 rounded-lg p-2 ${tone}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#87938b]">{label}</p>
        <p className="text-xl font-bold leading-tight tracking-tight text-[#18372b]">
          {value}
        </p>
      </div>
      {onClick && (
        <ArrowUpRight
          size={15}
          className="ml-auto shrink-0 text-[#91a097] transition group-hover:text-[#476a55]"
        />
      )}
    </>
  );
  const className =
    "panel relative flex w-full items-center gap-3 overflow-hidden px-4 py-3.5 text-left";
  return onClick ? (
    <button
      type="button"
      className={`${className} group transition hover:-translate-y-0.5 hover:border-[#b9cabd] hover:shadow-[0_12px_30px_rgba(22,38,31,.08)]`}
      onClick={onClick}
      aria-label={`${label} ${value}, 상세 보기`}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

const calendarDateKey = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const calendarDateTimeKey = (value: string) => calendarDateKey(new Date(value));

const calendarTime = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));

function DashboardCalendar({
  onOpenProject,
  onOpenInquiry,
  todayScheduleRequest,
  onTodayScheduleCountChange,
}: {
  onOpenProject: (id: string) => void;
  onOpenInquiry: (id: string) => void;
  todayScheduleRequest: number;
  onTodayScheduleCountChange: (count: number) => void;
}) {
  const calendarRef = useRef<HTMLElement>(null);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [inquiries, setInquiries] = useState<EstimateInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [weekHeights, setWeekHeights] = useState<Record<string, number>>({});
  const [resizingWeek, setResizingWeek] = useState<{
    key: string;
    startY: number;
    startHeight: number;
  }>();

  useEffect(() => {
    const handleFullscreenChange = () =>
      setIsFullscreen(document.fullscreenElement === calendarRef.current);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === calendarRef.current) {
        await document.exitFullscreen();
      } else {
        await calendarRef.current?.requestFullscreen();
      }
    } catch {
      setError("전체화면으로 전환하지 못했습니다.");
    }
  };

  useEffect(() => {
    if (!resizingWeek) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (event: PointerEvent) => {
      const nextHeight = Math.min(
        360,
        Math.max(
          76,
          Math.round(
            resizingWeek.startHeight + event.clientY - resizingWeek.startY,
          ),
        ),
      );
      setWeekHeights((current) => ({
        ...current,
        [resizingWeek.key]: nextHeight,
      }));
    };
    const handlePointerUp = () => setResizingWeek(undefined);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [resizingWeek]);

  const startWeekResize = (
    event: ReactPointerEvent<HTMLButtonElement>,
    weekKey: string,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const weekElement = event.currentTarget.parentElement;
    if (!weekElement) return;
    setResizingWeek({
      key: weekKey,
      startY: event.clientY,
      startHeight: weekElement.getBoundingClientRect().height,
    });
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.projects("page_size=100&status=IN_PROGRESS"),
      api.projects("page_size=100&status=PLANNING"),
      api.inquiries("?page_size=100&status=CONSULTATION_SCHEDULED"),
    ])
      .then(([activeProjectResult, plannedProjectResult, inquiryResult]) => {
        if (!active) return;
        setProjects([
          ...activeProjectResult.items,
          ...plannedProjectResult.items,
        ]);
        setInquiries(inquiryResult.items);
        setError("");
      })
      .catch(() => {
        if (active) setError("일정 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
    ).getDate();
    const cellCount = mondayOffset + daysInMonth > 35 ? 42 : 35;
    const gridStart = new Date(
      month.getFullYear(),
      month.getMonth(),
      1 - mondayOffset,
    );
    return Array.from(
      { length: cellCount },
      (_, index) =>
        new Date(
          gridStart.getFullYear(),
          gridStart.getMonth(),
          gridStart.getDate() + index,
        ),
    );
  }, [month]);
  const calendarWeekKeys = useMemo(
    () =>
      Array.from({ length: calendarDays.length / 7 }, (_, weekIndex) =>
        calendarDateKey(calendarDays[weekIndex * 7]),
      ),
    [calendarDays],
  );

  const todayKey = calendarDateKey(new Date());
  const visibleMonthLabel = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;
  const scheduleForDate = useCallback(
    (dateKey: string) => {
      return [
        ...inquiries
          .filter(
            (inquiry) =>
              inquiry.consultation_reserved_at &&
              calendarDateTimeKey(inquiry.consultation_reserved_at) === dateKey,
          )
          .map((inquiry) => ({
            kind: "consultation" as const,
            inquiry,
            priority: 0,
          })),
        ...projects
          .filter((project) => {
            if (!project.planned_start_date || !project.planned_end_date)
              return false;
            const [start, end] = [
              project.planned_start_date,
              project.planned_end_date,
            ].sort();
            return start <= dateKey && dateKey <= end;
          })
          .map((project) => ({
            kind: "project" as const,
            project,
            priority: project.status === "IN_PROGRESS" ? 1 : 2,
          })),
      ].sort((left, right) => left.priority - right.priority);
    },
    [inquiries, projects],
  );
  const selectedDaySchedule = useMemo(
    () => (selectedCalendarDate ? scheduleForDate(selectedCalendarDate) : []),
    [scheduleForDate, selectedCalendarDate],
  );
  const todayScheduleCount = useMemo(
    () => scheduleForDate(todayKey).length,
    [scheduleForDate, todayKey],
  );

  useEffect(() => {
    onTodayScheduleCountChange(todayScheduleCount);
  }, [onTodayScheduleCountChange, todayScheduleCount]);

  useEffect(() => {
    if (todayScheduleRequest > 0) setSelectedCalendarDate(todayKey);
  }, [todayKey, todayScheduleRequest]);

  return (
    <section
      ref={calendarRef}
      className="panel flex min-h-0 flex-1 flex-col overflow-hidden fullscreen:h-screen fullscreen:w-screen fullscreen:rounded-none fullscreen:border-0 fullscreen:bg-white"
    >
      <div className="flex flex-col gap-3 border-b border-[#e5ebe6] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <CalendarDays size={19} className="text-[#376246]" />
            <h3 className="text-lg font-bold text-[#203a2d]">일정 캘린더</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[#66766d]">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-[#3f7650]" /> 공사 중
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-[#4f78ad]" /> 공사 예정
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-[#d7832f]" /> 상담 예약
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            className="rounded-lg border border-[#d8e0d9] bg-white p-2 text-[#50655a] transition hover:bg-[#f2f6f3]"
            onClick={() =>
              setMonth(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() - 1, 1),
              )
            }
            aria-label="이전 달"
          >
            <ChevronLeft size={17} />
          </button>
          <p className="min-w-28 text-center text-base font-bold text-[#294534]">
            {visibleMonthLabel}
          </p>
          <button
            type="button"
            className="rounded-lg border border-[#d8e0d9] bg-white p-2 text-[#50655a] transition hover:bg-[#f2f6f3]"
            onClick={() =>
              setMonth(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() + 1, 1),
              )
            }
            aria-label="다음 달"
          >
            <ChevronRight size={17} />
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#c9d7cc] bg-[#f2f7f3] px-3 py-2 text-xs font-bold text-[#376246] transition hover:bg-[#e7f0e8]"
            onClick={() => {
              const today = new Date();
              setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
            }}
          >
            오늘
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#d8e0d9] bg-white p-2 text-[#50655a] transition hover:bg-[#f2f6f3]"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "전체화면 종료" : "캘린더 전체화면"}
            title={isFullscreen ? "전체화면 종료" : "전체화면으로 보기"}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-x-auto">
        <div className="grid min-w-[760px] flex-1 grid-rows-[auto_minmax(0,1fr)]">
          <div className="grid grid-cols-7 border-b border-[#e7ece8] bg-[#f7f9f7]">
            {["월", "화", "수", "목", "금", "토", "일"].map(
              (weekday, index) => (
                <div
                  key={weekday}
                  className={`px-3 py-2 text-center text-xs font-bold ${
                    index === 6 ? "text-rose-500" : "text-[#66766d]"
                  }`}
                >
                  {weekday}
                </div>
              ),
            )}
          </div>
          <div
            className="grid min-h-0 divide-y divide-[#e5ebe6]"
            style={{
              gridTemplateRows: calendarWeekKeys
                .map((weekKey) =>
                  weekHeights[weekKey]
                    ? `${weekHeights[weekKey]}px`
                    : "minmax(76px, 1fr)",
                )
                .join(" "),
            }}
          >
            {Array.from({ length: calendarDays.length / 7 }, (_, weekIndex) =>
              calendarDays.slice(weekIndex * 7, weekIndex * 7 + 7),
            ).map((weekDays) => {
              const weekStartKey = calendarDateKey(weekDays[0]);
              const weekEndKey = calendarDateKey(weekDays[6]);
              const laneRanges: Array<Array<{ start: string; end: string }>> =
                [];
              const scheduleItems = [
                ...inquiries.flatMap((inquiry) => {
                  if (!inquiry.consultation_reserved_at) return [];
                  const dateKey = calendarDateTimeKey(
                    inquiry.consultation_reserved_at,
                  );
                  if (dateKey < weekStartKey || dateKey > weekEndKey) return [];
                  return [
                    {
                      kind: "consultation" as const,
                      inquiry,
                      segmentStart: dateKey,
                      segmentEnd: dateKey,
                      priority: 0,
                    },
                  ];
                }),
                ...projects.flatMap((project) => {
                  if (!project.planned_start_date || !project.planned_end_date)
                    return [];
                  const [start, end] = [
                    project.planned_start_date,
                    project.planned_end_date,
                  ].sort();
                  if (end < weekStartKey || start > weekEndKey) return [];
                  const segmentStart =
                    start < weekStartKey ? weekStartKey : start;
                  const segmentEnd = end > weekEndKey ? weekEndKey : end;
                  return [
                    {
                      kind: "project" as const,
                      project,
                      start,
                      end,
                      segmentStart,
                      segmentEnd,
                      priority: project.status === "IN_PROGRESS" ? 1 : 2,
                    },
                  ];
                }),
              ]
                .sort(
                  (left, right) =>
                    left.priority - right.priority ||
                    left.segmentStart.localeCompare(right.segmentStart) ||
                    left.segmentEnd.localeCompare(right.segmentEnd),
                )
                .map((item) => {
                  let lane = laneRanges.findIndex((ranges) =>
                    ranges.every(
                      (range) =>
                        item.segmentEnd < range.start ||
                        item.segmentStart > range.end,
                    ),
                  );
                  if (lane === -1) {
                    lane = laneRanges.length;
                    laneRanges.push([]);
                  }
                  laneRanges[lane].push({
                    start: item.segmentStart,
                    end: item.segmentEnd,
                  });
                  return { ...item, lane };
                });
              const laneCount = laneRanges.length;
              const visibleLaneCapacity = weekHeights[weekStartKey]
                ? Math.max(1, Math.floor((weekHeights[weekStartKey] - 48) / 24))
                : 1;
              const visibleLaneCount = Math.min(laneCount, visibleLaneCapacity);

              return (
                <div key={weekStartKey} className="relative">
                  <div className="grid h-full grid-cols-7 gap-px bg-[#e5ebe6]">
                    {weekDays.map((date) => {
                      const dateKey = calendarDateKey(date);
                      const isCurrentMonth =
                        date.getMonth() === month.getMonth();
                      const hiddenScheduleCount = scheduleItems.filter(
                        (item) =>
                          item.lane >= visibleLaneCount &&
                          item.segmentStart <= dateKey &&
                          dateKey <= item.segmentEnd,
                      ).length;
                      return (
                        <div
                          key={dateKey}
                          className={`h-full min-h-[76px] ${
                            isCurrentMonth
                              ? "bg-white"
                              : "bg-[#edf0ee] shadow-[inset_0_0_0_1px_#dce2dd]"
                          }`}
                        >
                          <div className="flex justify-end px-2 pb-1 pt-1.5">
                            <span
                              className={`flex h-6 items-center justify-center font-semibold ${
                                dateKey === todayKey
                                  ? "min-w-6 rounded-full bg-[#234c38] px-1 text-xs text-white"
                                  : isCurrentMonth
                                    ? "min-w-6 rounded-full px-1 text-xs text-[#465a4f]"
                                    : "min-w-10 rounded-md bg-[#dce2de] px-1.5 text-[10px] text-[#77827b]"
                              }`}
                            >
                              {isCurrentMonth
                                ? date.getDate()
                                : `${date.getMonth() + 1}/${date.getDate()}`}
                            </span>
                          </div>
                          <div style={{ height: visibleLaneCount * 24 }} />
                          {hiddenScheduleCount > 0 && (
                            <div className="px-2 pb-1">
                              <button
                                type="button"
                                className="w-full rounded-md bg-[#f1f4f2] px-2 py-0.5 text-left text-[10px] font-bold text-[#596a60] transition hover:bg-[#e5ebe6] hover:text-[#294534]"
                                onClick={() => setSelectedCalendarDate(dateKey)}
                              >
                                +{hiddenScheduleCount}개 일정
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {scheduleItems.some(
                    (item) => item.lane < visibleLaneCount,
                  ) && (
                    <div
                      className="pointer-events-none absolute inset-x-0 top-[32px] grid grid-cols-7 gap-x-px"
                      style={{
                        gridTemplateRows: `repeat(${visibleLaneCount}, 24px)`,
                      }}
                    >
                      {scheduleItems
                        .filter((item) => item.lane < visibleLaneCount)
                        .map((item) => {
                          const startColumn = weekDays.findIndex(
                            (date) =>
                              calendarDateKey(date) === item.segmentStart,
                          );
                          const endColumn = weekDays.findIndex(
                            (date) => calendarDateKey(date) === item.segmentEnd,
                          );
                          if (item.kind === "consultation") {
                            const label = `상담 예약 · ${calendarTime(item.inquiry.consultation_reserved_at!)} ${item.inquiry.customer_name}`;
                            return (
                              <button
                                key={`consultation-${item.inquiry.id}`}
                                type="button"
                                className="pointer-events-auto mx-2 flex min-w-0 items-center truncate rounded-md border-x-[3px] border-y border-x-[#b86518] border-y-[#b86518] bg-[#fff0df] px-2 text-left text-[11px] font-semibold text-[#9a5b1e] transition hover:z-20 hover:brightness-95"
                                style={{
                                  gridColumn: `${startColumn + 1} / ${endColumn + 2}`,
                                  gridRow: item.lane + 1,
                                }}
                                onClick={() => onOpenInquiry(item.inquiry.id)}
                                title={label}
                                aria-label={label}
                              >
                                {label}
                              </button>
                            );
                          }

                          const startsHere = item.start === item.segmentStart;
                          const endsHere = item.end === item.segmentEnd;
                          const statusLabel =
                            item.project.status === "PLANNING"
                              ? "공사 예정"
                              : "공사 중";
                          return (
                            <button
                              key={`project-${item.project.id}`}
                              type="button"
                              className={`pointer-events-auto mx-0 flex min-w-0 items-center truncate border-y px-2 text-left text-[11px] font-semibold transition hover:z-20 hover:brightness-95 ${
                                item.project.status === "PLANNING"
                                  ? "border-y-[#315f99] bg-[#e4edf9] text-[#315f99]"
                                  : "border-y-[#285d3a] bg-[#dcece0] text-[#285d3a]"
                              } ${
                                startsHere
                                  ? `ml-2 rounded-l-md border-l-[3px] ${
                                      item.project.status === "PLANNING"
                                        ? "border-l-[#315f99]"
                                        : "border-l-[#285d3a]"
                                    }`
                                  : "rounded-l-none"
                              } ${
                                endsHere
                                  ? `mr-2 rounded-r-md border-r-[3px] ${
                                      item.project.status === "PLANNING"
                                        ? "border-r-[#315f99]"
                                        : "border-r-[#285d3a]"
                                    }`
                                  : "rounded-r-none"
                              }`}
                              style={{
                                gridColumn: `${startColumn + 1} / ${endColumn + 2}`,
                                gridRow: item.lane + 1,
                              }}
                              onClick={() => onOpenProject(item.project.id)}
                              title={`${statusLabel} · ${item.project.title}`}
                              aria-label={`${statusLabel} · ${item.project.title}`}
                            >
                              {startsHere && (
                                <>
                                  {statusLabel} · {item.project.title}
                                </>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}
                  <button
                    type="button"
                    className="group absolute inset-x-0 bottom-[-4px] z-30 h-2 cursor-row-resize touch-none"
                    onPointerDown={(event) =>
                      startWeekResize(event, weekStartKey)
                    }
                    aria-label={`${weekDays[0].getMonth() + 1}월 ${weekDays[0].getDate()}일 주차 높이 조절`}
                    title="위아래로 드래그하여 일정 행 높이 조절"
                  >
                    <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-transparent transition group-hover:h-0.5 group-hover:bg-[#6f927a]" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {(loading || error) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[#e5ebe6] bg-[#fafbfa] px-5 py-3 text-xs text-[#6b786f] sm:px-6">
          {loading && <span>일정을 불러오는 중입니다…</span>}
          {error && <span className="text-rose-600">{error}</span>}
        </div>
      )}

      {selectedCalendarDate && (
        <Modal
          title={
            Number(selectedCalendarDate.slice(5, 7)) +
            "월 " +
            Number(selectedCalendarDate.slice(8, 10)) +
            "일 일정"
          }
          description={
            "총 " + selectedDaySchedule.length + "개의 일정이 있습니다."
          }
          onClose={() => setSelectedCalendarDate(undefined)}
          maxWidthClass="max-w-md"
        >
          <div className="space-y-2 px-5 pb-5">
            {selectedDaySchedule.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#d7dfd9] bg-[#f8faf8] px-5 py-8 text-center text-sm text-[#78867d]">
                등록된 일정이 없습니다.
              </div>
            )}
            {selectedDaySchedule.map((item) => {
              if (item.kind === "consultation") {
                return (
                  <button
                    key={"consultation-" + item.inquiry.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl border border-[#f0d2af] border-l-4 border-l-[#b86518] bg-[#fff8ef] px-4 py-3 text-left transition hover:bg-[#fff1df]"
                    onClick={() => {
                      setSelectedCalendarDate(undefined);
                      onOpenInquiry(item.inquiry.id);
                    }}
                  >
                    <span className="shrink-0 rounded-md bg-[#ffe7c8] px-2 py-1 text-xs font-bold text-[#9a5b1e]">
                      상담 예약
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-[#3f3429]">
                        {item.inquiry.customer_name}
                      </strong>
                      <span className="mt-0.5 block text-xs text-[#856b50]">
                        {calendarTime(item.inquiry.consultation_reserved_at!)}
                      </span>
                    </span>
                  </button>
                );
              }

              const isPlanned = item.project.status === "PLANNING";
              return (
                <button
                  key={"project-" + item.project.id}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-xl border border-l-4 px-4 py-3 text-left transition ${
                    isPlanned
                      ? "border-[#cbd9ec] border-l-[#315f99] bg-[#f3f7fc] hover:bg-[#e9f0f9]"
                      : "border-[#c8dece] border-l-[#285d3a] bg-[#f1f7f3] hover:bg-[#e7f1e9]"
                  }`}
                  onClick={() => {
                    setSelectedCalendarDate(undefined);
                    onOpenProject(item.project.id);
                  }}
                >
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${
                      isPlanned
                        ? "bg-[#dce8f7] text-[#315f99]"
                        : "bg-[#dcece0] text-[#285d3a]"
                    }`}
                  >
                    {isPlanned ? "공사 예정" : "공사 중"}
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-sm text-[#294534]">
                      {item.project.title}
                    </strong>
                    <span className="mt-0.5 block text-xs text-[#66766d]">
                      {item.project.planned_start_date} ~{" "}
                      {item.project.planned_end_date}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </section>
  );
}

function DashboardPage({
  onOpenProject,
  onOpenInquiry,
}: {
  onOpenProject: (id: string) => void;
  onOpenInquiry: (id: string) => void;
}) {
  const [todayScheduleCount, setTodayScheduleCount] = useState(0);
  const [todayScheduleRequest, setTodayScheduleRequest] = useState(0);
  return (
    <div className="flex min-h-0 flex-col gap-4 p-4 sm:p-6 md:h-[calc(100dvh-165px)] md:overflow-hidden lg:h-[calc(100dvh-89px)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="serif text-xl text-[#1b3025] sm:text-2xl lg:text-3xl">
          오늘의 현장을{" "}
          <span className="text-[#64846c]">한눈에 확인하세요</span>
        </h2>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row">
          <div className="w-full sm:w-52">
            <StatCard
              label="오늘의 일정"
              value={`${todayScheduleCount}건`}
              tone="bg-[#e8f3f2] text-[#39726d]"
              icon={CalendarDays}
              onClick={() => setTodayScheduleRequest((current) => current + 1)}
            />
          </div>
        </div>
      </div>
      <DashboardCalendar
        onOpenProject={onOpenProject}
        onOpenInquiry={onOpenInquiry}
        todayScheduleRequest={todayScheduleRequest}
        onTodayScheduleCountChange={setTodayScheduleCount}
      />
    </div>
  );
}

function ManagementOverviewPage({
  onOpenProject,
}: {
  onOpenProject: (id: string) => void;
}) {
  const [overview, setOverview] = useState<ManagementOverview | null>(null);
  const [password, setPassword] = useState("");
  const accessPasswordRef = useRef("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [projectModalStatus, setProjectModalStatus] = useState<{
    status: ProjectStatus;
    label: string;
  } | null>(null);
  const [projectModalItems, setProjectModalItems] = useState<ProjectListItem[]>(
    [],
  );
  const [projectModalPage, setProjectModalPage] = useState(1);
  const [projectModalTotal, setProjectModalTotal] = useState(0);
  const [projectModalHasMore, setProjectModalHasMore] = useState(false);
  const [projectModalLoading, setProjectModalLoading] = useState(false);
  const [projectModalError, setProjectModalError] = useState("");
  const projectModalScrollRef = useRef<HTMLDivElement>(null);
  const projectModalSentinelRef = useRef<HTMLDivElement>(null);

  const loadOverview = async (
    accessPassword: string,
    nextDateFrom: string,
    nextDateTo: string,
  ) => {
    setError("");
    setLoading(true);
    try {
      const result = await api.managementOverview(
        accessPassword,
        nextDateFrom,
        nextDateTo,
      );
      setOverview(result);
      setAppliedDateFrom(nextDateFrom);
      setAppliedDateTo(nextDateTo);
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "경영 현황을 확인하지 못했습니다.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    const accessPassword = password;
    if (await loadOverview(accessPassword, "", "")) {
      accessPasswordRef.current = accessPassword;
      setPassword("");
    }
  };

  const applyPeriod = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessPasswordRef.current) return;
    await loadOverview(accessPasswordRef.current, dateFrom, dateTo);
  };

  const resetPeriod = async () => {
    if (!accessPasswordRef.current) return;
    setDateFrom("");
    setDateTo("");
    await loadOverview(accessPasswordRef.current, "", "");
  };

  const openProjectStatus = (status: ProjectStatus, label: string) => {
    setProjectModalStatus({ status, label });
    setProjectModalItems([]);
    setProjectModalPage(1);
    setProjectModalTotal(0);
    setProjectModalHasMore(true);
    setProjectModalError("");
  };

  useEffect(() => {
    if (!projectModalStatus) return;
    let active = true;
    const params = new URLSearchParams({
      page: String(projectModalPage),
      page_size: "12",
      status: projectModalStatus.status,
    });
    if (appliedDateFrom) params.set("planned_start_date_from", appliedDateFrom);
    if (appliedDateTo) params.set("planned_start_date_to", appliedDateTo);

    setProjectModalLoading(true);
    setProjectModalError("");
    api
      .projects(`?${params.toString()}`)
      .then((result) => {
        if (!active) return;
        setProjectModalItems((current) => {
          const nextItems = projectModalPage === 1 ? [] : current;
          const knownIds = new Set(nextItems.map((item) => item.id));
          return [
            ...nextItems,
            ...result.items.filter((item) => !knownIds.has(item.id)),
          ];
        });
        setProjectModalTotal(result.total);
        setProjectModalHasMore(result.page * result.page_size < result.total);
      })
      .catch((caught) => {
        if (!active) return;
        setProjectModalHasMore(false);
        setProjectModalError(
          caught instanceof Error
            ? caught.message
            : "현장 목록을 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (active) setProjectModalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    appliedDateFrom,
    appliedDateTo,
    projectModalPage,
    projectModalStatus?.status,
  ]);

  useEffect(() => {
    const sentinel = projectModalSentinelRef.current;
    if (
      !projectModalStatus ||
      !sentinel ||
      projectModalLoading ||
      !projectModalHasMore
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setProjectModalPage((current) => current + 1);
      },
      {
        root: projectModalScrollRef.current,
        rootMargin: "120px 0px",
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    projectModalHasMore,
    projectModalItems.length,
    projectModalLoading,
    projectModalStatus,
  ]);

  if (!overview)
    return (
      <div className="flex min-h-[calc(100dvh-81px)] items-center justify-center p-4 sm:p-6 xl:min-h-[calc(100dvh-89px)] xl:p-8">
        <section className="panel w-full max-w-md p-6 sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#e8f1e9] text-[#315f40]">
            <LockKeyhole size={22} />
          </div>
          <h2 className="serif mt-5 text-2xl text-[#1d382a]">경영 현황 확인</h2>
          <p className="mt-2 text-sm leading-6 text-[#718078]">
            계약 및 입금 정보가 포함된 보호 메뉴입니다. 경영 현황 전용 2차
            비밀번호를 입력해 주세요.
          </p>
          <form className="mt-6" onSubmit={unlock}>
            <label className="label" htmlFor="management-password">
              2차 비밀번호
            </label>
            <input
              id="management-password"
              className="field"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
              required
            />
            {error && (
              <p className="mt-3 rounded-xl bg-[#fff0ef] px-3.5 py-2.5 text-xs text-[#a14e4e]">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn-primary mt-5 w-full py-3"
              disabled={loading || !password}
            >
              <ShieldCheck size={17} />
              {loading ? "확인 중…" : "경영 현황 열기"}
            </button>
          </form>
          <p className="mt-4 text-center text-[11px] text-[#93a097]">
            다른 메뉴로 이동하면 경영 현황은 다시 잠깁니다.
          </p>
        </section>
      </div>
    );

  const projectStatuses = [
    {
      label: "공사 예정",
      statusValue: "PLANNING" as ProjectStatus,
      value: overview.planning_projects,
      icon: CalendarDays,
      tone: "bg-[#fff3df] text-[#9a651f]",
      bar: "bg-[#d5a044]",
    },
    {
      label: "공사 중",
      statusValue: "IN_PROGRESS" as ProjectStatus,
      value: overview.in_progress_projects,
      icon: Clock3,
      tone: "bg-[#eaf1fb] text-[#386fae]",
      bar: "bg-[#4387d6]",
    },
    {
      label: "공사 완료",
      statusValue: "COMPLETED" as ProjectStatus,
      value: overview.completed_projects,
      icon: CheckCircle2,
      tone: "bg-[#eaf6ef] text-[#31734d]",
      bar: "bg-[#3b9b60]",
    },
  ];
  const trackedProjectCount = projectStatuses.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const projectShares = projectStatuses.map((item) =>
    trackedProjectCount ? (item.value / trackedProjectCount) * 100 : 0,
  );
  const completedRate = trackedProjectCount
    ? (overview.completed_projects / trackedProjectCount) * 100
    : 0;
  const planningEnd = projectShares[0];
  const inProgressEnd = planningEnd + projectShares[1];
  const projectChartBackground = trackedProjectCount
    ? `conic-gradient(#d5a044 0% ${planningEnd}%, #4387d6 ${planningEnd}% ${inProgressEnd}%, #3b9b60 ${inProgressEnd}% 100%)`
    : "#edf1ee";

  const outstandingAmount = Math.max(
    overview.total_contract - overview.total_paid,
    0,
  );
  const paymentRate = overview.total_contract
    ? (overview.total_paid / overview.total_contract) * 100
    : 0;
  const paymentChartRate = Math.min(100, Math.max(0, paymentRate));
  const financeItems = [
    {
      label: "총 계약 금액",
      value: money(overview.total_contract),
      description: "현재 현장에 적용된 계약 견적 합계",
      icon: FileText,
      tone: "bg-[#eef3ff] text-[#4169a1]",
    },
    {
      label: "입금된 금액",
      value: money(overview.total_paid),
      description: "등록된 전체 입금 내역 합계",
      icon: WalletCards,
      tone: "bg-[#eaf6ef] text-[#31734d]",
    },
    {
      label: "미수 금액",
      value: money(outstandingAmount),
      description: "계약 금액에서 입금액을 제외한 금액",
      icon: Clock3,
      tone: "bg-[#fff3df] text-[#9a651f]",
    },
  ];
  const appliedPeriodLabel = appliedDateFrom
    ? appliedDateTo
      ? `${appliedDateFrom} ~ ${appliedDateTo}`
      : `${appliedDateFrom} 이후`
    : appliedDateTo
      ? `${appliedDateTo} 이전`
      : "전체 기간";

  return (
    <>
      {projectModalStatus && (
        <Modal
          title={`${projectModalStatus.label} 현장`}
          description={`${appliedPeriodLabel} · 총 ${projectModalTotal}곳`}
          onClose={() => setProjectModalStatus(null)}
          maxWidthClass="max-w-2xl"
        >
          <div
            ref={projectModalScrollRef}
            className="max-h-[min(65dvh,620px)] overflow-y-auto px-5 pb-5"
          >
            {projectModalItems.length > 0 && (
              <div className="space-y-2">
                {projectModalItems.map((project) => (
                  <button
                    type="button"
                    key={project.id}
                    className="flex w-full items-center gap-3 rounded-xl border border-[#e4eae5] bg-white p-3 text-left transition hover:border-[#bfd0c2] hover:bg-[#f8faf8] sm:p-4"
                    onClick={() => {
                      setProjectModalStatus(null);
                      onOpenProject(project.id);
                    }}
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#edf2ed] text-[#7f9185]">
                      {project.cover_image ? (
                        <img
                          src={mediaUrl(project.cover_image.thumbnail_url)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <House size={18} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="truncate text-sm text-[#294534]">
                          {project.title}
                        </strong>
                        <Badge status={project.status} />
                      </span>
                      <span className="mt-1 block truncate text-xs text-[#7b8980]">
                        {projectTypeLabels[project.project_type]} ·{" "}
                        {project.address}
                      </span>
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-[#95a098]">
                        <CalendarDays size={12} />
                        {fullDate(project.planned_start_date)} ~{" "}
                        {fullDate(project.planned_end_date)}
                      </span>
                    </span>
                    <ChevronRight
                      size={17}
                      className="shrink-0 text-[#92a097]"
                    />
                  </button>
                ))}
              </div>
            )}

            {!projectModalLoading &&
              !projectModalError &&
              projectModalItems.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#d8e0da] bg-[#f8faf8] px-5 py-10 text-center text-sm text-[#7d8a82]">
                  해당 조건의 현장이 없습니다.
                </div>
              )}
            {projectModalError && (
              <p className="rounded-xl bg-[#fff0ef] px-4 py-3 text-sm text-[#a14e4e]">
                {projectModalError}
              </p>
            )}
            {projectModalLoading && (
              <div className="py-5 text-center text-xs font-semibold text-[#839087]">
                {projectModalItems.length
                  ? "다음 현장을 불러오는 중…"
                  : "현장 목록을 불러오는 중…"}
              </div>
            )}
            <div ref={projectModalSentinelRef} className="h-px" />
          </div>
        </Modal>
      )}
      <div className="space-y-5 p-4 sm:p-6 xl:p-8">
        <form
          className="panel flex flex-col gap-3 p-4 lg:flex-row lg:items-end"
          onSubmit={applyPeriod}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-[#294534]">조회 기간</p>
              <span className="rounded-full bg-[#edf4ee] px-2.5 py-1 text-[10px] font-bold text-[#4f6c59]">
                {appliedPeriodLabel}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-[#87948c]">
              공사 현황은 시작 예정일, 계약은 견적서 작성일, 입금은 입금일
              기준입니다.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="field sm:w-40"
              type="date"
              aria-label="경영 현황 조회 시작일"
              onClick={showDatePicker}
              max={dateTo || undefined}
              value={dateFrom}
              onChange={(event) => {
                const nextDate = event.target.value;
                setDateFrom(nextDate);
                if (dateTo && dateTo < nextDate) setDateTo("");
              }}
            />
            <span className="hidden text-sm text-[#8a968e] sm:inline">~</span>
            <input
              className="field sm:w-40"
              type="date"
              aria-label="경영 현황 조회 종료일"
              onClick={showDatePicker}
              min={dateFrom || undefined}
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-primary flex-1 whitespace-nowrap sm:flex-none"
                disabled={loading}
              >
                <Search size={15} /> {loading ? "조회 중…" : "조회"}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1 whitespace-nowrap sm:flex-none"
                onClick={resetPeriod}
                disabled={
                  loading ||
                  (!dateFrom && !dateTo && !appliedDateFrom && !appliedDateTo)
                }
              >
                <RotateCcw size={15} /> 초기화
              </button>
            </div>
          </div>
          {error && (
            <p className="rounded-xl bg-[#fff0ef] px-3.5 py-2.5 text-xs text-[#a14e4e] lg:max-w-64">
              {error}
            </p>
          )}
        </form>
        <section className="panel p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-[#edf1ed] pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#789081]">
                Construction
              </p>
              <h2 className="mt-1 text-lg font-bold text-[#213c2e]">
                공사 진행 현황
              </h2>
              <p className="mt-1 text-xs text-[#87958c]">
                공사 상태를 기준으로 집계한 전체 진행 분포입니다.
              </p>
            </div>
            <span className="rounded-full bg-[#eef4ef] px-3 py-1.5 text-xs font-bold text-[#496657]">
              총 {trackedProjectCount}곳
            </span>
          </div>

          <div className="mt-6 grid items-center gap-7 lg:grid-cols-[190px_minmax(0,1fr)]">
            <div className="flex justify-center">
              <div
                className="relative flex size-40 items-center justify-center rounded-full sm:size-44"
                style={{ background: projectChartBackground }}
                role="img"
                aria-label={`공사 완료 비율 ${Math.round(completedRate)}%`}
              >
                <div className="absolute inset-[18px] rounded-full bg-white shadow-[inset_0_0_0_1px_#edf1ed]" />
                <div className="relative text-center">
                  <p className="text-3xl font-bold tracking-tight text-[#18372b]">
                    {Math.round(completedRate)}%
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-[#7d8b82]">
                    완료 비율
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {projectStatuses.map(
                ({ label, statusValue, value, bar }, index) => {
                  const share = projectShares[index];
                  return (
                    <button
                      type="button"
                      className="block w-full rounded-xl p-2 text-left transition hover:bg-[#f6f9f6]"
                      key={label}
                      onClick={() => openProjectStatus(statusValue, label)}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-[#4c6154]">
                          {label}
                        </span>
                        <span className="font-bold text-[#213c2e]">
                          {value}곳
                          <span className="ml-1.5 text-xs font-medium text-[#8b978f]">
                            {Math.round(share)}%
                          </span>
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[#edf1ee]">
                        <div
                          className={`h-full rounded-full transition-[width] duration-500 ${bar}`}
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <div className="mt-7 grid gap-3 border-t border-[#edf1ed] pt-5 sm:grid-cols-3">
            {projectStatuses.map(
              ({ label, statusValue, value, icon: Icon, tone }) => (
                <button
                  type="button"
                  className="group flex items-center gap-3 rounded-xl bg-[#f8faf8] p-3.5 text-left transition hover:bg-[#eef4ef]"
                  key={label}
                  onClick={() => openProjectStatus(statusValue, label)}
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}
                  >
                    <Icon size={17} />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold text-[#7c8981]">
                      {label}
                    </p>
                    <p className="mt-0.5 text-lg font-bold leading-none text-[#18372b]">
                      {value}곳
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="ml-auto text-[#9aa69e] transition group-hover:translate-x-0.5 group-hover:text-[#55705e]"
                  />
                </button>
              ),
            )}
          </div>
        </section>

        <section className="panel p-5 sm:p-6">
          <div className="border-b border-[#edf1ed] pb-4">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#789081]">
              Finance
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#213c2e]">금액 현황</h2>
            <p className="mt-1 text-xs text-[#87958c]">
              적용된 계약 금액과 실제 입금 내역을 기준으로 계산합니다.
            </p>
          </div>

          <div className="mt-6 grid items-center gap-7 lg:grid-cols-[190px_minmax(0,1fr)]">
            <div className="flex justify-center">
              <div
                className="relative flex size-40 items-center justify-center rounded-full sm:size-44"
                style={{
                  background: `conic-gradient(#3b7f55 0% ${paymentChartRate}%, #e6ece7 ${paymentChartRate}% 100%)`,
                }}
                role="img"
                aria-label={`계약 금액 대비 입금률 ${Math.round(paymentRate)}%`}
              >
                <div className="absolute inset-[18px] rounded-full bg-white shadow-[inset_0_0_0_1px_#edf1ed]" />
                <div className="relative text-center">
                  <p className="text-3xl font-bold tracking-tight text-[#18372b]">
                    {Math.round(paymentRate)}%
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-[#7d8b82]">
                    입금률
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="grid gap-3 md:grid-cols-3">
                {financeItems.map(
                  ({ label, value, description, icon: Icon, tone }) => (
                    <div
                      className="rounded-xl border border-[#e5ebe6] bg-[#fbfcfb] p-4"
                      key={label}
                    >
                      <span
                        className={`flex size-9 items-center justify-center rounded-lg ${tone}`}
                      >
                        <Icon size={17} />
                      </span>
                      <p className="mt-4 text-xs font-semibold text-[#718078]">
                        {label}
                      </p>
                      <p className="mt-1 break-keep text-xl font-bold tracking-tight text-[#18372b]">
                        {value}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-[#929e96]">
                        {description}
                      </p>
                    </div>
                  ),
                )}
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#617269]">
                    입금 진행률
                  </span>
                  <span className="font-bold text-[#315f40]">
                    {money(overview.total_paid)} /{" "}
                    {money(overview.total_contract)}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#e6ece7]">
                  <div
                    className="h-full rounded-full bg-[#3b7f55] transition-[width] duration-500"
                    style={{ width: `${paymentChartRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function ProjectCard({
  project,
  archived,
  restoring,
  onOpen,
  onRestore,
}: {
  project: ProjectListItem;
  archived: boolean;
  restoring: boolean;
  onOpen: () => void;
  onRestore: () => void;
}) {
  const content = (
    <>
      <div className="relative h-40 bg-[#edf2ed] sm:h-48">
        {project.cover_image ? (
          <img
            src={mediaUrl(project.cover_image.thumbnail_url)}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[#a9b6ad]">
            <ImageIcon size={29} />
          </div>
        )}
        <div className="absolute left-4 top-4 inline-flex overflow-hidden rounded-md border border-[#d7ddd8] bg-white/95">
          <span
            className={`border-l-[3px] border-r border-r-[#dfe4e0] px-2.5 py-1.5 text-[11px] font-bold ${projectCardStatusStyles[project.status]}`}
          >
            {statusLabels[project.status]}
          </span>
          <span className="px-2.5 py-1.5 text-[11px] font-semibold text-[#405248]">
            {projectTypeLabels[project.project_type]}
          </span>
        </div>
        {project.is_public && (
          <span className="absolute right-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[#477653]">
            PUBLIC
          </span>
        )}
      </div>
      <div className="p-5 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-[#294534]">{project.title}</h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-[#93a097]">
              <MapPin size={12} />
              {project.address}
            </p>
          </div>
          {!archived && <ArrowUpRight size={17} className="text-[#8ea297]" />}
        </div>
      </div>
    </>
  );

  return (
    <article className="panel group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(22,38,31,.1)]">
      {archived ? (
        <div>{content}</div>
      ) : (
        <button
          type="button"
          className="block w-full text-left"
          onClick={onOpen}
        >
          {content}
        </button>
      )}
      <div className="mx-5 mt-5 flex items-center justify-between border-t border-[#eff1ed] py-4 text-xs text-[#8d9890]">
        <span className="flex items-center gap-1">
          <CalendarDays size={13} />
          {fullDate(project.planned_start_date)} ~{" "}
          {fullDate(project.actual_end_date || project.planned_end_date)}
        </span>
        {archived ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-[#315d47] hover:bg-[#edf3ee] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onRestore}
            disabled={restoring}
          >
            <RotateCcw size={13} /> {restoring ? "복원 중…" : "복원"}
          </button>
        ) : (
          <button type="button" className="font-semibold" onClick={onOpen}>
            상세 보기
          </button>
        )}
      </div>
    </article>
  );
}

function ProjectsPage({
  onOpen,
  onCreate,
}: {
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [projectType, setProjectType] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const load = () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      page_size: "6",
    });
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    if (projectType) params.set("project_type", projectType);
    if (showArchived) params.set("archived", "true");
    api
      .projects(`?${params}`)
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((caught) => {
        setItems([]);
        setTotal(0);
        setError(
          caught instanceof Error
            ? caught.message
            : "현장 목록을 불러오지 못했습니다.",
        );
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [page, projectType, query, status, showArchived]);
  const resetFilters = () => {
    setQuery("");
    setProjectType("");
    setStatus("");
    setFiltersOpen(false);
    setPage(1);
  };
  const restoreProject = async (id: string) => {
    setRestoringId(id);
    setError("");
    try {
      await api.restoreProject(id);
      load();
      showSuccessToast("현장을 복원했습니다.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "현장을 복원하지 못했습니다.",
      );
    } finally {
      setRestoringId(null);
    }
  };
  return (
    <div className="space-y-4 p-4 sm:space-y-6 sm:p-6 xl:p-8">
      <div
        className={`flex flex-col gap-4 sm:flex-row sm:items-end ${showArchived ? "justify-between" : "justify-end"}`}
      >
        {showArchived && (
          <div>
            <p className="text-sm text-[#758078]">
              삭제된 프로젝트를 관리합니다
            </p>
            <h2 className="serif mt-1 text-3xl text-[#1b3025]">삭제된 현장</h2>
          </div>
        )}
        <div className="flex w-full gap-2 self-start sm:w-auto sm:self-auto">
          <button
            type="button"
            className="btn-secondary flex-1 sm:flex-none"
            onClick={() => {
              setShowArchived((current) => !current);
              setPage(1);
              setError("");
            }}
          >
            {showArchived ? <FolderKanban size={17} /> : <Trash2 size={17} />}
            {showArchived ? "전체 현장" : "삭제된 현장"}
          </button>
          {!showArchived && (
            <button
              className="btn-primary flex-1 sm:flex-none"
              onClick={onCreate}
            >
              <Plus size={17} />새 현장 등록
            </button>
          )}
        </div>
      </div>
      <div className="space-y-2.5 lg:flex lg:gap-3 lg:space-y-0">
        <div className="flex min-w-0 flex-1 gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa49d]"
            />
            <input
              className={`field pl-10 ${query ? "pr-10" : ""}`}
              placeholder="현장명, 주소, 고객명 검색"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            {query && (
              <button
                type="button"
                className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#748078] hover:bg-[#edf2ee]"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
                aria-label="검색어 지우기"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="button"
            className={`relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-semibold transition lg:hidden ${
              filtersOpen || projectType || status
                ? "border-[#8eaa96] bg-[#edf5ef] text-[#28563a]"
                : "border-[#c9d3cb] bg-white text-[#52655a]"
            }`}
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="project-filters"
          >
            <SlidersHorizontal size={16} /> 필터
            {(projectType || status) && (
              <span className="flex size-5 items-center justify-center rounded-full bg-[#28563a] text-[10px] font-bold text-white">
                {Number(Boolean(projectType)) + Number(Boolean(status))}
              </span>
            )}
          </button>
        </div>
        <div
          id="project-filters"
          className={`${filtersOpen ? "flex" : "hidden"} flex-col gap-2.5 rounded-2xl border border-[#d7e0d9] bg-white p-3 shadow-[0_8px_24px_rgba(24,55,43,.06)] lg:contents`}
        >
          <DropdownSelect
            className="w-full lg:w-48"
            value={projectType}
            options={projectTypeFilterOptions}
            onChange={(value) => {
              setProjectType(value);
              setPage(1);
            }}
            ariaLabel="공사 구분 필터"
          />
          <DropdownSelect
            className="w-full lg:w-44"
            value={status}
            options={projectStatusFilterOptions}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            ariaLabel="현장 상태 필터"
          />
          {(projectType || status) && (
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 self-end px-2 text-sm font-semibold text-[#5f7166] lg:hidden"
              onClick={resetFilters}
            >
              <RotateCcw size={14} /> 필터 초기화
            </button>
          )}
          <button
            type="button"
            className="btn-secondary hidden shrink-0 lg:inline-flex lg:px-3"
            onClick={resetFilters}
            disabled={!query && !projectType && !status && page === 1}
          >
            <RotateCcw size={15} /> 초기화
          </button>
        </div>
      </div>
      {(projectType || status) && (
        <div
          className="flex flex-wrap gap-2 lg:hidden"
          aria-label="적용 중인 필터"
        >
          {projectType && (
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#e9f3ec] px-3 text-xs font-semibold text-[#2f6241]"
              onClick={() => {
                setProjectType("");
                setPage(1);
              }}
            >
              {
                projectTypeFilterOptions.find(
                  (option) => option.value === projectType,
                )?.label
              }
              <X size={13} />
            </button>
          )}
          {status && (
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#eef1f7] px-3 text-xs font-semibold text-[#4c5e76]"
              onClick={() => {
                setStatus("");
                setPage(1);
              }}
            >
              {
                projectStatusFilterOptions.find(
                  (option) => option.value === status,
                )?.label
              }
              <X size={13} />
            </button>
          )}
        </div>
      )}
      <p className="text-sm font-semibold text-[#65746b]">
        총 <span className="font-bold text-[#244333]">{total}</span>건
      </p>
      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {loading ? (
        <div className="py-20 text-center text-sm text-[#8d9890]">
          현장 목록을 불러오는 중입니다…
        </div>
      ) : items.length ? (
        <div className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                archived={showArchived}
                restoring={restoringId === project.id}
                onOpen={() => onOpen(project.id)}
                onRestore={() => restoreProject(project.id)}
              />
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={6}
            total={total}
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      ) : (
        <Empty
          title={
            showArchived ? "삭제된 현장이 없습니다" : "등록된 현장이 없습니다"
          }
          message={
            showArchived
              ? "삭제한 현장이 이곳에 표시됩니다."
              : "첫 번째 프로젝트를 등록하고 사진과 공사비를 기록해보세요."
          }
          action={
            !showArchived ? (
              <button className="btn-primary" onClick={onCreate}>
                <Plus size={16} />
                현장 등록하기
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function MapLocationPicker({
  initialLatitude,
  initialLongitude,
  onClose,
  onSelect,
}: {
  initialLatitude?: number;
  initialLongitude?: number;
  onClose: () => void;
  onSelect: (result: GeocodeResult) => void;
}) {
  const [position, setPosition] = useState<{
    latitude: number;
    longitude: number;
  } | null>(
    initialLatitude != null && initialLongitude != null
      ? { latitude: initialLatitude, longitude: initialLongitude }
      : null,
  );
  const [result, setResult] = useState<GeocodeResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const initialCenter = useMemo(
    () =>
      initialLatitude != null && initialLongitude != null
        ? { latitude: initialLatitude, longitude: initialLongitude }
        : { latitude: 37.3943, longitude: 126.9568 },
    [initialLatitude, initialLongitude],
  );
  const pickerMarkers = useMemo(
    () => (position ? [{ ...position, title: "선택한 위치" }] : []),
    [position],
  );
  const choosePosition = useCallback(
    async (next: { latitude: number; longitude: number }) => {
      setPosition(next);
      setResult(null);
      setResolving(true);
      setError("");
      try {
        setResult(await api.reverseGeocode(next.latitude, next.longitude));
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "선택한 위치의 주소를 확인하지 못했습니다.",
        );
      } finally {
        setResolving(false);
      }
    },
    [],
  );

  return (
    <Modal
      title="지도에서 위치 선택"
      description="지도를 이동·확대한 뒤 등록할 건물이나 도로를 클릭하세요."
      onClose={onClose}
      closeDisabled={resolving}
      maxWidthClass="max-w-4xl"
    >
      <div className="relative">
        <NaverMap
          className="h-[320px] w-full bg-[#edf2ed] sm:h-[520px]"
          markers={pickerMarkers}
          initialCenter={initialCenter}
          selectable
          onMapClick={choosePosition}
        />
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-[#17372b]/90 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          원하는 위치를 클릭하세요
        </div>
      </div>
      <div className="flex flex-col gap-4 border-t border-[#e5eae5] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          {resolving && (
            <p className="text-sm font-semibold text-[#557060]">
              선택한 위치의 주소를 확인하는 중…
            </p>
          )}
          {result && (
            <>
              <p className="text-sm font-bold text-[#294534]">
                {result.road_address}
              </p>
              {result.jibun_address &&
                result.jibun_address !== result.road_address && (
                  <p className="mt-1 text-xs text-[#849188]">
                    지번 {result.jibun_address}
                  </p>
                )}
            </>
          )}
          {error && <p className="max-w-xl text-sm text-rose-600">{error}</p>}
          {!resolving && !result && !error && (
            <p className="text-sm text-[#849188]">
              아직 선택한 위치가 없습니다.
            </p>
          )}
        </div>
        <div className="flex shrink-0 justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!result || resolving}
            onClick={() => result && onSelect(result)}
          >
            <MapPin size={15} /> 이 위치로 등록
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProjectForm({
  project,
  onDone,
  onCancel,
}: {
  project?: Project;
  onDone: (project: Project) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(
    project
      ? { ...project }
      : {
          title: "",
          project_type: "INTERIOR",
          status: "PLANNING",
          address: "",
          address_detail: "",
          is_public: false,
          housing_type: "",
          area_pyeong: "",
          planned_start_date: "",
          planned_end_date: "",
          work_scope: "",
          description: "",
          internal_memo: "",
        },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const set = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const plannedStartDate = String(form.planned_start_date || "");
    const plannedEndDate = String(form.planned_end_date || "");
    if (
      plannedStartDate &&
      plannedEndDate &&
      plannedEndDate < plannedStartDate
    ) {
      setError("공사 종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        area_pyeong: form.area_pyeong ? Number(form.area_pyeong) : null,
        planned_start_date: form.planned_start_date || null,
        planned_end_date: form.planned_end_date || null,
      };
      const result = project
        ? await api.updateProject(project.id, body)
        : await api.createProject(body);
      showSuccessToast(
        project ? "현장 정보를 수정했습니다." : "새 현장을 등록했습니다.",
      );
      onDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 xl:p-8">
      <button
        className="mb-5 flex items-center gap-1 text-sm font-semibold text-[#68806f]"
        onClick={onCancel}
      >
        <ChevronLeft size={17} />
        현장 목록으로
      </button>
      <div className="mb-7">
        <h2 className="serif text-3xl text-[#1b3025]">
          {project ? "현장 정보 수정" : "새 현장 등록"}
        </h2>
      </div>
      <form onSubmit={submit} className="space-y-6">
        <section className="panel p-4 sm:p-6 xl:p-7">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-semibold text-[#294534]">기본 정보</h3>
            <label className="flex cursor-pointer items-center gap-3">
              <span className="text-right">
                <span className="block text-sm font-semibold text-[#3c5948]">
                  외부 공개
                </span>
                <span className="block text-[11px] text-[#8a968e]">
                  완료 현장만 표시됩니다
                </span>
              </span>
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={Boolean(form.is_public)}
                  onChange={(e) => set("is_public", e.target.checked)}
                />
                <span className="h-6 w-11 rounded-full bg-[#d8dfd8] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-[#4c815b] peer-checked:after:translate-x-full" />
              </span>
            </label>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">
                현장명 <span className="required-mark">*</span>
              </label>
              <input
                className="field"
                value={String(form.title || "")}
                onChange={(e) => set("title", e.target.value)}
                required
                placeholder="예: 성수동 32평 아파트"
              />
            </div>
            <div>
              <label className="label">고객명</label>
              <input
                className="field"
                value={String(form.customer_name || "")}
                onChange={(e) => set("customer_name", e.target.value)}
                placeholder="고객명"
              />
            </div>
            <div>
              <label className="label">주거 유형</label>
              <input
                className="field"
                value={String(form.housing_type || "")}
                onChange={(e) => set("housing_type", e.target.value)}
                placeholder="아파트, 주택, 상가…"
              />
            </div>
            <div>
              <label className="label">공사 구분</label>
              <DropdownSelect
                value={String(form.project_type || "INTERIOR")}
                options={projectTypeOptions}
                onChange={(projectType) => set("project_type", projectType)}
                ariaLabel="공사 구분"
              />
            </div>
            <div>
              <label className="label">공사 상태</label>
              <ProjectStatusSelect
                value={String(form.status) as ProjectStatus}
                onChange={(status) => set("status", status)}
              />
            </div>
            <div>
              <label className="label">면적 (평)</label>
              <IntegerInput
                className="field"
                value={String(form.area_pyeong || "")}
                onValueChange={(value) => set("area_pyeong", value)}
                placeholder="32"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">
                주소 <span className="required-mark">*</span>
              </label>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  className="field"
                  value={String(form.address || "")}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      address: e.target.value,
                      latitude: null,
                      longitude: null,
                    }));
                  }}
                  required
                  placeholder="도로명 주소를 입력하세요"
                />
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  onClick={() => setMapPickerOpen(true)}
                >
                  <MapPin size={15} /> 지도에서 선택
                </button>
              </div>
              {form.latitude && form.longitude ? (
                <p className="mt-2 text-xs text-[#64806c]">
                  지도 좌표가 등록되었습니다.
                </p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <label className="label">상세 주소</label>
              <input
                className="field"
                value={String(form.address_detail || "")}
                onChange={(e) => set("address_detail", e.target.value)}
                placeholder="예: 101동 1203호"
              />
            </div>
            <div>
              <label className="label">공사 시작 예정일</label>
              <input
                className="field"
                type="date"
                onClick={showDatePicker}
                value={String(form.planned_start_date || "")}
                onChange={(e) => {
                  const plannedStartDate = e.target.value;
                  setForm((current) => ({
                    ...current,
                    planned_start_date: plannedStartDate,
                    planned_end_date:
                      current.planned_end_date &&
                      String(current.planned_end_date) < plannedStartDate
                        ? ""
                        : current.planned_end_date,
                  }));
                }}
              />
            </div>
            <div>
              <label className="label">공사 완료 예정일</label>
              <input
                className="field"
                type="date"
                onClick={showDatePicker}
                min={String(form.planned_start_date || "") || undefined}
                value={String(form.planned_end_date || "")}
                onChange={(e) => set("planned_end_date", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">공사 범위</label>
              <textarea
                className="field min-h-28 resize-y"
                value={String(form.work_scope || "")}
                onChange={(e) => set("work_scope", e.target.value)}
                placeholder="공사할 공간과 작업 내용을 입력해 주세요."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">내부 메모</label>
              <textarea
                className="field min-h-24 resize-y"
                value={String(form.internal_memo || "")}
                onChange={(e) => set("internal_memo", e.target.value)}
                placeholder="고객 요청이나 현장 특이사항 등 관리자용 메모를 입력해 주세요."
              />
            </div>
          </div>
        </section>
        {error && (
          <p className="rounded-xl bg-[#fff0ef] px-4 py-3 text-sm text-[#a14e4e]">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            취소
          </button>
          <button className="btn-primary" disabled={saving}>
            {saving ? "저장 중…" : "현장 저장"}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </form>
      {mapPickerOpen && (
        <MapLocationPicker
          initialLatitude={
            form.latitude == null ? undefined : Number(form.latitude)
          }
          initialLongitude={
            form.longitude == null ? undefined : Number(form.longitude)
          }
          onClose={() => setMapPickerOpen(false)}
          onSelect={(result) => {
            setForm((prev) => ({
              ...prev,
              address: result.road_address || result.jibun_address || "",
              latitude: result.latitude,
              longitude: result.longitude,
            }));
            setMapPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function DetailPage({
  id,
  initialTab = "overview",
  onBack,
  onEdit,
  onDeleted,
  onOpenEstimate,
  onCreateEstimateVersion,
}: {
  id: string;
  initialTab?: "overview" | "photos";
  onBack: () => void;
  onEdit: (project: Project) => void;
  onDeleted: () => void;
  onOpenEstimate: (inquiryId: string, estimateId: string) => void;
  onCreateEstimateVersion: (
    inquiryId: string,
    estimateId: string,
    projectId: string,
  ) => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [costs, setCosts] = useState<{
    items: Cost[];
    estimate: ContractEstimateReference | null;
    summary: CostSummary;
  } | null>(null);
  const [payments, setPayments] = useState<{
    items: Payment[];
    summary: PaymentSummary;
  } | null>(null);
  const [tab, setTab] = useState<
    "overview" | "photos" | "simulation" | "costs"
  >(initialTab);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });
  const [previewImage, setPreviewImage] = useState<Image | null>(null);
  const [imageToDelete, setImageToDelete] = useState<Image | null>(null);
  const [photoClassificationFilter, setPhotoClassificationFilter] =
    useState("");
  const [savingPhotoClassificationId, setSavingPhotoClassificationId] =
    useState<string | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);
  const [projectDeleteOpen, setProjectDeleteOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    stage: "DEPOSIT" as PaymentStage,
    method: "BANK_TRANSFER" as PaymentMethod,
    supply_amount: "",
    paid_date: dateInputValue(),
    memo: "",
  });
  const [useFullReceivable, setUseFullReceivable] = useState(false);
  const load = () => {
    api
      .project(id)
      .then(setProject)
      .catch((e) => setError(e.message));
    api
      .costs(id)
      .then(setCosts)
      .catch(() => {});
    api
      .payments(id)
      .then(setPayments)
      .catch(() => {});
  };
  useEffect(load, [id]);
  useEffect(() => setTab(initialTab), [id, initialTab]);
  useEffect(() => {
    setPhotoClassificationFilter("");
  }, [id]);
  useEffect(() => {
    if (
      photoClassificationFilter &&
      photoClassificationFilter !== "__unclassified__" &&
      project &&
      !project.images.some(
        (image) => image.classification === photoClassificationFilter,
      )
    )
      setPhotoClassificationFilter("");
  }, [photoClassificationFilter, project]);
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    const supportedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);
    const supportedExtension = /\.(jpe?g|png|webp|gif)$/i;
    const unsupportedFile = files.find(
      (file) =>
        !supportedTypes.has(file.type) && !supportedExtension.test(file.name),
    );
    if (unsupportedFile) {
      setError(
        `${unsupportedFile.name}: JPG, PNG, WEBP, GIF 형식만 등록할 수 있습니다.`,
      );
      input.value = "";
      return;
    }
    const oversizedFile = files.find((file) => file.size > 15 * 1024 * 1024);
    if (oversizedFile) {
      setError(`${oversizedFile.name}: 사진은 한 장당 15MB 이하여야 합니다.`);
      input.value = "";
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    setError("");
    const needsCover = !project?.images.some((image) => image.is_cover);
    let uploadedCount = 0;
    try {
      for (const [index, file] of files.entries()) {
        await api.uploadImage(
          id,
          file,
          project?.status === "COMPLETED" ? "AFTER" : "PROGRESS",
          needsCover && index === 0,
          Boolean(project?.is_public),
        );
        uploadedCount += 1;
        setUploadProgress({ current: index + 1, total: files.length });
      }
      showSuccessToast(
        files.length === 1
          ? "사진을 등록했습니다."
          : `사진 ${files.length}장을 등록했습니다.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드에 실패했습니다.");
    } finally {
      if (uploadedCount > 0) load();
      setUploading(false);
      setUploadProgress({ current: 0, total: 0 });
      input.value = "";
    }
  };
  const addPayment = async (event: FormEvent) => {
    event.preventDefault();
    const receivableTotal = Math.max(
      payments?.summary.receivable_total || 0,
      0,
    );
    const receivableVat = Math.min(
      Math.max(payments?.summary.receivable_vat || 0, 0),
      receivableTotal,
    );
    const paymentAmount = useFullReceivable
      ? receivableTotal
      : Number(paymentForm.supply_amount);
    if (!paymentAmount) return;
    await api.createPayment(id, {
      stage: paymentForm.stage,
      method: paymentForm.method,
      supply_amount: useFullReceivable
        ? receivableTotal - receivableVat
        : paymentAmount,
      vat_amount: useFullReceivable ? receivableVat : 0,
      paid_at: new Date(`${paymentForm.paid_date}T00:00:00`).toISOString(),
      memo: paymentForm.memo,
    });
    setUseFullReceivable(false);
    setPaymentForm({
      ...paymentForm,
      supply_amount: "",
      paid_date: dateInputValue(),
      memo: "",
    });
    setPayments(await api.payments(id));
    showSuccessToast("입금 내역을 등록했습니다.");
  };
  const deleteProject = async () => {
    setDeletingProject(true);
    setError("");
    try {
      await api.deleteProject(id);
      setProjectDeleteOpen(false);
      showSuccessToast("현장을 삭제했습니다.");
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "현장을 삭제하지 못했습니다.");
    } finally {
      setDeletingProject(false);
    }
  };
  const deleteSelectedImage = async () => {
    if (!imageToDelete) return;
    setDeletingImage(true);
    setError("");
    try {
      await api.deleteImage(id, imageToDelete.id);
      setImageToDelete(null);
      load();
      showSuccessToast("사진을 삭제했습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 삭제하지 못했습니다.");
    } finally {
      setDeletingImage(false);
    }
  };
  if (error && !project)
    return (
      <div className="p-8">
        <p className="text-sm text-[#a14e4e]">{error}</p>
        <button className="btn-secondary mt-4" onClick={onBack}>
          돌아가기
        </button>
      </div>
    );
  if (!project)
    return (
      <div className="p-8 text-sm text-[#7d8981]">
        현장 정보를 불러오는 중입니다…
      </div>
    );
  const photoClassifications = Array.from(
    new Set(
      project.images
        .map((image) => image.classification?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right, "ko"));
  const filteredPhotos = project.images.filter((image) => {
    if (!photoClassificationFilter) return true;
    if (photoClassificationFilter === "__unclassified__")
      return !image.classification?.trim();
    return image.classification === photoClassificationFilter;
  });
  const unclassifiedPhotoCount = project.images.filter(
    (image) => !image.classification?.trim(),
  ).length;
  const photoClassificationOptions = Array.from(
    new Set([...photoClassificationPresets, ...photoClassifications]),
  );
  const updatePhotoClassification = async (
    imageId: string,
    classification: string,
  ) => {
    setSavingPhotoClassificationId(imageId);
    setError("");
    try {
      await api.updateImage(id, imageId, {
        classification: classification || null,
      });
      setProject((current) =>
        current
          ? {
              ...current,
              images: current.images.map((image) =>
                image.id === imageId
                  ? { ...image, classification: classification || undefined }
                  : image,
              ),
            }
          : current,
      );
      showSuccessToast("사진 분류를 수정했습니다.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "사진 분류를 저장하지 못했습니다.",
      );
    } finally {
      setSavingPhotoClassificationId(null);
    }
  };
  const paidPayments = payments?.items || [];
  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6 xl:p-8">
      {previewImage && (
        <PhotoViewerModal
          imageUrl={mediaUrl(previewImage.original_url)}
          alt={`${project.title} ${previewImage.classification || "현장"} 사진`}
          projectTitle={project.title}
          classification={previewImage.classification}
          onClose={() => setPreviewImage(null)}
        />
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            className="mb-4 flex items-center gap-1 text-sm font-semibold text-[#68806f]"
            onClick={onBack}
          >
            <ChevronLeft size={17} />
            전체 현장
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="serif text-2xl text-[#1b3025] sm:text-3xl">
              {project.title}
            </h2>
            <Badge status={project.status} />
            <ProjectTypeBadge projectType={project.project_type} />
            {project.is_public && (
              <span className="rounded-full bg-[#e9f5ee] px-2.5 py-1 text-xs font-semibold text-[#3b7e59]">
                공개 중
              </span>
            )}
          </div>
          <p className="mt-2 flex items-center gap-1 text-sm text-[#87938b]">
            <MapPin size={15} />
            {project.address}
            {project.address_detail && ` ${project.address_detail}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => onEdit(project)}>
            <Pencil size={15} />
            수정
          </button>
          <button
            className="rounded-xl border border-[#f0dada] p-2.5 text-[#a75d5d] hover:bg-[#fff4f4]"
            onClick={() => setProjectDeleteOpen(true)}
            aria-label="현장 삭제"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-[#e6eae5]">
        {[
          ["overview", "현장 개요"],
          ["photos", `사진 ${project.images.length}`],
          ...(SIMULATION_ENABLED ? [["simulation", "2D·3D 시뮬레이션"]] : []),
          ["costs", "공사비·입금"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === key ? "border-[#3d7650] text-[#315f40]" : "border-transparent text-[#9aa49d] hover:text-[#577060]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <section className="panel p-4 sm:p-6 xl:p-7">
            <h3 className="font-semibold text-[#294534]">현장 정보</h3>
            <div className="mt-5 grid gap-y-6 text-sm sm:grid-cols-2">
              <div>
                <p className="label !text-[#7a8580]">공사 구분</p>
                <ProjectTypeBadge projectType={project.project_type} />
              </div>
              <div>
                <p className="label !text-[#7a8580]">상태</p>
                <Badge status={project.status} />
              </div>
              <div>
                <p className="label !text-[#7a8580]">면적</p>
                <p className="value-text !text-[#10271d]">
                  {project.area_pyeong
                    ? `${Math.round(Number(project.area_pyeong))}평`
                    : "미등록"}
                </p>
              </div>
              <div>
                <p className="label !text-[#7a8580]">공사 기간</p>
                <p className="value-text !text-[#10271d]">
                  {fullDate(project.planned_start_date)} ~{" "}
                  {fullDate(
                    project.actual_end_date || project.planned_end_date,
                  )}
                </p>
              </div>
              <div>
                <p className="label !text-[#7a8580]">주거 유형</p>
                <p className="value-text !text-[#10271d]">
                  {project.housing_type || "미등록"}
                </p>
              </div>
            </div>
            <div className="mt-7 border-t border-[#edf0ec] pt-5">
              <p className="label !text-[#7a8580]">공사 범위</p>
              <p className="value-copy whitespace-pre-wrap !text-[#18372b]">
                {project.work_scope || "등록된 공사 범위가 없습니다."}
              </p>
            </div>
            <div className="mt-5 border-t border-[#edf0ec] pt-5">
              <p className="label !text-[#7a8580]">내부 메모</p>
              <p className="value-copy whitespace-pre-wrap !text-[#18372b]">
                {project.internal_memo || "등록된 내부 메모가 없습니다."}
              </p>
            </div>
          </section>
          <section className="panel flex h-full flex-col overflow-hidden">
            <div className="relative flex min-h-64 flex-1 items-center justify-center overflow-hidden bg-[#edf2ed]">
              {project.images.find((i) => i.is_cover) ? (
                <img
                  src={mediaUrl(
                    project.images.find((i) => i.is_cover)?.thumbnail_url,
                  )}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="text-center text-[#9baa9e]">
                  <ImageIcon className="mx-auto mb-2" size={28} />
                  <p className="text-xs">대표 사진을 등록해주세요</p>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-3 border-t border-[#e4eae5] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <p className="label">대표 사진</p>
                <p className="text-sm font-semibold text-[#4b6254]">
                  {project.is_public
                    ? "공개 현장에 표시되는 사진입니다."
                    : "현재 관리자에게만 표시됩니다."}
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary shrink-0 self-start px-3 py-2 text-xs sm:self-auto"
                onClick={() => setTab("photos")}
              >
                <Camera size={14} /> 사진 관리
              </button>
            </div>
          </section>
        </div>
      )}
      {tab === "photos" && (
        <section className="space-y-5">
          <div className="panel flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-7">
            <div>
              <h3 className="font-semibold text-[#294534]">현장 사진</h3>
              <p className="mt-1 text-sm text-[#8a968e]">
                JPG, PNG, WEBP · 최대 15MB
              </p>
            </div>
            <div className="grid w-full gap-2 sm:flex sm:w-auto">
              <label
                className={`btn-primary min-h-11 cursor-pointer px-4 ${
                  uploading ? "pointer-events-none opacity-60" : ""
                }`}
              >
                <Camera size={17} />
                {uploading
                  ? `업로드 중 ${uploadProgress.current}/${uploadProgress.total}`
                  : "카메라 촬영"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  capture="environment"
                  className="hidden"
                  onChange={upload}
                  disabled={uploading}
                />
              </label>
              <label
                className={`btn-secondary min-h-11 cursor-pointer px-4 ${
                  uploading ? "pointer-events-none opacity-60" : ""
                }`}
              >
                <Upload size={17} />
                사진 선택
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={upload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
          {error && (
            <p className="rounded-xl bg-[#fff0ef] px-4 py-3 text-sm text-[#a14e4e]">
              {error}
            </p>
          )}
          {project.images.length ? (
            <>
              <div className="panel p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-sm font-semibold text-[#405a4b]">
                    분류별 보기
                  </span>
                  <button
                    type="button"
                    className={`min-h-10 rounded-full px-3 py-2 text-xs font-semibold transition ${
                      !photoClassificationFilter
                        ? "bg-[#18372b] text-white"
                        : "border border-[#d4ded6] bg-white text-[#52675a] hover:bg-[#f2f6f3]"
                    }`}
                    onClick={() => setPhotoClassificationFilter("")}
                  >
                    전체 {project.images.length}
                  </button>
                  {photoClassifications.map((classification) => {
                    const count = project.images.filter(
                      (image) => image.classification === classification,
                    ).length;
                    return (
                      <button
                        type="button"
                        key={classification}
                        className={`min-h-10 rounded-full px-3 py-2 text-xs font-semibold transition ${
                          photoClassificationFilter === classification
                            ? "bg-[#18372b] text-white"
                            : "border border-[#d4ded6] bg-white text-[#52675a] hover:bg-[#f2f6f3]"
                        }`}
                        onClick={() =>
                          setPhotoClassificationFilter(classification)
                        }
                      >
                        {classification} {count}
                      </button>
                    );
                  })}
                  {unclassifiedPhotoCount > 0 && (
                    <button
                      type="button"
                      className={`min-h-10 rounded-full px-3 py-2 text-xs font-semibold transition ${
                        photoClassificationFilter === "__unclassified__"
                          ? "bg-[#18372b] text-white"
                          : "border border-[#d4ded6] bg-white text-[#52675a] hover:bg-[#f2f6f3]"
                      }`}
                      onClick={() =>
                        setPhotoClassificationFilter("__unclassified__")
                      }
                    >
                      미분류 {unclassifiedPhotoCount}
                    </button>
                  )}
                </div>
              </div>
              {filteredPhotos.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredPhotos.map((image) => (
                    <div key={image.id} className="panel overflow-hidden">
                      <div className="group relative aspect-square bg-[#edf2ed]">
                        <button
                          type="button"
                          className="absolute inset-0 h-full w-full cursor-zoom-in overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#628b72]"
                          onClick={() => setPreviewImage(image)}
                          aria-label={`${project.title} 사진 크게 보기`}
                        >
                          <img
                            src={mediaUrl(image.thumbnail_url)}
                            alt={`${project.title} ${image.classification || "현장"} 사진`}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                          />
                          <span className="absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-black/55 text-white shadow-sm backdrop-blur-sm transition sm:opacity-0 sm:group-hover:opacity-100">
                            <Maximize2 size={16} />
                          </span>
                        </button>
                        {image.classification && (
                          <span className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
                            {image.classification}
                          </span>
                        )}
                        {image.is_cover && (
                          <span className="pointer-events-none absolute bottom-3 right-14 z-10 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-[#355d40] shadow-sm">
                            대표
                          </span>
                        )}
                        <button
                          type="button"
                          className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-xl bg-black/55 text-white shadow-sm transition hover:bg-black/70"
                          onClick={() => setImageToDelete(image)}
                          aria-label="사진 삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="absolute left-2 top-2 z-10 flex gap-1.5">
                          <button
                            type="button"
                            className={`min-h-10 rounded-xl px-3 py-2 text-xs font-semibold shadow-sm ${image.is_public ? "bg-[#3d7650] text-white" : "bg-white/95 text-[#355d40]"}`}
                            onClick={async () => {
                              await api.updateImage(id, image.id, {
                                is_public: !image.is_public,
                              });
                              load();
                              showSuccessToast(
                                image.is_public
                                  ? "사진을 비공개로 변경했습니다."
                                  : "사진을 공개했습니다.",
                              );
                            }}
                          >
                            {image.is_public ? "공개" : "비공개"}
                          </button>
                          {!image.is_cover && (
                            <button
                              type="button"
                              className="min-h-10 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-[#355d40] shadow-sm"
                              onClick={async () => {
                                await api.updateImage(id, image.id, {
                                  is_cover: true,
                                });
                                load();
                                showSuccessToast("대표 사진으로 지정했습니다.");
                              }}
                            >
                              대표 지정
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="border-t border-[#e2e8e3] bg-[#f7faf7] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#607368]">
                            <ImageIcon size={13} aria-hidden="true" />
                            사진 분류
                          </span>
                          {savingPhotoClassificationId === image.id && (
                            <span className="text-[10px] font-medium text-[#628b72]">
                              저장 중…
                            </span>
                          )}
                        </div>
                        <PhotoClassificationEditor
                          value={image.classification || ""}
                          options={photoClassificationOptions}
                          onSave={(classification) =>
                            void updatePhotoClassification(
                              image.id,
                              classification,
                            )
                          }
                          disabled={savingPhotoClassificationId === image.id}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="해당 분류의 사진이 없습니다"
                  message="다른 분류를 선택하거나 사진 분류를 변경해 주세요."
                />
              )}
            </>
          ) : (
            <Empty
              title="사진이 없습니다"
              message="완성된 공간의 변화를 기록해보세요."
            />
          )}
        </section>
      )}
      {SIMULATION_ENABLED && tab === "simulation" && (
        <SimulationWorkspace projectId={id} />
      )}
      {tab === "costs" && (
        <section className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [
                "최종 공사비",
                payments?.summary.final_total || 0,
                "공급가 " +
                  money(payments?.summary.final_supply || 0) +
                  " · 부가세 " +
                  money(payments?.summary.final_vat || 0),
              ],
              [
                "입금액",
                payments?.summary.paid_total || 0,
                "공급가 " +
                  money(payments?.summary.paid_supply || 0) +
                  " · 부가세 " +
                  money(payments?.summary.paid_vat || 0),
              ],
              [
                "미수금",
                payments?.summary.receivable_total || 0,
                "공급가 " +
                  money(payments?.summary.receivable_supply || 0) +
                  " · 부가세 " +
                  money(payments?.summary.receivable_vat || 0),
              ],
            ].map(([label, value, detail]) => (
              <div className="panel p-5" key={String(label)}>
                <p className="label">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-[#18372b]">
                  {money(Number(value))}
                </p>
                <p className="mt-2 text-xs text-[#829087]">{detail}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-x-6 gap-y-4 xl:grid-cols-2">
            <div className="panel overflow-hidden">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4ebe5] bg-[#f8faf8] p-5">
                  <div>
                    <h3 className="font-semibold text-[#294534]">
                      공사비 항목
                    </h3>
                    <p className="mt-1 text-xs text-[#8a968e]">
                      계약 견적서의 항목과 금액을 그대로 표시합니다.
                    </p>
                  </div>
                  {costs?.estimate && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-secondary shrink-0"
                        onClick={() =>
                          onOpenEstimate(
                            costs.estimate!.inquiry_id,
                            costs.estimate!.id,
                          )
                        }
                      >
                        {costs.estimate.version}차 견적서 보기
                        <ArrowUpRight size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn-primary shrink-0"
                        onClick={() =>
                          onCreateEstimateVersion(
                            costs.estimate!.inquiry_id,
                            costs.estimate!.id,
                            id,
                          )
                        }
                      >
                        <FilePlus2 size={16} /> 새 버전 작성
                      </button>
                    </div>
                  )}
                </div>
                {costs?.items.length ? (
                  <div className="space-y-2 bg-[#fbfcfb] p-3">
                    {costs.items.map((cost) => (
                      <div
                        key={cost.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-[#e0e8e2] border-l-4 border-l-[#5f8c6c] bg-[#f3f7f4] p-4 transition hover:border-[#cad8ce] hover:shadow-sm"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[15px] font-bold text-[#294534]">
                              {cost.name}
                            </p>
                          </div>
                          {(cost.specification || cost.unit) && (
                            <p className="mt-1 text-xs text-[#7a8780]">
                              {[cost.specification, cost.unit]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                          <p className="mt-1.5 text-xs text-[#66736b]">
                            공급가 {money(cost.supply_amount)} · 부가세{" "}
                            {money(cost.vat_amount)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-base font-bold text-[#18372b]">
                            {money(cost.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-10 text-center text-sm text-[#9aa49d]">
                    등록된 공사비가 없습니다.
                  </p>
                )}
              </div>
            </div>

            <div className="panel overflow-hidden">
              <div>
                <div className="border-b border-[#e1eae7] bg-[#f6faf8] p-5">
                  <h3 className="font-semibold text-[#294534]">입금 내역</h3>
                  <p className="mt-1 text-xs text-[#8a968e]">
                    실제 입금이 완료된 내역을 확인할 수 있습니다.
                  </p>
                </div>
                {paidPayments.length ? (
                  <div className="space-y-2 bg-[#fbfcfc] p-3">
                    {paidPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="rounded-xl border border-[#dce8e4] bg-[#f1f7f5] p-4 transition hover:border-[#c7d9d2] hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="inline-flex rounded-full bg-[#dcece5] px-2.5 py-1 text-xs font-bold text-[#315f48]">
                              {
                                {
                                  DEPOSIT: "계약금",
                                  INTERIM: "중도금",
                                  BALANCE: "잔금",
                                  LUMP_SUM: "일시불",
                                  OTHER: "기타",
                                }[payment.stage]
                              }
                            </span>
                            <p className="mt-2 text-xs font-semibold text-[#52675c]">
                              입금일 {shortDate(payment.paid_at)} ·{" "}
                              {
                                {
                                  BANK_TRANSFER: "계좌이체",
                                  CASH: "현금",
                                  CARD: "카드",
                                  OTHER: "기타",
                                }[payment.method]
                              }
                            </p>
                            <p className="mt-1 text-xs text-[#66736b]">
                              공급가 {money(payment.supply_amount)} · 부가세{" "}
                              {money(payment.vat_amount)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-base font-bold text-[#174433]">
                              {money(payment.total_amount)}
                            </p>
                            <button
                              className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[#a15151] transition hover:bg-[#f9e8e6]"
                              onClick={async () => {
                                await api.deletePayment(id, payment.id);
                                setPayments(await api.payments(id));
                                showSuccessToast("입금 내역을 삭제했습니다.");
                              }}
                            >
                              <Trash2 size={13} /> 삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-10 text-center text-sm text-[#9aa49d]">
                    등록된 입금 내역이 없습니다.
                  </p>
                )}
              </div>
              <form
                className="border-t border-[#e1eae7] bg-[#f8faf8] p-5"
                onSubmit={addPayment}
              >
                <h3 className="font-semibold text-[#294534]">입금 내역 추가</h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <DropdownSelect
                    value={paymentForm.stage}
                    options={paymentStageOptions}
                    ariaLabel="입금 단계"
                    onChange={(value) =>
                      setPaymentForm({
                        ...paymentForm,
                        stage: value as PaymentStage,
                      })
                    }
                  />
                  <DropdownSelect
                    value={paymentForm.method}
                    options={paymentMethodOptions}
                    ariaLabel="입금 방법"
                    onChange={(value) =>
                      setPaymentForm({
                        ...paymentForm,
                        method: value as PaymentMethod,
                      })
                    }
                  />
                  <div className="sm:col-span-2">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <label className="label mb-0" htmlFor="payment-amount">
                        입금액
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#496154]">
                        <input
                          className="h-4 w-4 accent-[#18372b]"
                          type="checkbox"
                          checked={useFullReceivable}
                          disabled={
                            (payments?.summary.receivable_total || 0) <= 0
                          }
                          onChange={(event) =>
                            setUseFullReceivable(event.target.checked)
                          }
                        />
                        미수금 전액
                        <span className="font-medium text-[#7d8981]">
                          {money(
                            Math.max(
                              payments?.summary.receivable_total || 0,
                              0,
                            ),
                          )}
                        </span>
                      </label>
                    </div>
                    <MoneyInput
                      id="payment-amount"
                      className="field disabled:bg-[#f3f6f3] disabled:text-[#345344]"
                      placeholder="입금액"
                      value={
                        useFullReceivable
                          ? Math.max(payments?.summary.receivable_total || 0, 0)
                          : paymentForm.supply_amount
                      }
                      onValueChange={(value) =>
                        setPaymentForm({
                          ...paymentForm,
                          supply_amount: value,
                        })
                      }
                      disabled={useFullReceivable}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="payment-date">
                      입금일
                    </label>
                    <input
                      id="payment-date"
                      className="field"
                      type="date"
                      onClick={showDatePicker}
                      value={paymentForm.paid_date}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          paid_date: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>
                <input
                  className="field mt-2"
                  placeholder="메모"
                  value={paymentForm.memo}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, memo: e.target.value })
                  }
                />
                <button className="btn-primary mt-4 w-full">
                  <Plus size={15} />
                  입금 내역 등록
                </button>
              </form>
            </div>
          </div>
        </section>
      )}
      {projectDeleteOpen && (
        <ConfirmModal
          title="현장을 삭제할까요?"
          description="삭제된 현장은 삭제된 현장 목록에서 다시 복원할 수 있습니다."
          confirmLabel={deletingProject ? "삭제 중…" : "삭제"}
          busy={deletingProject}
          tone="danger"
          onClose={() => setProjectDeleteOpen(false)}
          onConfirm={deleteProject}
        />
      )}
      {imageToDelete && (
        <ConfirmModal
          title="사진을 삭제할까요?"
          description="삭제한 사진은 현장 사진과 공개 포트폴리오에서 더 이상 표시되지 않습니다."
          confirmLabel={deletingImage ? "삭제 중…" : "삭제"}
          busy={deletingImage}
          tone="danger"
          onClose={() => setImageToDelete(null)}
          onConfirm={deleteSelectedImage}
        />
      )}
    </div>
  );
}

function MapPage({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [mappedProjects, setMappedProjects] = useState<ProjectListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .projects(`?page=${page}&page_size=6`)
      .then((result) => {
        setProjects(result.items);
        setTotal(result.total);
      })
      .catch((e) => {
        setProjects([]);
        setTotal(0);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [page]);
  useEffect(() => {
    let active = true;
    const loadAllMappedProjects = async () => {
      setMapError("");
      try {
        const firstPage = await api.projects("?page=1&page_size=100");
        const pageCount = Math.ceil(firstPage.total / firstPage.page_size);
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(pageCount - 1, 0) }, (_, index) =>
            api.projects(`?page=${index + 2}&page_size=100`),
          ),
        );
        if (!active) return;
        setMappedProjects(
          [firstPage, ...remainingPages]
            .flatMap((result) => result.items)
            .filter(
              (project) =>
                project.latitude != null && project.longitude != null,
            ),
        );
      } catch {
        if (active) {
          setMappedProjects([]);
          setMapError("전체 현장의 지도 정보를 불러오지 못했습니다.");
        }
      }
    };
    void loadAllMappedProjects();
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="grid gap-4 p-4 sm:gap-5 sm:p-6 lg:h-[calc(100dvh-81px)] lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden xl:h-[calc(100dvh-89px)] xl:p-8">
      <NaverMap
        className="h-[48dvh] min-h-[320px] overflow-hidden rounded-[20px] border border-[#e2e8e2] bg-[#edf2ed] sm:h-auto sm:min-h-[480px] sm:rounded-[24px] lg:h-full lg:min-h-0"
        markers={mappedProjects.map((project) => ({
          id: project.id,
          latitude: Number(project.latitude),
          longitude: Number(project.longitude),
          title: project.title,
          address: project.address,
        }))}
      />
      <section className="panel flex min-h-0 flex-col overflow-hidden border-2 !border-[#afc0b3] shadow-[0_10px_28px_rgba(24,55,43,.14)]">
        <div className="border-b-2 border-[#294a39] bg-[#294a39] px-4 py-3.5 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <MapPin size={18} className="shrink-0 text-[#c8ddce]" />
              <h2 className="font-semibold">지도에 표시된 현장</h2>
            </div>
            <span className="shrink-0 text-xs font-medium text-[#c8ddce]">
              현재 {mappedProjects.length}곳 표시
            </span>
          </div>
          {mapError && (
            <p className="mt-1.5 text-xs text-rose-200">{mapError}</p>
          )}
        </div>
        {error ? (
          <p className="flex-1 p-5 text-sm text-[#a14e4e]">{error}</p>
        ) : (
          <div className="min-h-0 flex-1 divide-y-2 divide-[#bccac0] overflow-y-auto">
            {projects.map((project) => (
              <button
                key={project.id}
                className="block w-full p-4 text-left hover:bg-[#f6f8f6]"
                onClick={() => onOpen(project.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <b className="text-sm text-[#345344]">{project.title}</b>
                  <Badge status={project.status} />
                </div>
                <p className="mt-1 text-xs text-[#8a968e]">{project.address}</p>
                {project.latitude == null && (
                  <p className="mt-1 text-[11px] text-[#b07855]">
                    지도에서 위치 등록 필요
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
        {!error && (
          <div className="border-t-2 border-[#bccac0] px-2">
            <Pagination
              page={page}
              pageSize={6}
              total={total}
              loading={loading}
              onPageChange={setPage}
            />
          </div>
        )}
      </section>
    </div>
  );
}

const ADMIN_PROJECT_UUID =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";
const adminProjectPattern = new RegExp(
  `^/admin/projects/(${ADMIN_PROJECT_UUID})/?$`,
);

type AdminRoute = {
  page: string;
  projectId: string | null;
  projectTab?: "photos";
  inquiryId?: string;
  estimateId?: string;
  startNewVersion?: boolean;
  applyProjectId?: string;
};

function adminRoute(pathname: string, search = ""): AdminRoute {
  const projectId = pathname.match(adminProjectPattern)?.[1] || null;
  if (projectId)
    return {
      page: "detail",
      projectId,
      projectTab:
        new URLSearchParams(search).get("tab") === "photos"
          ? "photos"
          : undefined,
    };
  if (/^\/admin\/projects\/new\/?$/.test(pathname))
    return { page: "new-project", projectId: null };
  if (/^\/admin\/projects\/?$/.test(pathname))
    return { page: "projects", projectId: null };
  if (/^\/admin\/estimates\/?$/.test(pathname)) {
    const params = new URLSearchParams(search);
    return {
      page: "estimates",
      projectId: null,
      inquiryId: params.get("inquiry") || undefined,
      estimateId: params.get("estimate") || undefined,
      startNewVersion: params.get("action") === "new-version",
      applyProjectId: params.get("applyProject") || undefined,
    };
  }
  if (/^\/admin\/photos\/?$/.test(pathname))
    return { page: "photos", projectId: null };
  if (/^\/admin\/map\/?$/.test(pathname))
    return { page: "map", projectId: null };
  if (/^\/admin\/management\/?$/.test(pathname))
    return { page: "management", projectId: null };
  if (/^\/admin\/settings\/?$/.test(pathname))
    return { page: "settings", projectId: null };
  return { page: "dashboard", projectId: null };
}

function adminPath(page: string, projectId?: string | null) {
  if (page === "projects") return "/admin/projects";
  if (page === "new-project") return "/admin/projects/new";
  if (page === "detail" && projectId) return `/admin/projects/${projectId}`;
  if (page === "estimates") return "/admin/estimates";
  if (page === "photos") return "/admin/photos";
  if (page === "map") return "/admin/map";
  if (page === "management") return "/admin/management";
  if (page === "settings") return "/admin/settings";
  return "/admin";
}

function AdminApp() {
  const initialRoute = adminRoute(
    window.location.pathname,
    window.location.search,
  );
  const [authenticated, setAuthenticated] = useState(
    Boolean(localStorage.getItem("interior_token")),
  );
  const [page, setPage] = useState(initialRoute.page);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRoute.projectId,
  );
  const [selectedProjectTab, setSelectedProjectTab] = useState<
    "photos" | undefined
  >(initialRoute.projectTab);
  const [selectedInquiryId, setSelectedInquiryId] = useState<
    string | undefined
  >(initialRoute.inquiryId);
  const [selectedEstimateId, setSelectedEstimateId] = useState<
    string | undefined
  >(initialRoute.estimateId);
  const [startNewEstimateVersion, setStartNewEstimateVersion] = useState(
    Boolean(initialRoute.startNewVersion),
  );
  const [estimateApplyProjectId, setEstimateApplyProjectId] = useState<
    string | undefined
  >(initialRoute.applyProjectId);
  const [formProject, setFormProject] = useState<Project | undefined>();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigateAdmin = (nextPage: string, projectId?: string | null) => {
    setPage(nextPage);
    setSelectedId(projectId || null);
    setSelectedProjectTab(undefined);
    setSelectedInquiryId(undefined);
    setSelectedEstimateId(undefined);
    setStartNewEstimateVersion(false);
    setEstimateApplyProjectId(undefined);
    setFormProject(undefined);
    history.pushState({}, "", adminPath(nextPage, projectId));
  };
  const openProjectPhotos = (projectId: string) => {
    setPage("detail");
    setSelectedId(projectId);
    setSelectedProjectTab("photos");
    setFormProject(undefined);
    history.pushState({}, "", `${adminPath("detail", projectId)}?tab=photos`);
  };
  const openInquiry = (inquiryId: string) => {
    setPage("estimates");
    setSelectedId(null);
    setSelectedProjectTab(undefined);
    setSelectedInquiryId(inquiryId);
    setSelectedEstimateId(undefined);
    setStartNewEstimateVersion(false);
    setEstimateApplyProjectId(undefined);
    setFormProject(undefined);
    history.pushState(
      {},
      "",
      `/admin/estimates?inquiry=${encodeURIComponent(inquiryId)}`,
    );
  };
  const openEstimate = (
    inquiryId: string,
    estimateId: string,
    options?: { newVersion?: boolean; applyProjectId?: string },
  ) => {
    setPage("estimates");
    setSelectedId(null);
    setSelectedProjectTab(undefined);
    setSelectedInquiryId(inquiryId);
    setSelectedEstimateId(estimateId);
    setStartNewEstimateVersion(Boolean(options?.newVersion));
    setEstimateApplyProjectId(options?.applyProjectId);
    setFormProject(undefined);
    const params = new URLSearchParams({
      inquiry: inquiryId,
      estimate: estimateId,
    });
    if (options?.newVersion) params.set("action", "new-version");
    if (options?.applyProjectId)
      params.set("applyProject", options.applyProjectId);
    history.pushState({}, "", `/admin/estimates?${params.toString()}`);
  };
  useEffect(() => {
    const handleAuthExpired = () => {
      setAuthenticated(false);
      setPage("dashboard");
      setSelectedId(null);
      setSelectedProjectTab(undefined);
      setSelectedInquiryId(undefined);
      setSelectedEstimateId(undefined);
      setStartNewEstimateVersion(false);
      setEstimateApplyProjectId(undefined);
      setFormProject(undefined);
      history.replaceState({}, "", "/admin");
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () =>
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);
  useEffect(() => {
    const onPopState = () => {
      const route = adminRoute(
        window.location.pathname,
        window.location.search,
      );
      setPage(route.page);
      setSelectedId(route.projectId);
      setSelectedProjectTab(route.projectTab);
      setSelectedInquiryId(route.inquiryId);
      setSelectedEstimateId(route.estimateId);
      setStartNewEstimateVersion(Boolean(route.startNewVersion));
      setEstimateApplyProjectId(route.applyProjectId);
      setFormProject(undefined);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  if (!authenticated)
    return (
      <Login
        onLogin={() => {
          setAuthenticated(true);
          if (/^\/admin\/login\/?$/.test(window.location.pathname)) {
            setPage("dashboard");
            setSelectedId(null);
            setSelectedProjectTab(undefined);
            setSelectedInquiryId(undefined);
            setSelectedEstimateId(undefined);
            setStartNewEstimateVersion(false);
            setEstimateApplyProjectId(undefined);
            history.replaceState({}, "", "/admin");
          }
        }}
      />
    );
  let content: ReactNode;
  let title = "대시보드";
  if (formProject !== undefined || page === "new-project") {
    title = formProject ? "현장 정보 수정" : "새 현장 등록";
    content = (
      <ProjectForm
        project={formProject}
        onDone={(p) => {
          navigateAdmin("detail", p.id);
        }}
        onCancel={() => {
          navigateAdmin("projects");
        }}
      />
    );
  } else if (selectedId && page === "detail") {
    title = "현장 상세";
    content = (
      <DetailPage
        id={selectedId}
        initialTab={selectedProjectTab}
        onBack={() =>
          navigateAdmin(selectedProjectTab === "photos" ? "photos" : "projects")
        }
        onEdit={(p) => setFormProject(p)}
        onDeleted={() => navigateAdmin("projects")}
        onOpenEstimate={openEstimate}
        onCreateEstimateVersion={(inquiryId, estimateId, projectId) =>
          openEstimate(inquiryId, estimateId, {
            newVersion: true,
            applyProjectId: projectId,
          })
        }
      />
    );
  } else if (page === "projects") {
    title = "전체 현장";
    content = (
      <ProjectsPage
        onOpen={(id) => navigateAdmin("detail", id)}
        onCreate={() => navigateAdmin("new-project")}
      />
    );
  } else if (page === "estimates") {
    title = "견적·상담 관리";
    content = (
      <EstimateInquiriesPage
        onOpenProject={(id) => navigateAdmin("detail", id)}
        initialInquiryId={selectedInquiryId}
        initialEstimateId={selectedEstimateId}
        startNewVersion={startNewEstimateVersion}
        applyProjectId={estimateApplyProjectId}
      />
    );
  } else if (page === "photos") {
    title = "사진 관리";
    content = (
      <PhotoLibrary
        onOpenProject={(id) => navigateAdmin("detail", id)}
        onOpenProjectPhotos={openProjectPhotos}
      />
    );
  } else if (page === "map") {
    title = "현장 지도";
    content = <MapPage onOpen={(id) => navigateAdmin("detail", id)} />;
  } else if (page === "management") {
    title = "경영 현황";
    content = (
      <ManagementOverviewPage
        onOpenProject={(id) => navigateAdmin("detail", id)}
      />
    );
  } else if (page === "settings") {
    title = "업체 설정";
    content = <CompanySettingsPage />;
  } else {
    content = (
      <DashboardPage
        onOpenProject={(id) => navigateAdmin("detail", id)}
        onOpenInquiry={openInquiry}
      />
    );
  }
  return (
    <div className="flex min-h-screen bg-[#f6f7f8]">
      <Sidebar
        page={
          page === "detail"
            ? selectedProjectTab === "photos"
              ? "photos"
              : "projects"
            : page
        }
        setPage={(p) => navigateAdmin(p)}
        onLogout={() => {
          localStorage.removeItem("interior_token");
          setAuthenticated(false);
          history.replaceState({}, "", "/admin/login");
        }}
        mobileOpen={mobileOpen}
        closeMobile={() => setMobileOpen(false)}
      />
      <main className="mobile-bottom-safe min-w-0 flex-1">
        <Header title={title} onMenu={() => setMobileOpen(true)} />
        {content}
      </main>
      <MobileBottomNav
        page={
          page === "detail"
            ? selectedProjectTab === "photos"
              ? "photos"
              : "projects"
            : page
        }
        setPage={(p) => navigateAdmin(p)}
      />
    </div>
  );
}

function Redirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return null;
}

function App() {
  const pathname = window.location.pathname;
  const isPublicProject = new RegExp(
    `^/projects/${ADMIN_PROJECT_UUID}/?$`,
  ).test(pathname);
  if (pathname === "/") return <Redirect to="/admin" />;
  if (/^\/projects\/?$/.test(pathname) || isPublicProject)
    return <PublicPortfolio />;
  if (/^\/projects(?:\/|$)/.test(pathname)) return <Redirect to="/projects" />;
  if (/^\/portfolio(?:\/|$)/.test(pathname)) {
    const legacyId = pathname.match(/^\/portfolio\/([^/]+)\/?$/)?.[1];
    const validId = legacyId?.match(new RegExp(`^${ADMIN_PROJECT_UUID}$`));
    return <Redirect to={validId ? `/projects/${legacyId}` : "/projects"} />;
  }
  if (/^\/admin(?:\/|$)/.test(pathname)) return <AdminApp />;
  return <Redirect to="/" />;
}

export default App;
