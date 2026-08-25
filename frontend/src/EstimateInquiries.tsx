import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  MapPin,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  UserRoundPlus,
  X,
} from "lucide-react";
import { api } from "./api";
import { showDatePicker } from "./datePicker";
import MoneyInput from "./MoneyInput";
import IntegerInput from "./IntegerInput";
import AddressMapPicker from "./AddressMapPicker";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import DropdownSelect, { type DropdownOption } from "./DropdownSelect";
import Pagination from "./Pagination";
import { reportAppError } from "./errors";
import type {
  CompanySettings,
  EstimateDocument,
  EstimateInquiry,
  EstimateLine,
  InquiryStats,
  InquiryStatus,
} from "./types";

const emptyCompanySettings: CompanySettings = {
  business_name: "",
  address: "",
  business_registration_number: "",
  representative_name: "",
  phone: "",
  fax: "",
  session_timeout_minutes: 480,
};

const inquiryStatusLabels: Record<InquiryStatus, string> = {
  NEW: "신규 문의",
  CONSULTATION_SCHEDULED: "상담 예약",
  SITE_VISIT_COMPLETED: "실측 완료",
  ESTIMATE_DRAFTING: "견적 작성 중",
  ESTIMATE_SENT: "견적 발송",
  REVIEWING: "고객 검토 중",
  CONTRACTED: "계약 완료",
  LOST: "미계약",
  ON_HOLD: "보류",
};
const inquiryStatusStyles: Record<InquiryStatus, string> = {
  NEW: "bg-blue-50 text-blue-700",
  CONSULTATION_SCHEDULED: "bg-violet-50 text-violet-700",
  SITE_VISIT_COMPLETED: "bg-cyan-50 text-cyan-700",
  ESTIMATE_DRAFTING: "bg-amber-50 text-amber-700",
  ESTIMATE_SENT: "bg-orange-50 text-orange-700",
  REVIEWING: "bg-purple-50 text-purple-700",
  CONTRACTED: "bg-emerald-50 text-emerald-700",
  LOST: "bg-rose-50 text-rose-700",
  ON_HOLD: "bg-slate-100 text-slate-600",
};
const statuses: InquiryStatus[] = [
  "NEW",
  "CONSULTATION_SCHEDULED",
  "CONTRACTED",
];
const inquiryStatusDots: Partial<Record<InquiryStatus, string>> = {
  NEW: "bg-blue-500",
  CONSULTATION_SCHEDULED: "bg-violet-500",
  CONTRACTED: "bg-emerald-500",
};
const inquiryStatusFilterOptions: DropdownOption[] = [
  { value: "", label: "전체 상태" },
  ...statuses.map((status) => ({
    value: status,
    label: inquiryStatusLabels[status],
    dotClass: inquiryStatusDots[status] || "bg-slate-400",
  })),
];
const lossReasonOptions: DropdownOption[] = [
  { value: "", label: "선택" },
  { value: "가격", label: "가격" },
  { value: "일정", label: "일정" },
  { value: "연락 두절", label: "연락 두절" },
  { value: "타 업체 계약", label: "타 업체 계약" },
  { value: "단순 견적 문의", label: "단순 견적 문의" },
  { value: "기타", label: "기타" },
];
const won = (value = 0) => `${new Intl.NumberFormat("ko-KR").format(value)}원`;
const estimateQuantity = (value: number) =>
  Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 1;
const pyeong = (value?: number) =>
  value ? `${Math.round(Number(value))}평` : "평수 미정";
const tenThousandWon = (value: string) =>
  `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(Number(value || 0) / 10000)}만원`;
const dateText = (value?: string) =>
  value ? new Date(value).toLocaleDateString("ko-KR") : "미정";
const dateTimeText = (value: string) => {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
const toLocalDateTime = (value?: string) =>
  value ? new Date(value).toISOString().slice(0, 16) : "";
const currentLocalDateTime = () => {
  const now = new Date();
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};
const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 11);
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10)
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

function StatusPill({ status }: { status: InquiryStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${inquiryStatusStyles[status]}`}
    >
      {inquiryStatusLabels[status]}
    </span>
  );
}

function InquiryStatusSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: InquiryStatus;
  onChange: (status: InquiryStatus) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`field flex items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:bg-[#f4f6f4] disabled:opacity-70 ${open ? "border-[#628b72] ring-2 ring-[#d9e9dd]" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={`h-2.5 w-2.5 rounded-full ${inquiryStatusDots[value] || "bg-slate-400"}`}
          />
          <span className="font-semibold text-[#31483a]">
            {inquiryStatusLabels[value]}
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
          aria-label="견적 진행 상태"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[#dce5dd] bg-white p-1.5 shadow-[0_18px_45px_rgba(29,55,40,.16)]"
        >
          {statuses.map((status) => {
            const selected = status === value;
            return (
              <button
                key={status}
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
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${inquiryStatusDots[status]}`}
                  />
                  <span className={selected ? "font-bold" : "font-medium"}>
                    {inquiryStatusLabels[status]}
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

type InquiryFormState = {
  customer_name: string;
  customer_phone: string;
  status: InquiryStatus;
  address: string;
  address_detail: string;
  housing_type: string;
  area_pyeong: string;
  desired_budget: string;
  desired_start_date: string;
  consultation_date: string;
  consultation_reserved_at: string;
  request_details: string;
  memo: string;
  loss_reason: string;
};

function inquiryFormValue(inquiry?: EstimateInquiry): InquiryFormState {
  return {
    customer_name: inquiry?.customer_name || "",
    customer_phone: inquiry?.customer_phone || "",
    status: inquiry?.status || "NEW",
    address: inquiry?.address || "",
    address_detail: inquiry?.address_detail || "",
    housing_type: inquiry?.housing_type || "",
    area_pyeong: inquiry?.area_pyeong ? String(inquiry.area_pyeong) : "",
    desired_budget: inquiry?.desired_budget
      ? String(inquiry.desired_budget)
      : "",
    desired_start_date: inquiry?.desired_start_date || "",
    consultation_date: inquiry
      ? toLocalDateTime(inquiry.consultation_date)
      : currentLocalDateTime(),
    consultation_reserved_at: toLocalDateTime(
      inquiry?.consultation_reserved_at,
    ),
    request_details: inquiry?.request_details || "",
    memo: inquiry?.memo || "",
    loss_reason: inquiry?.loss_reason || "",
  };
}

function InquiryForm({
  inquiry,
  onCancel,
  onSaved,
}: {
  inquiry?: EstimateInquiry;
  onCancel: () => void;
  onSaved: (inquiry: EstimateInquiry) => void;
}) {
  const [form, setForm] = useState(() => inquiryFormValue(inquiry));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const set = (key: keyof InquiryFormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      ...form,
      area_pyeong: form.area_pyeong ? Number(form.area_pyeong) : null,
      desired_budget: form.desired_budget ? Number(form.desired_budget) : null,
      desired_start_date: form.desired_start_date || null,
      consultation_date: form.consultation_date || null,
      consultation_reserved_at: form.consultation_reserved_at || null,
      loss_reason: form.status === "LOST" ? form.loss_reason || null : null,
    };
    try {
      const result = inquiry
        ? await api.updateInquiry(inquiry.id, body)
        : await api.createInquiry(body);
      onSaved(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="p-5 sm:p-8">
      <button
        className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#54705e]"
        onClick={onCancel}
      >
        <ArrowLeft size={16} /> 견적·상담 목록으로
      </button>
      <form
        onSubmit={submit}
        className="panel mx-auto max-w-5xl overflow-hidden"
      >
        <div className="border-b border-[#e8ece8] px-4 py-5 sm:px-6">
          <h2 className="text-2xl font-bold text-[#1d382b]">
            {inquiry ? "상담 정보 수정" : "새 견적 문의 등록"}
          </h2>
        </div>
        <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-2">
          <div>
            <label className="label">
              고객명 <span className="required-mark">*</span>
            </label>
            <input
              className="field"
              required
              value={form.customer_name}
              onChange={(e) => set("customer_name", e.target.value)}
              placeholder="홍길동"
            />
          </div>
          <div>
            <label className="label">
              연락처 <span className="required-mark">*</span>
            </label>
            <input
              className="field"
              required
              value={form.customer_phone}
              onChange={(e) =>
                set("customer_phone", formatPhoneNumber(e.target.value))
              }
              placeholder="010-0000-0000"
              inputMode="tel"
            />
          </div>
          <div>
            <label className="label">진행 상태</label>
            <InquiryStatusSelect
              value={form.status}
              onChange={(status) => set("status", status)}
            />
          </div>
          <div>
            <label className="label">주거 형태</label>
            <input
              className="field"
              value={form.housing_type}
              onChange={(e) => set("housing_type", e.target.value)}
              placeholder="아파트, 주택, 상가 등"
            />
          </div>
          <div>
            <label className="label">주소</label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className="field"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="도로명 또는 지번 주소"
              />
              <button
                type="button"
                className="btn-secondary whitespace-nowrap"
                onClick={() => setMapPickerOpen(true)}
              >
                <MapPin size={15} /> 지도에서 선택
              </button>
            </div>
          </div>
          <div>
            <label className="label">상세 주소</label>
            <input
              className="field"
              value={form.address_detail}
              onChange={(e) => set("address_detail", e.target.value)}
              placeholder="동·호수, 층 등 상세 주소"
            />
          </div>
          <div>
            <label className="label">평수</label>
            <IntegerInput
              className="field"
              value={form.area_pyeong}
              onValueChange={(value) => set("area_pyeong", value)}
            />
          </div>
          <div>
            <label className="label">희망 예산</label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <MoneyInput
                className="field"
                value={form.desired_budget}
                onValueChange={(value) => set("desired_budget", value)}
                placeholder="원 단위"
              />
              <div
                className="flex min-w-24 items-center justify-end rounded-xl border border-[#c9d3cb] bg-[#f5f8f5] px-3 text-sm font-semibold text-[#496151]"
                aria-live="polite"
              >
                {tenThousandWon(form.desired_budget)}
              </div>
            </div>
          </div>
          <div>
            <label className="label">희망 공사 시작일</label>
            <input
              className="field"
              type="date"
              onClick={showDatePicker}
              value={form.desired_start_date}
              onChange={(e) => set("desired_start_date", e.target.value)}
            />
          </div>
          <div>
            <label className="label">상담 일정</label>
            <input
              className="field"
              type="datetime-local"
              onClick={showDatePicker}
              value={form.consultation_date}
              onChange={(e) => set("consultation_date", e.target.value)}
            />
          </div>
          {form.status === "CONSULTATION_SCHEDULED" && (
            <div>
              <label className="label">
                상담 예약일<span className="required-mark">*</span>
              </label>
              <input
                className="field"
                type="datetime-local"
                required
                onClick={showDatePicker}
                value={form.consultation_reserved_at}
                onChange={(e) =>
                  set("consultation_reserved_at", e.target.value)
                }
              />
            </div>
          )}
          <div className="md:col-span-2">
            <label className="label">공사 요청사항</label>
            <textarea
              className="field min-h-28 resize-y"
              value={form.request_details}
              onChange={(e) => set("request_details", e.target.value)}
              placeholder="원하는 공사 범위, 자재, 스타일 등을 기록하세요."
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">내부 메모</label>
            <textarea
              className="field min-h-20 resize-y"
              value={form.memo}
              onChange={(e) => set("memo", e.target.value)}
            />
          </div>
          {form.status === "LOST" && (
            <div className="md:col-span-2">
              <label className="label">미계약 사유</label>
              <DropdownSelect
                value={form.loss_reason}
                options={lossReasonOptions}
                onChange={(value) => set("loss_reason", value)}
                ariaLabel="미계약 사유"
              />
            </div>
          )}
          {error && (
            <p className="md:col-span-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-[#e8ece8] bg-[#fafbf9] px-4 py-4 sm:px-6">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            취소
          </button>
          <button className="btn-primary" disabled={saving}>
            {saving ? "저장 중…" : "상담 정보 저장"}
          </button>
        </div>
      </form>
      {mapPickerOpen && (
        <AddressMapPicker
          onClose={() => setMapPickerOpen(false)}
          onSelect={(selected) => {
            set(
              "address",
              selected.road_address || selected.jibun_address || "",
            );
            setMapPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

const blankLine = (sortOrder: number): EstimateLine => ({
  category: "OTHER",
  name: "",
  specification: "",
  quantity: 0,
  unit: "",
  unit_price: 0,
  sort_order: sortOrder,
});

function EstimateEditor({
  inquiry,
  estimate,
  newVersion,
  applyProjectId,
  onCancel,
  onSaved,
}: {
  inquiry: EstimateInquiry;
  estimate?: EstimateDocument;
  newVersion?: boolean;
  applyProjectId?: string;
  onCancel: () => void;
  onSaved: (
    estimate: EstimateDocument,
    applyToProject: boolean,
  ) => Promise<void> | void;
}) {
  const [title, setTitle] = useState(estimate?.title || "인테리어 공사 견적서");
  const [notes, setNotes] = useState(estimate?.notes || "");
  const [lines, setLines] = useState<EstimateLine[]>(
    estimate?.lines.length
      ? estimate.lines.map((line, index) => {
          const legacyEmptyUnit = line.unit === "-";
          return {
            ...line,
            unit: legacyEmptyUnit ? "" : line.unit,
            quantity:
              legacyEmptyUnit && Number(line.quantity) === 1
                ? 0
                : line.quantity,
            sort_order: index,
          };
        })
      : [blankLine(0)],
  );
  const [saving, setSaving] = useState(false);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const totals = useMemo(() => {
    const supply = lines.reduce(
      (sum, line) =>
        sum + estimateQuantity(line.quantity) * Number(line.unit_price || 0),
      0,
    );
    const vat = Math.round(supply * 0.1);
    return { supply, vat, total: supply + vat };
  }, [lines]);
  const updateLine = (index: number, patch: Partial<EstimateLine>) =>
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  const save = async (applyToProject = false) => {
    if (lines.some((line) => !line.name.trim())) {
      const message = "품명이 비어 있는 견적 항목이 있습니다.";
      setError(message);
      reportAppError(
        new Error(message),
        "품명이 비어 있는 견적 항목이 있습니다.",
      );
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      title: title.trim() || "인테리어 공사 견적서",
      notes: notes || null,
      lines: lines.map(
        (
          {
            id: _id,
            estimate_id: _estimateId,
            supply_amount: _supply,
            vat_amount: _vat,
            total_amount: _total,
            ...line
          },
          index,
        ) => ({
          ...line,
          category: line.category || "OTHER",
          name: line.name.trim() || `견적 항목 ${index + 1}`,
          unit: line.unit.trim(),
          quantity:
            Number.isFinite(Number(line.quantity)) && Number(line.quantity) >= 0
              ? Number(line.quantity)
              : 0,
          sort_order: index,
        }),
      ),
    };
    try {
      const saved =
        estimate && !newVersion
          ? await api.updateEstimate(inquiry.id, estimate.id, body)
          : await api.createEstimate(
              inquiry.id,
              body,
              applyToProject ? applyProjectId : undefined,
            );
      await onSaved(saved, applyToProject);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "견적서를 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="p-5 sm:p-8">
      <button
        className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#54705e]"
        onClick={onCancel}
      >
        <ArrowLeft size={16} /> {inquiry.customer_name} 고객 상담으로
      </button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(false);
        }}
        className="panel mx-auto max-w-6xl overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8ece8] px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs font-semibold text-[#829187]">
              {newVersion
                ? "새 견적 작성"
                : estimate
                  ? `${estimate.version}차 견적서 수정`
                  : "첫 견적서"}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-[#1d382b]">
              상세 견적 작성
            </h2>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#87948c]">예상 합계</p>
            <p className="text-xl font-bold text-[#24563b]">
              {won(totals.total)}
            </p>
          </div>
        </div>
        <div className="border-b border-[#edf0ed] p-4 sm:p-6">
          <div>
            <label className="label">견적서 제목</label>
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-3 p-4 sm:p-6">
          <div className="hidden grid-cols-[1.2fr_1fr_70px_80px_120px_120px_1fr_42px] gap-2 px-2 text-xs font-semibold text-[#75827a] lg:grid">
            <span>품명</span>
            <span>규격</span>
            <span>단위</span>
            <span>수량</span>
            <span>단가</span>
            <span>금액</span>
            <span>비고</span>
            <span />
          </div>
          {lines.map((line, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-[#e5eae5] bg-[#fbfcfa] p-3 lg:grid-cols-[1.2fr_1fr_70px_80px_120px_120px_1fr_42px]"
            >
              <input
                className="field px-2 py-2"
                placeholder="품명"
                value={line.name}
                onChange={(e) => updateLine(index, { name: e.target.value })}
                required
              />
              <input
                className="field px-2 py-2"
                placeholder="규격"
                value={line.specification || ""}
                onChange={(e) =>
                  updateLine(index, { specification: e.target.value })
                }
              />
              <input
                className="field px-2 py-2"
                placeholder="단위"
                value={line.unit}
                onChange={(e) => updateLine(index, { unit: e.target.value })}
              />
              <input
                className="field px-2 py-2"
                placeholder="수량"
                step="any"
                type="number"
                value={Number(line.quantity) > 0 ? line.quantity : ""}
                onChange={(e) =>
                  updateLine(index, {
                    quantity: e.target.value ? Number(e.target.value) : 0,
                  })
                }
              />
              <MoneyInput
                className="field px-2 py-2 text-right"
                placeholder="단가"
                value={line.unit_price}
                onValueChange={(value) =>
                  updateLine(index, { unit_price: Number(value || 0) })
                }
              />
              <div className="field flex items-center justify-end px-2 py-2 font-semibold text-[#3f5c49]">
                {won(
                  estimateQuantity(line.quantity) *
                    Number(line.unit_price || 0),
                )}
              </div>
              <input
                className="field px-2 py-2"
                placeholder="비고"
                value={line.memo || ""}
                onChange={(e) => updateLine(index, { memo: e.target.value })}
              />
              <button
                type="button"
                aria-label="항목 삭제"
                className="flex items-center justify-center rounded-lg text-[#ad6a6a] hover:bg-rose-50"
                onClick={() =>
                  setLines((current) =>
                    current.length === 1
                      ? [blankLine(0)]
                      : current.filter((_, i) => i !== index),
                  )
                }
              >
                <X size={17} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setLines((current) => [...current, blankLine(current.length)])
            }
          >
            <Plus size={15} /> 견적 항목 추가
          </button>
          <div className="ml-auto mt-6 max-w-sm space-y-2 rounded-2xl bg-[#f3f7f3] p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-[#708078]">공급가액</span>
              <b>{won(totals.supply)}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-[#708078]">부가세 10%</span>
              <b>{won(totals.vat)}</b>
            </div>
            <div className="flex justify-between border-t border-[#dce5dc] pt-3 text-lg">
              <span>총 견적금액</span>
              <b className="text-[#24563b]">{won(totals.total)}</b>
            </div>
          </div>
          <div>
            <label className="label">견적 조건 및 비고</label>
            <textarea
              className="field min-h-24"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="공사 조건, 별도 항목, 결제 조건 등을 입력하세요."
            />
          </div>
          {error && (
            <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-[#e8ece8] bg-[#fafbf9] px-6 py-4">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            취소
          </button>
          <button className="btn-primary" disabled={saving}>
            {saving
              ? "저장 중…"
              : status === "SENT"
                ? "저장하고 발송 처리"
                : "견적서 저장"}
          </button>
          {newVersion && applyProjectId && (
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={() => setApplyConfirmOpen(true)}
            >
              저장 후 현장에 적용
            </button>
          )}
        </div>
      </form>
      {applyConfirmOpen && estimate && (
        <ConfirmModal
          title={`${estimate.version + 1}차 견적서를 현장에 적용할까요?`}
          description={`기존 ${won(estimate.total_amount)} → 변경 ${won(totals.total)} · 증감 ${won(totals.total - estimate.total_amount)}`}
          confirmLabel={saving ? "저장 및 적용 중…" : "저장 후 현장 적용"}
          busy={saving}
          onClose={() => setApplyConfirmOpen(false)}
          onConfirm={async () => {
            await save(true);
            setApplyConfirmOpen(false);
          }}
        />
      )}
    </div>
  );
}

function PrintEstimate({
  inquiry,
  estimate,
  companySettings,
}: {
  inquiry: EstimateInquiry;
  estimate: EstimateDocument;
  companySettings: CompanySettings;
}) {
  const companyValue = (value: string) => value.trim() || "-";

  return (
    <article className="print-sheet">
      <header className="flex items-start justify-between border-b-2 border-[#17372b] pb-6">
        <div>
          <p className="text-sm font-bold tracking-[.2em] text-[#315d47]">
            제일 인테리어
          </p>
          <h1 className="mt-3 text-4xl font-bold">견 적 서</h1>
        </div>
        <table className="company-info-table w-[370px] table-fixed border-collapse text-xs">
          <tbody>
            <tr>
              <th rowSpan={6} className="w-8 text-center font-bold">
                공<br />급<br />자
              </th>
              <th className="w-20 text-center">주소</th>
              <td colSpan={2}>{companyValue(companySettings.address)}</td>
            </tr>
            <tr>
              <th className="text-center">상호</th>
              <td colSpan={2}>{companyValue(companySettings.business_name)}</td>
            </tr>
            <tr>
              <th className="text-center">사업자번호</th>
              <td colSpan={2}>
                {companyValue(companySettings.business_registration_number)}
              </td>
            </tr>
            <tr>
              <th className="text-center">대표자</th>
              <td colSpan={2}>
                {companyValue(companySettings.representative_name)}
              </td>
            </tr>
            <tr>
              <th className="text-center">전화번호</th>
              <td colSpan={2}>{companyValue(companySettings.phone)}</td>
            </tr>
            <tr>
              <th className="text-center">FAX</th>
              <td colSpan={2}>{companyValue(companySettings.fax)}</td>
            </tr>
          </tbody>
        </table>
      </header>
      <section className="estimate-print-customer">
        <div>
          <p className="estimate-print-customer-label">수신</p>
          <p className="estimate-print-customer-name">
            {inquiry.customer_name} 고객님 귀하
          </p>
          <p className="estimate-print-customer-address">
            {[inquiry.address, inquiry.address_detail]
              .filter(Boolean)
              .join(" ") || "주소 미정"}
          </p>
        </div>
      </section>
      <h2 className="estimate-print-table-title">{estimate.title}</h2>
      <div className="estimate-print-table-frame">
        <span
          className="estimate-print-table-edge estimate-print-table-edge-top"
          aria-hidden="true"
        />
        <table className="estimate-print-lines">
          <colgroup>
            <col className="estimate-col-name" />
            <col className="estimate-col-spec" />
            <col className="estimate-col-unit" />
            <col className="estimate-col-quantity" />
            <col className="estimate-col-price" />
            <col className="estimate-col-amount" />
            <col className="estimate-col-memo" />
          </colgroup>
          <thead>
            <tr>
              <th>품명</th>
              <th>규격</th>
              <th>단위</th>
              <th>수량</th>
              <th>단가</th>
              <th>금액</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {estimate.lines.map((line) => (
              <tr key={line.id}>
                <td className="estimate-line-name">{line.name}</td>
                <td>{line.specification || ""}</td>
                <td className="estimate-cell-center">{line.unit}</td>
                <td className="estimate-cell-center estimate-number">
                  {Number(line.quantity) > 0 ? line.quantity : ""}
                </td>
                <td className="estimate-cell-number">{won(line.unit_price)}</td>
                <td className="estimate-cell-number estimate-line-amount">
                  {won(line.supply_amount || line.quantity * line.unit_price)}
                </td>
                <td>{line.memo || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <span
          className="estimate-print-table-edge estimate-print-table-edge-bottom"
          aria-hidden="true"
        />
      </div>
      <div className="ml-auto mt-6 w-80 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>공급가액</span>
          <b>{won(estimate.supply_amount)}</b>
        </div>
        <div className="flex justify-between">
          <span>부가세</span>
          <b>{won(estimate.vat_amount)}</b>
        </div>
        <div className="flex justify-between border-t-2 border-[#17372b] pt-3 text-xl">
          <span>총 견적금액</span>
          <b>{won(estimate.total_amount)}</b>
        </div>
      </div>
      {estimate.notes && (
        <section className="mt-10 rounded-lg border p-4 text-sm">
          <b>견적 조건 및 비고</b>
          <p className="mt-2 whitespace-pre-wrap leading-6">{estimate.notes}</p>
        </section>
      )}
      <footer className="mt-16 border-t pt-4 text-xs text-gray-500">
        본 견적서는 작성일로부터 1년간 유효하며, 현장 상황과 자재 선택에 따라
        금액이 변경될 수 있습니다. (작성일: {dateText(estimate.created_at)})
      </footer>
    </article>
  );
}

function InquiryDetail({
  inquiry,
  initialEstimateId,
  startNewVersion,
  applyProjectId,
  onBack,
  onEdit,
  onReload,
  onDeleted,
  onOpenProject,
}: {
  inquiry: EstimateInquiry;
  initialEstimateId?: string;
  startNewVersion?: boolean;
  applyProjectId?: string;
  onBack: () => void;
  onEdit: () => void;
  onReload: () => Promise<void>;
  onDeleted: () => void;
  onOpenProject: (id: string) => void;
}) {
  const estimates = inquiry.estimates || [];
  const [selectedEstimate, setSelectedEstimate] = useState<
    EstimateDocument | undefined
  >(
    estimates.find((estimate) => estimate.id === initialEstimateId) ||
      estimates[0],
  );
  const [editor, setEditor] = useState<{
    estimate?: EstimateDocument;
    newVersion?: boolean;
    applyProjectId?: string;
  } | null>(() => {
    if (!startNewVersion) return null;
    return {
      estimate:
        estimates.find((estimate) => estimate.id === initialEstimateId) ||
        estimates[0],
      newVersion: true,
      applyProjectId,
    };
  });
  const [printing, setPrinting] = useState<EstimateDocument | null>(null);
  const [companySettings, setCompanySettings] =
    useState<CompanySettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [convertForm, setConvertForm] = useState<{
    project_title: string;
    planned_start_date: string;
    planned_end_date: string;
  } | null>(null);
  const [convertError, setConvertError] = useState("");
  const [projectActionError, setProjectActionError] = useState("");
  const [lossReasonForm, setLossReasonForm] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");
  const [deleteInquiryOpen, setDeleteInquiryOpen] = useState(false);
  const [deleteInquiryError, setDeleteInquiryError] = useState("");
  const [mappedEstimateId, setMappedEstimateId] = useState<string>();
  const [estimateToApply, setEstimateToApply] =
    useState<EstimateDocument | null>(null);
  const [applyingEstimate, setApplyingEstimate] = useState(false);
  useEffect(
    () =>
      setSelectedEstimate(
        estimates.find((estimate) => estimate.id === initialEstimateId) ||
          estimates[0],
      ),
    [inquiry, initialEstimateId],
  );
  useEffect(() => {
    let active = true;
    api
      .companySettings()
      .then((settings) => {
        if (active) setCompanySettings(settings);
      })
      .catch(() => {
        if (active) setCompanySettings(emptyCompanySettings);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (!inquiry.converted_project_id) {
      setMappedEstimateId(undefined);
      return () => {
        active = false;
      };
    }
    api
      .project(inquiry.converted_project_id)
      .then((project) => {
        if (active) setMappedEstimateId(project.contract_estimate_id);
      })
      .catch(() => {
        if (active) setMappedEstimateId(undefined);
      });
    return () => {
      active = false;
    };
  }, [inquiry.converted_project_id]);
  useEffect(() => {
    if (!printing || !companySettings) return;
    const timer = window.setTimeout(() => {
      const originalTitle = document.title;
      const printedAt = new Date();
      const pad = (part: number) => String(part).padStart(2, "0");
      const printedDate = `${printedAt.getFullYear()}-${pad(printedAt.getMonth() + 1)}-${pad(printedAt.getDate())}`;
      const safeCustomerName = inquiry.customer_name.replace(
        /[\\/:*?"<>|]/g,
        "_",
      );
      document.title = `견적서_${safeCustomerName}_고객_${printedDate}`;
      try {
        window.print();
      } finally {
        document.title = originalTitle;
        setPrinting(null);
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [printing, companySettings, inquiry.customer_name]);
  const mappedEstimate = estimates.find(
    (estimate) => estimate.id === mappedEstimateId,
  );
  if (editor)
    return (
      <EstimateEditor
        inquiry={inquiry}
        estimate={editor.estimate}
        newVersion={editor.newVersion}
        applyProjectId={editor.applyProjectId}
        onCancel={() => {
          setEditor(null);
          history.replaceState(
            {},
            "",
            `/admin/estimates?inquiry=${encodeURIComponent(inquiry.id)}&estimate=${encodeURIComponent(editor.estimate?.id || initialEstimateId || "")}`,
          );
        }}
        onSaved={async (saved, applyToProject) => {
          setEditor(null);
          await onReload();
          setSelectedEstimate(saved);
          if (applyToProject) setMappedEstimateId(saved.id);
          setMessage(
            applyToProject
              ? `${saved.version}차 견적서를 저장하고 현장에 적용했습니다.`
              : `${saved.version}차 견적서를 저장했습니다.`,
          );
          history.replaceState(
            {},
            "",
            `/admin/estimates?inquiry=${encodeURIComponent(inquiry.id)}&estimate=${encodeURIComponent(saved.id)}`,
          );
        }}
      />
    );
  const saveStatus = async (status: InquiryStatus, lossReason?: string) => {
    setBusy(true);
    setStatusError("");
    try {
      await api.updateInquiry(inquiry.id, {
        status,
        ...(status === "LOST" ? { loss_reason: lossReason } : {}),
      });
      await onReload();
      setLossReasonForm(null);
    } catch (e) {
      setStatusError(
        e instanceof Error ? e.message : "진행 상태를 변경하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };
  const updateStatus = async (status: InquiryStatus) => {
    if (status === "LOST") {
      setStatusError("");
      setLossReasonForm(inquiry.loss_reason || "");
      return;
    }
    await saveStatus(status);
  };
  const openConvertModal = () => {
    setConvertError("");
    setConvertForm({
      project_title: `${inquiry.customer_name} 고객 현장`,
      planned_start_date: "",
      planned_end_date: "",
    });
  };
  const convert = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!convertForm) return;
    if (!convertForm.project_title.trim()) {
      setConvertError("현장명을 입력해 주세요.");
      return;
    }
    if (
      convertForm.planned_start_date &&
      convertForm.planned_end_date &&
      convertForm.planned_end_date < convertForm.planned_start_date
    ) {
      setConvertError("공사 종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }
    setBusy(true);
    setConvertError("");
    try {
      const project = await api.convertInquiry(inquiry.id, {
        project_title: convertForm.project_title.trim(),
        planned_start_date: convertForm.planned_start_date || null,
        planned_end_date: convertForm.planned_end_date || null,
      });
      setConvertForm(null);
      onOpenProject(project.id);
    } catch (e) {
      setConvertError(
        e instanceof Error ? e.message : "현장으로 전환하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };
  const restoreConvertedProject = async () => {
    if (!inquiry.converted_project_id) return;
    setBusy(true);
    setProjectActionError("");
    try {
      await api.restoreProject(inquiry.converted_project_id);
      onOpenProject(inquiry.converted_project_id);
    } catch (e) {
      setProjectActionError(
        e instanceof Error ? e.message : "삭제된 현장을 복원하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };
  const deleteInquiry = async () => {
    setBusy(true);
    setDeleteInquiryError("");
    try {
      await api.deleteInquiry(inquiry.id);
      setDeleteInquiryOpen(false);
      onDeleted();
    } catch (e) {
      setDeleteInquiryError(
        e instanceof Error ? e.message : "견적 문의를 삭제하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="space-y-6 p-5 sm:p-8">
        <button
          className="flex items-center gap-2 text-sm font-semibold text-[#54705e]"
          onClick={onBack}
        >
          <ArrowLeft size={16} /> 견적·상담 목록으로
        </button>
        <section className="panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-bold text-[#1b382a]">
                  {inquiry.customer_name}
                </h2>
                <StatusPill status={inquiry.status} />
              </div>
              <p className="mt-2 text-sm text-[#748078]">
                {inquiry.customer_phone} ·{" "}
                {[inquiry.address, inquiry.address_detail]
                  .filter(Boolean)
                  .join(" ") || "주소 미등록"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={onEdit}>
                <Pencil size={15} /> 수정
              </button>
            </div>
          </div>
          {message && (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </p>
          )}
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#718078]">
                진행 상태
              </label>
              <div className="w-full md:w-1/2 [&_button]:text-base">
                <InquiryStatusSelect
                  disabled={busy || inquiry.status === "CONTRACTED"}
                  value={inquiry.status}
                  onChange={updateStatus}
                />
              </div>
            </div>
            <div>
              <p className="mb-1.5 block text-sm font-semibold text-[#718078]">
                희망 예산
              </p>
              <p className="value-text pt-2 text-base">
                {inquiry.desired_budget ? won(inquiry.desired_budget) : "미정"}
              </p>
            </div>
            <div>
              <p className="mb-1.5 block text-sm font-semibold text-[#718078]">
                평수·유형
              </p>
              <p className="value-text pt-2 text-base">
                {pyeong(inquiry.area_pyeong)} ·{" "}
                {inquiry.housing_type || "유형 미정"}
              </p>
            </div>
          </div>
          {(inquiry.request_details || inquiry.memo) && (
            <div className="mt-5 grid gap-4 border-t-2 border-[#d8e1da] pt-5 md:grid-cols-2">
              <div>
                <p className="label">공사 요청사항</p>
                <p className="value-copy whitespace-pre-wrap">
                  {inquiry.request_details || "-"}
                </p>
              </div>
              <div>
                <p className="label">내부 메모</p>
                <p className="value-copy whitespace-pre-wrap">
                  {inquiry.memo || "-"}
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#edf0ed] p-4">
              <div>
                <h3 className="font-bold text-[#294534]">견적 내역</h3>
                <p className="text-xs text-[#8b978f]">
                  총 {estimates.length}건
                </p>
              </div>
              <button
                className="rounded-lg bg-[#e7f0e8] p-2 text-[#376246]"
                onClick={() => setEditor({})}
              >
                <FilePlus2 size={17} />
              </button>
            </div>
            {estimates.length ? (
              <div className="divide-y divide-[#edf0ed]">
                {estimates.map((estimate) => (
                  <button
                    key={estimate.id}
                    onClick={() => setSelectedEstimate(estimate)}
                    className={`flex w-full items-center justify-between p-4 text-left ${selectedEstimate?.id === estimate.id ? "bg-[#f0f6f0]" : "hover:bg-[#fafbfa]"}`}
                  >
                    <div>
                      <b className="text-sm">{estimate.version}차 견적</b>
                      <p className="mt-1 text-xs text-[#849188]">
                        {won(estimate.total_amount)}
                      </p>
                      <p className="mt-1 text-xs text-[#849188]">
                        작성일 {dateTimeText(estimate.created_at)}
                      </p>
                    </div>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="p-5 text-sm leading-6 text-[#849188]">
                아직 작성된 견적서가 없습니다.
              </p>
            )}
          </div>
          {selectedEstimate ? (
            <div className="panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#839188]">
                    {selectedEstimate.version}차 견적서
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-[#203a2d]">
                    {selectedEstimate.title}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {inquiry.converted_project_id &&
                    (mappedEstimateId === selectedEstimate.id ? (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                        <CheckCircle2 size={15} /> 현장 적용 중
                      </span>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={() => {
                          setProjectActionError("");
                          setEstimateToApply(selectedEstimate);
                        }}
                      >
                        <CheckCircle2 size={15} /> 현장에 적용
                      </button>
                    ))}
                  <button
                    className="btn-secondary"
                    onClick={() => setPrinting(selectedEstimate)}
                  >
                    <Printer size={15} /> PDF 저장·인쇄
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setEditor({ estimate: selectedEstimate })}
                  >
                    <Pencil size={15} /> 수정
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      setEditor({
                        estimate: selectedEstimate,
                        newVersion: true,
                        applyProjectId: inquiry.converted_project_id,
                      })
                    }
                  >
                    <FilePlus2 size={15} /> 새 견적 작성
                  </button>
                </div>
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead>
                    <tr className="border-y border-[#e7ece7] bg-[#f7f9f7] text-xs text-[#75827a]">
                      <th className="border-r border-[#dfe6e0] px-3 py-3">
                        품명
                      </th>
                      <th className="border-r border-[#dfe6e0] px-3 py-3">
                        규격
                      </th>
                      <th className="border-r border-[#dfe6e0] px-3 py-3">
                        단위
                      </th>
                      <th className="border-r border-[#dfe6e0] px-3 py-3">
                        수량
                      </th>
                      <th className="border-r border-[#dfe6e0] px-3 py-3">
                        단가
                      </th>
                      <th className="border-r border-[#dfe6e0] px-3 py-3">
                        금액
                      </th>
                      <th className="px-3 py-3">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEstimate.lines.map((line) => (
                      <tr
                        key={line.id || line.sort_order}
                        className="border-b border-[#edf0ed]"
                      >
                        <td className="border-r border-[#e4e9e5] px-3 py-3 font-semibold">
                          {line.name}
                        </td>
                        <td className="border-r border-[#e4e9e5] px-3 py-3 text-[#728078]">
                          {line.specification || ""}
                        </td>
                        <td className="border-r border-[#e4e9e5] px-3 py-3">
                          {line.unit}
                        </td>
                        <td className="border-r border-[#e4e9e5] px-3 py-3 text-right">
                          {Number(line.quantity) > 0 ? line.quantity : ""}
                        </td>
                        <td className="border-r border-[#e4e9e5] px-3 py-3 text-right">
                          {won(line.unit_price)}
                        </td>
                        <td className="border-r border-[#e4e9e5] px-3 py-3 text-right">
                          {won(line.supply_amount)}
                        </td>
                        <td className="px-3 py-3 text-[#728078]">
                          {line.memo || ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ml-auto mt-6 max-w-sm space-y-2 rounded-2xl bg-[#f3f7f3] p-5 text-sm">
                <div className="flex justify-between">
                  <span>공급가액</span>
                  <b>{won(selectedEstimate.supply_amount)}</b>
                </div>
                <div className="flex justify-between">
                  <span>부가세</span>
                  <b>{won(selectedEstimate.vat_amount)}</b>
                </div>
                <div className="flex justify-between border-t pt-3 text-lg">
                  <span>총 견적금액</span>
                  <b className="text-[#24563b]">
                    {won(selectedEstimate.total_amount)}
                  </b>
                </div>
              </div>
              {selectedEstimate.notes && (
                <p className="mt-5 whitespace-pre-wrap rounded-xl border border-[#e5eae5] p-4 text-sm leading-6 text-[#65736a]">
                  {selectedEstimate.notes}
                </p>
              )}
            </div>
          ) : (
            <div className="panel flex min-h-80 flex-col items-center justify-center p-8 text-center">
              <FileText className="text-[#7f9b87]" size={30} />
              <h3 className="mt-3 font-bold text-[#294534]">
                첫 견적서를 작성해 보세요
              </h3>
              <p className="mt-1 text-sm text-[#849188]">
                공종별 항목과 부가세가 자동 계산됩니다.
              </p>
              <button
                className="btn-primary mt-5"
                onClick={() => setEditor({})}
              >
                <Plus size={15} /> 견적서 작성
              </button>
            </div>
          )}
        </section>

        <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-[#294534]">상담 결과 처리</h3>
              {inquiry.converted_project_archived && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  생성 현장 삭제됨
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[#7a877e]">
              {inquiry.converted_project_archived
                ? "생성된 현장이 삭제되어 있습니다. 복원하면 현장 관리에서 다시 확인할 수 있습니다."
                : "계약되면 고객 정보와 최신 견적 항목으로 현장이 자동 생성됩니다."}
            </p>
            {projectActionError && (
              <p className="mt-2 text-sm font-medium text-rose-700">
                {projectActionError}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {inquiry.converted_project_id ? (
              inquiry.converted_project_archived ? (
                <button
                  className="btn-primary"
                  disabled={busy}
                  onClick={restoreConvertedProject}
                >
                  <RotateCcw size={16} />
                  {busy ? "복원 중…" : "현장 복원 후 열기"}
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => onOpenProject(inquiry.converted_project_id!)}
                >
                  <CheckCircle2 size={16} /> 생성된 현장 열기
                </button>
              )
            ) : (
              <button
                className="btn-primary"
                disabled={busy}
                onClick={openConvertModal}
              >
                <CheckCircle2 size={16} /> 계약 완료 · 현장 전환
              </button>
            )}
            <button
              className="btn-secondary text-rose-700"
              onClick={() => {
                setDeleteInquiryError("");
                setDeleteInquiryOpen(true);
              }}
            >
              <Trash2 size={15} /> 삭제
            </button>
          </div>
        </section>
      </div>
      {convertForm && (
        <Modal
          title="계약 완료 · 현장 생성"
          description="현장명과 공사기간을 확인한 뒤 현장을 생성하세요."
          onClose={() => setConvertForm(null)}
          closeDisabled={busy}
        >
          <form className="space-y-5 p-5 sm:p-6" onSubmit={convert}>
            <div>
              <label className="label" htmlFor="convert-project-title">
                현장명
              </label>
              <input
                id="convert-project-title"
                className="field"
                value={convertForm.project_title}
                onChange={(event) =>
                  setConvertForm({
                    ...convertForm,
                    project_title: event.target.value,
                  })
                }
                autoFocus
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="convert-start-date">
                  공사 시작일
                </label>
                <input
                  id="convert-start-date"
                  className="field"
                  type="date"
                  onClick={showDatePicker}
                  value={convertForm.planned_start_date}
                  onChange={(event) =>
                    setConvertForm({
                      ...convertForm,
                      planned_start_date: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="convert-end-date">
                  공사 종료일
                </label>
                <input
                  id="convert-end-date"
                  className="field"
                  type="date"
                  onClick={showDatePicker}
                  min={convertForm.planned_start_date || undefined}
                  value={convertForm.planned_end_date}
                  onChange={(event) =>
                    setConvertForm({
                      ...convertForm,
                      planned_end_date: event.target.value,
                    })
                  }
                />
              </div>
            </div>
            {convertError && (
              <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {convertError}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-[#e5eae5] pt-5">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConvertForm(null)}
                disabled={busy}
              >
                취소
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                <CheckCircle2 size={16} />
                {busy ? "현장 생성 중…" : "현장 생성"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {estimateToApply && inquiry.converted_project_id && (
        <ConfirmModal
          title={`${estimateToApply.version}차 견적서를 현장에 적용할까요?`}
          description={`현재 ${won(mappedEstimate?.total_amount || 0)} → 변경 ${won(estimateToApply.total_amount)} · 증감 ${won(estimateToApply.total_amount - (mappedEstimate?.total_amount || 0))}`}
          confirmLabel={applyingEstimate ? "적용 중..." : "현장에 적용"}
          busy={applyingEstimate}
          onClose={() => {
            setEstimateToApply(null);
            setProjectActionError("");
          }}
          onConfirm={async () => {
            setApplyingEstimate(true);
            setProjectActionError("");
            try {
              await api.applyContractEstimate(
                inquiry.converted_project_id!,
                estimateToApply.id,
              );
              setMappedEstimateId(estimateToApply.id);
              setMessage(
                `${estimateToApply.version}차 견적서를 현장에 적용했습니다.`,
              );
              setEstimateToApply(null);
            } catch (error) {
              setProjectActionError(
                error instanceof Error
                  ? error.message
                  : "견적서를 현장에 적용하지 못했습니다.",
              );
            } finally {
              setApplyingEstimate(false);
            }
          }}
        >
          {projectActionError && (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {projectActionError}
            </p>
          )}
        </ConfirmModal>
      )}
      {lossReasonForm !== null && (
        <ConfirmModal
          title="미계약으로 처리할까요?"
          description="미계약 사유를 입력한 뒤 확인해 주세요."
          confirmLabel={busy ? "처리 중…" : "확인"}
          busy={busy}
          onClose={() => {
            setLossReasonForm(null);
            setStatusError("");
          }}
          onConfirm={() => saveStatus("LOST", lossReasonForm.trim())}
        >
          <label className="label" htmlFor="loss-reason">
            미계약 사유
          </label>
          <textarea
            id="loss-reason"
            className="field min-h-24 resize-y"
            value={lossReasonForm}
            onChange={(event) => setLossReasonForm(event.target.value)}
            placeholder="예: 예산 조율 실패, 일정 변경"
            autoFocus
          />
          {statusError && (
            <p className="mt-2 text-sm font-medium text-rose-700">
              {statusError}
            </p>
          )}
        </ConfirmModal>
      )}
      {deleteInquiryOpen && (
        <ConfirmModal
          title="견적 문의를 삭제할까요?"
          description="삭제한 견적 문의는 목록에서 더 이상 표시되지 않습니다."
          confirmLabel={busy ? "삭제 중…" : "삭제"}
          busy={busy}
          tone="danger"
          onClose={() => {
            setDeleteInquiryOpen(false);
            setDeleteInquiryError("");
          }}
          onConfirm={deleteInquiry}
        >
          {deleteInquiryError && (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {deleteInquiryError}
            </p>
          )}
        </ConfirmModal>
      )}
      {printing &&
        companySettings &&
        createPortal(
          <PrintEstimate
            inquiry={inquiry}
            estimate={printing}
            companySettings={companySettings}
          />,
          document.body,
        )}
    </>
  );
}

export default function EstimateInquiriesPage({
  onOpenProject,
  initialInquiryId,
  initialEstimateId,
  startNewVersion,
  applyProjectId,
}: {
  onOpenProject: (id: string) => void;
  initialInquiryId?: string;
  initialEstimateId?: string;
  startNewVersion?: boolean;
  applyProjectId?: string;
}) {
  const [items, setItems] = useState<EstimateInquiry[]>([]);
  const [stats, setStats] = useState<InquiryStats | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InquiryStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<EstimateInquiry | null>(null);
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const loadList = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: "6",
      });
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      const [list, summary] = await Promise.all([
        api.inquiries(`?${params}`),
        api.inquiryStats(),
      ]);
      setItems(list.items);
      setTotal(list.total);
      setStats(summary);
    } catch (e) {
      setItems([]);
      setTotal(0);
      setError(
        e instanceof Error ? e.message : "견적 문의를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(loadList, 180);
    return () => window.clearTimeout(timer);
  }, [page, query, status]);
  const open = async (id: string) => {
    setLoading(true);
    try {
      setSelected(await api.inquiry(id));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "상세 정보를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (initialInquiryId) void open(initialInquiryId);
  }, [initialInquiryId]);
  const reloadSelected = async () => {
    if (selected) setSelected(await api.inquiry(selected.id));
  };
  if (formMode)
    return (
      <InquiryForm
        inquiry={formMode === "edit" ? selected || undefined : undefined}
        onCancel={() => setFormMode(null)}
        onSaved={async (saved) => {
          setFormMode(null);
          setSelected(await api.inquiry(saved.id));
          await loadList();
        }}
      />
    );
  if (selected)
    return (
      <InquiryDetail
        key={`${selected.id}:${startNewVersion ? "new-version" : "detail"}:${initialEstimateId || "latest"}`}
        inquiry={selected}
        initialEstimateId={initialEstimateId}
        startNewVersion={startNewVersion}
        applyProjectId={applyProjectId}
        onBack={() => {
          setSelected(null);
          if (initialInquiryId)
            history.replaceState({}, "", "/admin/estimates");
          loadList();
        }}
        onEdit={() => setFormMode("edit")}
        onReload={reloadSelected}
        onDeleted={() => {
          setSelected(null);
          loadList();
        }}
        onOpenProject={onOpenProject}
      />
    );
  return (
    <div className="space-y-6 p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#758078]">공사 전 고객도 놓치지 않도록</p>
          <h2 className="mt-1 text-3xl font-bold text-[#1b3025]">
            견적·상담 관리
          </h2>
        </div>
        <button className="btn-primary" onClick={() => setFormMode("new")}>
          <UserRoundPlus size={17} /> 새 견적 문의
        </button>
      </div>
      {stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "신규 문의",
              value: stats.status_counts.NEW || 0,
              icon: UserRoundPlus,
              tone: "bg-blue-50 text-blue-700",
            },
            {
              label: "상담 예약",
              value: stats.status_counts.CONSULTATION_SCHEDULED || 0,
              icon: CalendarClock,
              tone: "bg-violet-50 text-violet-700",
            },
            {
              label: "계약 완료",
              value: stats.status_counts.CONTRACTED || 0,
              icon: CheckCircle2,
              tone: "bg-emerald-50 text-emerald-700",
            },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div className="panel p-4" key={label}>
              <div className={`inline-flex rounded-xl p-2 ${tone}`}>
                <Icon size={17} />
              </div>
              <p className="mt-3 text-[13px] font-semibold text-[#75827a]">
                {label}
              </p>
              <p className="mt-1 text-2xl font-bold text-[#18372b]">{value}</p>
            </div>
          ))}
        </div>
      )}
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-[#e8ece8] p-4">
          <div className="relative min-w-64 flex-1">
            <Search
              className="absolute left-3 top-3 text-[#8c9990]"
              size={16}
            />
            <input
              className="field pl-9"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="고객명, 연락처, 주소 검색"
            />
          </div>
          <DropdownSelect
            className="w-full sm:w-48"
            value={status}
            options={inquiryStatusFilterOptions}
            onChange={(value) => {
              setStatus(value as InquiryStatus | "");
              setPage(1);
            }}
            ariaLabel="견적 상담 상태 필터"
          />
        </div>
        {error && (
          <p className="m-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        {loading ? (
          <p className="p-8 text-center text-sm text-[#819087]">
            견적 문의를 불러오는 중입니다…
          </p>
        ) : items.length ? (
          <div>
            <div className="divide-y divide-[#edf0ed]">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => open(item.id)}
                  className="grid w-full gap-3 p-5 text-left transition hover:bg-[#fafbf9] md:grid-cols-[1.05fr_1fr_360px_150px_24px] md:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <b className="text-base text-[#264233]">
                        {item.customer_name}
                      </b>
                      <StatusPill status={item.status} />
                    </div>
                    <p className="mt-1 text-xs text-[#87938b]">
                      {item.customer_phone}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[#344b3d]">
                      {[item.address, item.address_detail]
                        .filter(Boolean)
                        .join(", ") || "주소 미등록"}
                    </p>
                    <p className="mt-1 text-xs text-[#8b978f]">
                      {pyeong(item.area_pyeong)} ·{" "}
                      {item.housing_type || "유형 미정"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <p className="text-xs text-[#8b978f]">상담 일정</p>
                      <p className="mt-1 text-sm font-semibold text-[#344b3d]">
                        {item.consultation_date
                          ? dateTimeText(item.consultation_date)
                          : "미정"}
                      </p>
                    </div>
                    <div>
                      {item.status === "CONSULTATION_SCHEDULED" && (
                        <>
                          <p className="text-xs text-[#8b978f]">상담 예약일</p>
                          <p className="mt-1 text-sm font-semibold text-violet-700">
                            {item.consultation_reserved_at
                              ? dateTimeText(item.consultation_reserved_at)
                              : "미정"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-[#8b978f]">견적</p>
                    <p className="mt-1 text-sm font-bold">
                      {item.latest_estimate
                        ? won(item.latest_estimate.total_amount)
                        : "미작성"}
                    </p>
                  </div>
                  <ChevronRight
                    size={17}
                    className="hidden text-[#93a098] md:block"
                  />
                </button>
              ))}
            </div>
            <div className="border-t border-[#edf0ed] px-3">
              <Pagination
                page={page}
                pageSize={6}
                total={total}
                loading={loading}
                onPageChange={setPage}
              />
            </div>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <FileText size={28} className="text-[#82a08c]" />
            <h3 className="mt-3 font-bold text-[#294534]">
              등록된 견적 문의가 없습니다
            </h3>
            <p className="mt-1 text-sm text-[#849188]">
              공사 여부와 관계없이 상담 고객부터 기록해 보세요.
            </p>
            <button
              className="btn-primary mt-5"
              onClick={() => setFormMode("new")}
            >
              <Plus size={15} /> 첫 문의 등록
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
