import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Archive,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Clock3,
  FolderKanban,
  House,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import { api, mediaUrl } from "./api";
import type {
  Cost,
  Dashboard,
  Image,
  ImageCategory,
  Project,
  ProjectListItem,
  ProjectStatus,
  Payment,
  PaymentMethod,
  PaymentStage,
  PaymentStatus,
  PaymentSummary,
  CostSummary,
  GeocodeResult,
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

const statusLabels: Record<ProjectStatus, string> = {
  PLANNING: "예정",
  IN_PROGRESS: "공사 중",
  COMPLETED: "완료",
  ON_HOLD: "보류",
  CANCELLED: "취소",
};
const statusStyles: Record<ProjectStatus, string> = {
  PLANNING: "bg-[#f1f2ed] text-[#758078]",
  IN_PROGRESS: "bg-[#fff1df] text-[#a76016]",
  COMPLETED: "bg-[#e6f4ea] text-[#2f7d4c]",
  ON_HOLD: "bg-[#fff4df] text-[#a66c1f]",
  CANCELLED: "bg-[#fdecec] text-[#a65c5c]",
};
const statusDots: Record<ProjectStatus, string> = {
  PLANNING: "bg-[#9aa49d]",
  IN_PROGRESS: "bg-[#df8728]",
  COMPLETED: "bg-[#3d985d]",
  ON_HOLD: "bg-[#d89a43]",
  CANCELLED: "bg-[#c96f6f]",
};
const projectStatusOptions = Object.keys(statusLabels) as ProjectStatus[];
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
  { value: "OTHER", label: "기타" },
];
const paymentMethodOptions: DropdownOption[] = [
  { value: "BANK_TRANSFER", label: "계좌이체" },
  { value: "CASH", label: "현금" },
  { value: "CARD", label: "카드" },
  { value: "OTHER", label: "기타" },
];
const paymentStatusOptions: DropdownOption[] = [
  { value: "SCHEDULED", label: "입금 예정", dotClass: "bg-blue-500" },
  { value: "PAID", label: "입금 완료", dotClass: "bg-emerald-500" },
  { value: "CANCELLED", label: "취소", dotClass: "bg-slate-400" },
  { value: "REFUNDED", label: "환불", dotClass: "bg-rose-500" },
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

function Badge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}
    >
      {statusLabels[status]}
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
  const [rememberLoginId, setRememberLoginId] = useState(
    () => Boolean(localStorage.getItem("interior_login_id")),
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
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-[0_30px_100px_rgba(26,55,40,.16)] md:grid-cols-[1fr_410px]">
        <div className="relative hidden min-h-[600px] overflow-hidden bg-[#17372b] p-12 text-white md:block">
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
    { id: "map", label: "현장 지도", icon: MapPin },
  ];
  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-[#17372b] px-5 py-7 text-white transition-transform lg:static lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#b5d1b9]">
              Jeil Interior
            </p>
            <p className="serif mt-1 text-xl">Studio desk</p>
          </div>
          <button className="lg:hidden" onClick={closeMobile}>
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
          className="absolute bottom-7 left-8 flex items-center gap-3 text-sm text-[#aec7b5] hover:text-white"
        >
          <LogOut size={17} />
          로그아웃
        </button>
      </aside>
      {mobileOpen && (
        <button
          aria-label="메뉴 닫기"
          className="fixed inset-0 z-20 bg-[#10261c]/45 lg:hidden"
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
            className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold ${active ? "text-[#2f7a4b]" : "text-[#9aa3ab]"}`}
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
    <header className="flex items-center justify-between border-b border-[#e6eae5] bg-white px-5 py-4 sm:px-8">
      <div className="flex items-center gap-3">
        <button
          className="rounded-lg p-1 text-[#54705e] lg:hidden"
          onClick={onMenu}
        >
          <Menu size={21} />
        </button>
        <div>
          <p className="text-xs font-semibold text-[#91a097]">현장 관리</p>
          <h1 className="serif mt-0.5 text-2xl text-[#1d3328]">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-xs font-semibold text-[#304a3a]">관리자 계정</p>
          <p className="text-[11px] text-[#91a097]">
            오늘도 좋은 공간을 만드세요
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dcecdf] text-sm font-bold text-[#365943]">
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
}: {
  label: string;
  value: string | number;
  tone: string;
  icon: typeof House;
}) {
  return (
    <div className="panel relative overflow-hidden p-5">
      <div className={`mb-5 inline-flex rounded-xl p-2.5 ${tone}`}>
        <Icon size={18} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#87938b]">
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-[#18372b]">
        {value}
      </p>
    </div>
  );
}

function DashboardPage({
  data,
  onProjects,
  onOpen,
}: {
  data: Dashboard | null;
  onProjects: () => void;
  onOpen: (id: string) => void;
}) {
  const [recent, setRecent] = useState<ProjectListItem[]>([]);
  useEffect(() => {
    api
      .projects("page_size=5&sort=created_at")
      .then((result) => setRecent(result.items))
      .catch(() => {});
  }, []);
  if (!data)
    return (
      <div className="p-8 text-sm text-[#7d8981]">
        대시보드를 불러오는 중입니다…
      </div>
    );
  return (
    <div className="space-y-7 p-5 sm:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-[#758078]">좋은 아침입니다, 관리자님.</p>
          <h2 className="serif mt-1 text-3xl text-[#1b3025]">
            오늘의 현장을
            <br />
            <span className="text-[#64846c]">한눈에 확인하세요.</span>
          </h2>
        </div>
        <button
          className="btn-primary self-start sm:self-auto"
          onClick={onProjects}
        >
          <Plus size={17} />새 현장 등록
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="전체 현장"
          value={data.total}
          tone="bg-[#e8f2e8] text-[#477653]"
          icon={FolderKanban}
        />
        <StatCard
          label="공사 진행 중"
          value={data.in_progress}
          tone="bg-[#fff3dd] text-[#a0712c]"
          icon={Clock3}
        />
        <StatCard
          label="완료 현장"
          value={data.completed}
          tone="bg-[#eef0fb] text-[#6172ae]"
          icon={CheckCircle2}
        />
        <StatCard
          label="계약 금액"
          value={money(data.total_contract)}
          tone="bg-[#f5eaf0] text-[#9a5970]"
          icon={WalletCards}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#87938b]">
                등록일 기준
              </p>
              <h3 className="serif mt-1 text-xl text-[#20362b]">
                최근 등록한 현장
              </h3>
            </div>
            <button
              className="rounded-lg border border-[#d7e1d8] bg-white px-4 py-2 text-xs font-semibold text-[#56805f] transition hover:border-[#aec2b1] hover:bg-[#f5f8f5]"
              onClick={onProjects}
            >
              모두 보기
            </button>
          </div>
          <div className="mt-5 divide-y divide-[#eef1ed]">
            {recent.length ? (
              recent.map((project) => (
                <button
                  key={project.id}
                  onClick={() => onOpen(project.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[#edf5ef]"
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#edf2ed]">
                    {project.cover_image ? (
                      <img
                        src={mediaUrl(project.cover_image.thumbnail_url)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[#9bad9f]">
                        <ImageIcon size={17} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#2b4736]">
                      {project.title}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[#98a39b]">
                      <MapPin size={12} />
                      {project.address}
                    </p>
                  </div>
                  <Badge status={project.status} />
                </button>
              ))
            ) : (
              <p className="py-10 text-center text-sm text-[#9aa49d]">
                아직 등록된 현장이 없습니다.
              </p>
            )}
          </div>
        </div>
        <div className="panel overflow-hidden bg-[#e8f0e7] p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#63816b]">
                한눈에 보기
              </p>
              <h3 className="serif mt-2 text-2xl leading-tight text-[#244630]">
                완료한 현장을
                <br />
                사례로 남겨보세요.
              </h3>
            </div>
            <ArrowUpRight className="text-[#62866b]" />
          </div>
          <p className="mt-5 text-sm leading-6 text-[#64806b]">
            대표 사진과 이야기를 공개 사례로 설정하면 새로운 고객에게 작업을
            보여줄 수 있습니다.
          </p>
          <button
            className="mt-7 rounded-xl bg-[#294c35] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1e3b29]"
            onClick={onProjects}
          >
            현장 관리 열기
          </button>
        </div>
      </div>
    </div>
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
      <div className="relative h-48 bg-[#edf2ed]">
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
        <div className="absolute left-4 top-4">
          <Badge status={project.status} />
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
        <button type="button" className="block w-full text-left" onClick={onOpen}>
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
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const load = () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page_size: "50" });
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    if (showArchived) params.set("archived", "true");
    api
      .projects(`?${params}`)
      .then((r) => setItems(r.items))
      .catch((caught) => {
        setItems([]);
        setError(
          caught instanceof Error ? caught.message : "현장 목록을 불러오지 못했습니다.",
        );
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [query, status, showArchived]);
  const restoreProject = async (id: string) => {
    setRestoringId(id);
    setError("");
    try {
      await api.restoreProject(id);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "현장을 복원하지 못했습니다.");
    } finally {
      setRestoringId(null);
    }
  };
  return (
    <div className="space-y-6 p-5 sm:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-[#758078]">
            {showArchived ? "보관된 프로젝트를 관리합니다" : "모든 프로젝트를 한곳에서"}
          </p>
          <h2 className="serif mt-1 text-3xl text-[#1b3025]">
            {showArchived ? "현장 보관함" : "전체 현장"}
          </h2>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setShowArchived((current) => !current);
              setError("");
            }}
          >
            {showArchived ? <FolderKanban size={17} /> : <Archive size={17} />}
            {showArchived ? "전체 현장" : "보관함"}
          </button>
          {!showArchived && (
            <button className="btn-primary" onClick={onCreate}>
              <Plus size={17} />새 현장 등록
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute left-3.5 top-3.5 text-[#9aa49d]"
          />
          <input
            className="field pl-10"
            placeholder="현장명, 주소, 고객명 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <DropdownSelect
          className="sm:w-44"
          value={status}
          options={projectStatusFilterOptions}
          onChange={setStatus}
          ariaLabel="현장 상태 필터"
        />
      </div>
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
      ) : (
        <Empty
          title={showArchived ? "보관된 현장이 없습니다" : "등록된 현장이 없습니다"}
          message={
            showArchived
              ? "보관 처리한 현장이 이곳에 표시됩니다."
              : "첫 번째 프로젝트를 등록하고 사진과 공사비를 기록해보세요."
          }
          action={!showArchived ? (
            <button className="btn-primary" onClick={onCreate}>
              <Plus size={16} />
              현장 등록하기
            </button>
          ) : undefined}
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#10261c]/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="지도에서 위치 선택"
    >
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#e5eae5] px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-xl font-bold text-[#20392c]">
              지도에서 위치 선택
            </h3>
            <p className="mt-1 text-sm text-[#7a877e]">
              지도를 이동·확대한 뒤 등록할 건물이나 도로를 클릭하세요.
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl p-2 text-[#6e7b73] hover:bg-[#f1f4f1]"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>
        <div className="relative">
          <NaverMap
            className="h-[430px] w-full bg-[#edf2ed] sm:h-[520px]"
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
      </div>
    </div>
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
          status: "PLANNING",
          address: "",
          address_detail: "",
          is_public: false,
          housing_type: "",
          area_pyeong: "",
          planned_start_date: "",
          planned_end_date: "",
          description: "",
        },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[]>([]);
  const [geocodeMessage, setGeocodeMessage] = useState("");
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const set = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
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
      onDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };
  const searchAddress = async () => {
    const query = String(form.address || "").trim();
    if (!query) {
      setGeocodeMessage("검색할 주소를 입력해 주세요.");
      return;
    }
    setGeocoding(true);
    setError("");
    setGeocodeMessage("");
    try {
      const results = await api.geocode(query);
      setGeocodeResults(results);
      if (!results.length)
        setGeocodeMessage(
          "검색 결과가 없습니다. 도로명이나 지번 주소로 다시 검색해 주세요.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "주소 검색에 실패했습니다.");
    } finally {
      setGeocoding(false);
    }
  };
  const chooseAddress = (result: GeocodeResult) => {
    setForm((prev) => ({
      ...prev,
      address: result.road_address || result.jibun_address || "",
      latitude: result.latitude,
      longitude: result.longitude,
    }));
    setGeocodeResults([]);
    setGeocodeMessage("");
  };
  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8">
      <button
        className="mb-5 flex items-center gap-1 text-sm font-semibold text-[#68806f]"
        onClick={onCancel}
      >
        <ChevronLeft size={17} />
        현장 목록으로
      </button>
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#91a097]">
          Project details
        </p>
        <h2 className="serif mt-1 text-3xl text-[#1b3025]">
          {project ? "현장 정보 수정" : "새 현장 등록"}
        </h2>
      </div>
      <form onSubmit={submit} className="space-y-6">
        <section className="panel p-5 sm:p-7">
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
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
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
                    setGeocodeResults([]);
                    setGeocodeMessage("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void searchAddress();
                    }
                  }}
                  required
                  placeholder="도로명 주소를 입력하세요"
                />
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  onClick={searchAddress}
                  disabled={geocoding}
                >
                  <Search size={15} /> {geocoding ? "검색 중" : "주소 검색"}
                </button>
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  onClick={() => setMapPickerOpen(true)}
                >
                  <MapPin size={15} /> 지도에서 선택
                </button>
              </div>
              {geocodeResults.length > 0 && (
                <div className="mt-2 overflow-hidden rounded-xl border border-[#dfe6df] bg-white">
                  {geocodeResults.map((result) => (
                    <button
                      type="button"
                      key={`${result.latitude}-${result.longitude}`}
                      className="block w-full border-b border-[#edf0ec] px-4 py-3 text-left text-sm text-[#42584a] last:border-0 hover:bg-[#f5f8f5]"
                      onClick={() => chooseAddress(result)}
                    >
                      {result.road_address || result.jibun_address}
                    </button>
                  ))}
                </div>
              )}
              {geocodeMessage && (
                <p className="mt-2 text-xs text-[#8a968e]">{geocodeMessage}</p>
              )}
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
                onChange={(e) => set("planned_start_date", e.target.value)}
              />
            </div>
            <div>
              <label className="label">공사 완료 예정일</label>
              <input
                className="field"
                type="date"
                onClick={showDatePicker}
                value={String(form.planned_end_date || "")}
                onChange={(e) => set("planned_end_date", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">공사 범위</label>
              <textarea
                className="field min-h-28 resize-y"
                value={String(form.description || "")}
                onChange={(e) => set("description", e.target.value)}
                placeholder="공사할 공간과 작업 내용을 입력해 주세요."
              />
            </div>
          </div>
        </section>
        {error && (
          <p className="rounded-xl bg-[#fff0ef] px-4 py-3 text-sm text-[#a14e4e]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
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
            setGeocodeResults([]);
            setGeocodeMessage("");
            setMapPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function DetailPage({
  id,
  onBack,
  onEdit,
  onDeleted,
}: {
  id: string;
  onBack: () => void;
  onEdit: (project: Project) => void;
  onDeleted: () => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [costs, setCosts] = useState<{
    items: Cost[];
    summary: CostSummary;
  } | null>(null);
  const [payments, setPayments] = useState<{
    items: Payment[];
    summary: PaymentSummary;
  } | null>(null);
  const [tab, setTab] = useState<
    "overview" | "photos" | "simulation" | "costs"
  >("overview");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<Image | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);
  const [costForm, setCostForm] = useState({
    name: "",
    supply_amount: "",
    vat_amount: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    stage: "DEPOSIT" as PaymentStage,
    method: "BANK_TRANSFER" as PaymentMethod,
    status: "SCHEDULED" as PaymentStatus,
    supply_amount: "",
    due_date: "",
    memo: "",
  });
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
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadImage(
        id,
        file,
        project?.status === "COMPLETED" ? "AFTER" : "PROGRESS",
        !project?.images.some((i) => i.is_cover),
        Boolean(project?.is_public),
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };
  const addCost = async (event: FormEvent) => {
    event.preventDefault();
    if (!costForm.name || !costForm.supply_amount) return;
    await api.createCost(id, {
      ...costForm,
      item_type: "CONTRACT",
      category: "OTHER",
      supply_amount: Number(costForm.supply_amount),
      vat_amount: Number(costForm.vat_amount || 0),
    });
    setCostForm({ ...costForm, name: "", supply_amount: "", vat_amount: "" });
    const result = await api.costs(id);
    setCosts(result);
    setPayments(await api.payments(id));
  };
  const addPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!paymentForm.supply_amount) return;
    await api.createPayment(id, {
      ...paymentForm,
      supply_amount: Number(paymentForm.supply_amount),
      vat_amount: 0,
      due_date: paymentForm.due_date || null,
      paid_at: paymentForm.status === "PAID" ? new Date().toISOString() : null,
    });
    setPaymentForm({
      ...paymentForm,
      supply_amount: "",
      memo: "",
    });
    setPayments(await api.payments(id));
  };
  const deleteProject = async () => {
    if (!confirm("이 현장을 보관 처리할까요?")) return;
    await api.deleteProject(id);
    onDeleted();
  };
  const deleteSelectedImage = async () => {
    if (!imageToDelete) return;
    setDeletingImage(true);
    setError("");
    try {
      await api.deleteImage(id, imageToDelete.id);
      setImageToDelete(null);
      load();
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
  return (
    <div className="space-y-6 p-5 sm:p-8">
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
            <h2 className="serif text-3xl text-[#1b3025]">{project.title}</h2>
            <Badge status={project.status} />
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
            onClick={deleteProject}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="flex gap-1 border-b border-[#e6eae5]">
        {[
          ["overview", "현장 개요"],
          ["photos", `사진 ${project.images.length}`],
          ["simulation", "2D·3D 시뮬레이션"],
          ["costs", "공사비·입금"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === key ? "border-[#3d7650] text-[#315f40]" : "border-transparent text-[#9aa49d] hover:text-[#577060]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <section className="panel p-5 sm:p-7">
            <h3 className="font-semibold text-[#294534]">현장 정보</h3>
            <div className="mt-5 grid grid-cols-2 gap-y-6 text-sm">
              <div>
                <p className="label">상태</p>
                <Badge status={project.status} />
              </div>
              <div>
                <p className="label">면적</p>
                <p className="font-semibold text-[#345344]">
                  {project.area_pyeong
                    ? `${Math.round(Number(project.area_pyeong))}평`
                    : "미등록"}
                </p>
              </div>
              <div>
                <p className="label">공사 기간</p>
                <p className="font-semibold text-[#345344]">
                  {fullDate(project.planned_start_date)} ~{" "}
                  {fullDate(
                    project.actual_end_date || project.planned_end_date,
                  )}
                </p>
              </div>
              <div>
                <p className="label">주거 유형</p>
                <p className="font-semibold text-[#345344]">
                  {project.housing_type || "미등록"}
                </p>
              </div>
            </div>
            <div className="mt-7 border-t border-[#edf0ec] pt-5">
              <p className="label">공사 범위 / 메모</p>
              <p className="whitespace-pre-wrap text-sm leading-7 text-[#68766d]">
                {project.description || "등록된 메모가 없습니다."}
              </p>
            </div>
          </section>
          <section className="panel overflow-hidden">
            <div className="flex h-64 items-center justify-center bg-[#edf2ed]">
              {project.images.find((i) => i.is_cover) ? (
                <img
                  src={mediaUrl(
                    project.images.find((i) => i.is_cover)?.thumbnail_url,
                  )}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-center text-[#9baa9e]">
                  <ImageIcon className="mx-auto mb-2" size={28} />
                  <p className="text-xs">대표 사진을 등록해주세요</p>
                </div>
              )}
            </div>
            <div className="p-5">
              <p className="label">공개 공사 범위</p>
              <p className="text-sm leading-6 text-[#68766d]">
                {project.description || "아직 등록된 공사 범위가 없습니다."}
              </p>
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
            <label className="btn-primary cursor-pointer">
              <Upload size={16} />
              {uploading ? "업로드 중…" : "사진 업로드"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={upload}
                disabled={uploading}
              />
            </label>
          </div>
          {error && (
            <p className="rounded-xl bg-[#fff0ef] px-4 py-3 text-sm text-[#a14e4e]">
              {error}
            </p>
          )}
          {project.images.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {project.images.map((image) => (
                <div
                  key={image.id}
                  className="group relative aspect-square overflow-hidden rounded-2xl bg-[#edf2ed]"
                >
                  <img
                    src={mediaUrl(image.thumbnail_url)}
                    className="h-full w-full object-cover"
                  />
                  {image.is_cover && (
                    <span className="absolute bottom-3 right-3 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-[#355d40] shadow-sm">
                      대표
                    </span>
                  )}
                  <button
                    className="absolute right-2 top-2 rounded-lg bg-black/35 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                    onClick={() => setImageToDelete(image)}
                    aria-label="사진 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                  <div className="absolute left-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${image.is_public ? "bg-[#3d7650] text-white" : "bg-white/90 text-[#355d40]"}`}
                      onClick={async () => {
                        await api.updateImage(id, image.id, {
                          is_public: !image.is_public,
                        });
                        load();
                      }}
                    >
                      {image.is_public ? "공개" : "비공개"}
                    </button>
                    {!image.is_cover && (
                      <button
                        className="rounded-lg bg-white/90 px-2 py-1 text-[10px] font-semibold text-[#355d40]"
                        onClick={async () => {
                          await api.updateImage(id, image.id, {
                            is_cover: true,
                          });
                          load();
                        }}
                      >
                        대표 지정
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="사진이 없습니다"
              message="완성된 공간의 변화를 기록해보세요."
            />
          )}
        </section>
      )}
      {tab === "simulation" && <SimulationWorkspace projectId={id} />}
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
            <div className="grid gap-4 xl:row-span-2 xl:grid-rows-subgrid">
              <div className="panel overflow-hidden">
                <div className="border-b border-[#edf0ec] p-5">
                  <h3 className="font-semibold text-[#294534]">공사비 항목</h3>
                  <p className="mt-1 text-xs text-[#8a968e]">
                    계약 + 추가 - 할인으로 최종 공사비가 계산됩니다.
                  </p>
                </div>
                {costs?.items.length ? (
                  <div className="divide-y divide-[#edf0ec]">
                    {costs.items.map((cost) => (
                      <div
                        key={cost.id}
                        className="flex items-center justify-between gap-4 p-5"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#345344]">
                            {cost.name}
                          </p>
                          <p className="mt-1 text-xs text-[#9aa49d]">
                            공급가 {money(cost.supply_amount)} · 부가세{" "}
                            {money(cost.vat_amount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-[#345344]">
                            {money(cost.amount)}
                          </p>
                          <button
                            className="mt-1 text-[11px] text-[#a75d5d]"
                            onClick={async () => {
                              await api.deleteCost(id, cost.id);
                              setCosts(await api.costs(id));
                              setPayments(await api.payments(id));
                            }}
                          >
                            삭제
                          </button>
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
              <form className="panel p-5" onSubmit={addCost}>
                <h3 className="font-semibold text-[#294534]">공사비 추가</h3>
                <input
                  className="field mt-4"
                  placeholder="항목명"
                  value={costForm.name}
                  onChange={(e) =>
                    setCostForm({ ...costForm, name: e.target.value })
                  }
                  required
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <MoneyInput
                    className="field"
                    placeholder="공급가액"
                    value={costForm.supply_amount}
                    onValueChange={(value) =>
                      setCostForm({
                        ...costForm,
                        supply_amount: value,
                        vat_amount: value
                          ? String(Math.round(Number(value) * 0.1))
                          : "",
                      })
                    }
                    required
                  />
                  <MoneyInput
                    className="field"
                    placeholder="부가세 (10%, 수정 가능)"
                    value={costForm.vat_amount}
                    onValueChange={(value) =>
                      setCostForm({ ...costForm, vat_amount: value })
                    }
                  />
                </div>
                <button className="btn-primary mt-4 w-full">
                  <Plus size={15} />
                  공사비 등록
                </button>
              </form>
            </div>

            <div className="grid gap-4 xl:row-span-2 xl:grid-rows-subgrid">
              <div className="panel overflow-hidden">
                <div className="border-b border-[#edf0ec] p-5">
                  <h3 className="font-semibold text-[#294534]">
                    입금 일정·이력
                  </h3>
                  <p className="mt-1 text-xs text-[#8a968e]">
                    예정, 입금, 취소, 환불을 모두 남길 수 있습니다.
                  </p>
                </div>
                {payments?.items.length ? (
                  <div className="divide-y divide-[#edf0ec]">
                    {payments.items.map((payment) => (
                      <div key={payment.id} className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#345344]">
                              {
                                {
                                  DEPOSIT: "계약금",
                                  INTERIM: "중도금",
                                  BALANCE: "잔금",
                                  OTHER: "기타",
                                }[payment.stage]
                              }
                            </p>
                            <p className="mt-1 text-xs text-[#8a968e]">
                              납기 {payment.due_date || "미지정"} ·{" "}
                              {
                                {
                                  BANK_TRANSFER: "계좌이체",
                                  CASH: "현금",
                                  CARD: "카드",
                                  OTHER: "기타",
                                }[payment.method]
                              }
                            </p>
                            <p className="mt-1 text-xs text-[#9aa49d]">
                              공급가 {money(payment.supply_amount)} · 부가세{" "}
                              {money(payment.vat_amount)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-[#345344]">
                              {money(payment.total_amount)}
                            </p>
                            <DropdownSelect
                              className="mt-2 min-w-28"
                              value={payment.status}
                              options={paymentStatusOptions}
                              compact
                              ariaLabel="입금 상태"
                              onChange={async (status) => {
                                await api.updatePayment(id, payment.id, {
                                  status,
                                  paid_at:
                                    status === "PAID"
                                      ? new Date().toISOString()
                                      : null,
                                });
                                setPayments(await api.payments(id));
                              }}
                            />
                          </div>
                        </div>
                        <button
                          className="mt-2 text-[11px] text-[#a75d5d]"
                          onClick={async () => {
                            await api.deletePayment(id, payment.id);
                            setPayments(await api.payments(id));
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-10 text-center text-sm text-[#9aa49d]">
                    등록된 입금 일정이 없습니다.
                  </p>
                )}
              </div>
              <form className="panel p-5" onSubmit={addPayment}>
                <h3 className="font-semibold text-[#294534]">입금 일정 추가</h3>
                <div className="mt-4 grid grid-cols-2 gap-2">
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
                  <MoneyInput
                    className="field col-span-2"
                    placeholder="입금 예정액"
                    value={paymentForm.supply_amount}
                    onValueChange={(value) =>
                      setPaymentForm({
                        ...paymentForm,
                        supply_amount: value,
                      })
                    }
                    required
                  />
                  <input
                    className="field"
                    type="date"
                    onClick={showDatePicker}
                    value={paymentForm.due_date}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        due_date: e.target.value,
                      })
                    }
                  />
                  <DropdownSelect
                    value={paymentForm.status}
                    options={paymentStatusOptions}
                    ariaLabel="입금 상태"
                    onChange={(value) =>
                      setPaymentForm({
                        ...paymentForm,
                        status: value as PaymentStatus,
                      })
                    }
                  />
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
                  입금 일정 등록
                </button>
              </form>
            </div>
          </div>
        </section>
      )}
      {imageToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#10261c]/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-image-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingImage)
              setImageToDelete(null);
          }}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <Trash2 size={22} />
            </div>
            <h3
              id="delete-image-title"
              className="mt-5 text-xl font-bold text-[#20392c]"
            >
              사진을 삭제할까요?
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#7a877e]">
              삭제한 사진은 현장 사진과 공개 포트폴리오에서 더 이상 표시되지
              않습니다.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setImageToDelete(null)}
                disabled={deletingImage}
              >
                취소
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={deleteSelectedImage}
                disabled={deletingImage}
              >
                <Trash2 size={15} />
                {deletingImage ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MapPage({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .projects("?page_size=100")
      .then((result) => setProjects(result.items))
      .catch((e) => setError(e.message));
  }, []);
  const mapped = projects.filter(
    (project) => project.latitude != null && project.longitude != null,
  );
  return (
    <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[1fr_320px]">
      <NaverMap
        className="min-h-[560px] overflow-hidden rounded-[24px] border border-[#e2e8e2] bg-[#edf2ed]"
        markers={mapped.map((project) => ({
          id: project.id,
          latitude: Number(project.latitude),
          longitude: Number(project.longitude),
          title: project.title,
          address: project.address,
        }))}
      />
      <section className="panel overflow-hidden">
        <div className="border-b border-[#edf0ec] p-5">
          <h2 className="font-semibold text-[#294534]">지도에 표시된 현장</h2>
          <p className="mt-1 text-xs text-[#8a968e]">
            좌표 등록 {mapped.length}곳 · 전체 {projects.length}곳
          </p>
        </div>
        {error ? (
          <p className="p-5 text-sm text-[#a14e4e]">{error}</p>
        ) : (
          <div className="max-h-[500px] divide-y divide-[#edf0ec] overflow-auto">
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
                    주소 검색으로 좌표 등록 필요
                  </p>
                )}
              </button>
            ))}
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

function adminRoute(pathname: string) {
  const projectId = pathname.match(adminProjectPattern)?.[1] || null;
  if (projectId) return { page: "detail", projectId };
  if (/^\/admin\/projects\/new\/?$/.test(pathname))
    return { page: "new-project", projectId: null };
  if (/^\/admin\/projects\/?$/.test(pathname))
    return { page: "projects", projectId: null };
  if (/^\/admin\/estimates\/?$/.test(pathname))
    return { page: "estimates", projectId: null };
  if (/^\/admin\/map\/?$/.test(pathname))
    return { page: "map", projectId: null };
  if (/^\/admin\/settings\/?$/.test(pathname))
    return { page: "settings", projectId: null };
  return { page: "dashboard", projectId: null };
}

function adminPath(page: string, projectId?: string | null) {
  if (page === "projects") return "/admin/projects";
  if (page === "new-project") return "/admin/projects/new";
  if (page === "detail" && projectId)
    return `/admin/projects/${projectId}`;
  if (page === "estimates") return "/admin/estimates";
  if (page === "map") return "/admin/map";
  if (page === "settings") return "/admin/settings";
  return "/admin";
}

function AdminApp() {
  const initialRoute = adminRoute(window.location.pathname);
  const [authenticated, setAuthenticated] = useState(
    Boolean(localStorage.getItem("interior_token")),
  );
  const [page, setPage] = useState(initialRoute.page);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRoute.projectId,
  );
  const [formProject, setFormProject] = useState<Project | undefined>();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigateAdmin = (nextPage: string, projectId?: string | null) => {
    setPage(nextPage);
    setSelectedId(projectId || null);
    setFormProject(undefined);
    history.pushState({}, "", adminPath(nextPage, projectId));
  };
  useEffect(() => {
    const onPopState = () => {
      const route = adminRoute(window.location.pathname);
      setPage(route.page);
      setSelectedId(route.projectId);
      setFormProject(undefined);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (authenticated)
      api
        .dashboard()
        .then(setDashboard)
        .catch(() => {
          localStorage.removeItem("interior_token");
          setAuthenticated(false);
        });
  }, [authenticated, page]);
  if (!authenticated)
    return (
      <Login
        onLogin={() => {
          setAuthenticated(true);
          if (/^\/admin\/login\/?$/.test(window.location.pathname)) {
            setPage("dashboard");
            setSelectedId(null);
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
        onBack={() => navigateAdmin("projects")}
        onEdit={(p) => setFormProject(p)}
        onDeleted={() => navigateAdmin("projects")}
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
      />
    );
  } else if (page === "map") {
    title = "현장 지도";
    content = (
      <MapPage
        onOpen={(id) => navigateAdmin("detail", id)}
      />
    );
  } else if (page === "settings") {
    title = "업체 설정";
    content = <CompanySettingsPage />;
  } else {
    content = (
      <DashboardPage
        data={dashboard}
        onProjects={() => navigateAdmin("projects")}
        onOpen={(id) => navigateAdmin("detail", id)}
      />
    );
  }
  return (
    <div className="flex min-h-screen bg-[#f6f7f8]">
      <Sidebar
        page={page}
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
        page={page}
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
  if (pathname === "/" || /^\/projects\/?$/.test(pathname) || isPublicProject)
    return <PublicPortfolio />;
  if (/^\/projects(?:\/|$)/.test(pathname))
    return <Redirect to="/projects" />;
  if (/^\/portfolio(?:\/|$)/.test(pathname)) {
    const legacyId = pathname.match(/^\/portfolio\/([^/]+)\/?$/)?.[1];
    const validId = legacyId?.match(new RegExp(`^${ADMIN_PROJECT_UUID}$`));
    return <Redirect to={validId ? `/projects/${legacyId}` : "/projects"} />;
  }
  if (/^\/admin(?:\/|$)/.test(pathname)) return <AdminApp />;
  return <Redirect to="/" />;
}

export default App;
