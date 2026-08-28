export const APP_ERROR_EVENT = "interior:app-error";

type ApiErrorOptions = {
  status: number;
  detail?: unknown;
  path: string;
  method: string;
};

export class ApiError extends Error {
  status: number;
  detail?: unknown;
  path: string;
  method: string;

  constructor(message: string, options: ApiErrorOptions) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.detail = options.detail;
    this.path = options.path;
    this.method = options.method;
  }
}

export type UserFacingError = {
  title: string;
  message: string;
  suggestion: string;
  operation?: string;
  reference?: string;
  action?: "LOGIN";
};

const operationName = (path: string, method: string) => {
  const action =
    method === "GET"
      ? "불러오기"
      : method === "POST"
        ? "등록"
        : method === "DELETE"
          ? "삭제"
          : "저장";
  if (path.includes("/auth/login")) return "로그인";
  if (path.includes("/company-settings")) return `업체 정보 ${action}`;
  if (path.includes("/estimates")) return `견적서 ${action}`;
  if (path.includes("/estimate-inquiries")) return `견적 문의 ${action}`;
  if (path.includes("/payments")) return `입금 내역 ${action}`;
  if (path.includes("/costs")) return `공사 금액 ${action}`;
  if (path.includes("/images")) return `사진 ${action}`;
  if (path.includes("/maps/")) return "주소 확인";
  if (path.includes("/simulations") || path.includes("/versions"))
    return `공간 시뮬레이션 ${action}`;
  if (path.includes("/materials")) return `자재 정보 ${action}`;
  if (path.includes("/scans") || path.includes("/ai/"))
    return `AI 분석 작업 ${action}`;
  if (path.includes("/projects")) return `현장 정보 ${action}`;
  return `정보 ${action}`;
};

const fieldNames: Record<string, string> = {
  customer_name: "고객명",
  customer_phone: "고객 연락처",
  address: "주소",
  title: "제목",
  name: "이름",
  supply_amount: "공급가액",
  vat_amount: "부가세",
  paid_at: "입금일",
  planned_start_date: "공사 시작일",
  planned_end_date: "공사 종료일",
  project_type: "공사 구분",
  password: "비밀번호",
  username: "아이디",
  file: "파일",
};

const validationMessage = (detail: unknown) => {
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (!Array.isArray(detail)) return "";
  const messages = detail
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const record = item as { loc?: unknown; msg?: unknown; type?: unknown };
      const locationParts = Array.isArray(record.loc)
        ? record.loc.filter((part) => part !== "body")
        : [];
      const field = String(locationParts.at(-1) || "입력 항목");
      const label = fieldNames[field] || field;
      const type = typeof record.type === "string" ? record.type : "";
      if (type === "missing") return `${label} 항목을 입력해 주세요.`;
      if (type.includes("greater_than")) return `${label}은(는) 0보다 큰 값으로 입력해 주세요.`;
      if (type.includes("less_than")) return `${label}에 입력한 값이 너무 큽니다.`;
      if (type.includes("date") || type.includes("datetime"))
        return `${label}의 날짜 형식을 확인해 주세요.`;
      if (type.includes("string_too_long")) return `${label}의 내용을 조금 줄여 주세요.`;
      if (type.includes("uuid")) return "선택한 정보가 올바르지 않습니다. 목록에서 다시 선택해 주세요.";
      return `${label}에 입력한 내용을 확인해 주세요.`;
    })
    .filter(Boolean);
  return messages.length
    ? messages.slice(0, 3).join(" / ")
    : "";
};

export function toUserFacingError(
  error: unknown,
  fallback = "요청한 작업을 완료하지 못했습니다.",
): UserFacingError {
  if (error instanceof ApiError) {
    const operation = operationName(error.path, error.method);
    const rawServerMessage = validationMessage(error.detail);
    const serverMessage = /[가-힣]/.test(rawServerMessage)
      ? rawServerMessage
      : "";
    const reference = error.status ? `HTTP ${error.status}` : "NETWORK";

    if (error.status === 0)
      return {
        title: "서버에 연결할 수 없습니다",
        message: "인터넷 연결이 끊겼거나 서버가 잠시 응답하지 않고 있습니다.",
        suggestion: "인터넷 연결을 확인한 뒤 잠시 후 다시 시도해 주세요.",
        operation,
        reference,
      };
    if (error.status === 401 && error.path.includes("/auth/login"))
      return {
        title: "로그인할 수 없습니다",
        message: "아이디 또는 비밀번호가 올바르지 않습니다.",
        suggestion: "입력한 아이디와 비밀번호를 다시 확인해 주세요.",
        operation,
        reference,
      };
    if (error.status === 401)
      return {
        title: "로그인이 만료되었습니다",
        message: "안전한 사용을 위해 로그인 시간이 종료되었습니다.",
        suggestion: "다시 로그인한 뒤 같은 작업을 진행해 주세요.",
        operation,
        reference,
        action: "LOGIN",
      };
    if (error.status === 403)
      return {
        title: "이 작업을 진행할 수 없습니다",
        message: "현재 계정에는 이 작업을 할 수 있는 권한이 없습니다.",
        suggestion: "관리자 계정으로 로그인했는지 확인하거나 담당자에게 문의해 주세요.",
        operation,
        reference,
      };
    if (error.status === 404)
      return {
        title: "요청한 정보를 찾을 수 없습니다",
        message: serverMessage || "정보가 삭제되었거나 위치가 변경되었을 수 있습니다.",
        suggestion: "목록을 새로고침한 뒤 다시 선택해 주세요.",
        operation,
        reference,
      };
    if (error.status === 409)
      return {
        title: "현재 상태에서는 처리할 수 없습니다",
        message: serverMessage,
        suggestion: "화면을 새로고침해 최신 상태를 확인한 뒤 다시 시도해 주세요.",
        operation,
        reference,
      };
    if (error.status === 413)
      return {
        title: "파일 용량이 너무 큽니다",
        message: "선택한 파일이 업로드 가능한 크기를 초과했습니다.",
        suggestion: "파일 크기를 줄이거나 여러 번 나누어 업로드해 주세요.",
        operation,
        reference,
      };
    if (error.status === 422 || error.status === 400)
      return {
        title: "입력 내용을 확인해 주세요",
        message: serverMessage || "입력한 내용 중 확인이 필요한 항목이 있습니다.",
        suggestion: "표시된 내용을 확인하고 잘못 입력된 항목을 수정해 주세요.",
        operation,
        reference,
      };
    if (error.status === 429)
      return {
        title: "요청이 너무 많습니다",
        message: "짧은 시간에 같은 작업이 여러 번 요청되었습니다.",
        suggestion: "잠시 기다린 뒤 한 번만 다시 시도해 주세요.",
        operation,
        reference,
      };
    if (error.status >= 500)
      return {
        title: "서비스에서 작업을 처리하지 못했습니다",
        message: "입력한 내용의 문제가 아니라 서버에서 일시적인 문제가 발생했습니다.",
        suggestion: "잠시 후 다시 시도해 주세요. 계속 발생하면 관리자에게 알려주세요.",
        operation,
        reference,
      };
    return {
      title: "작업을 완료하지 못했습니다",
      message: serverMessage || fallback,
      suggestion: "입력 내용과 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
      operation,
      reference,
    };
  }

  return {
    title: "작업 중 문제가 발생했습니다",
    message:
      error instanceof Error && /[가-힣]/.test(error.message)
        ? error.message
        : fallback,
    suggestion: "잠시 후 다시 시도해 주세요. 같은 문제가 계속되면 관리자에게 알려주세요.",
  };
}

let lastErrorKey = "";
let lastErrorAt = 0;

export function reportAppError(error: unknown, fallback?: string) {
  const detail = toUserFacingError(error, fallback);
  const key = `${detail.title}|${detail.message}|${detail.operation || ""}`;
  const now = Date.now();
  if (key === lastErrorKey && now - lastErrorAt < 1500) return;
  lastErrorKey = key;
  lastErrorAt = now;
  window.dispatchEvent(
    new CustomEvent<UserFacingError>(APP_ERROR_EVENT, { detail }),
  );
}
