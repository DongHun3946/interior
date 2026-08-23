import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import Modal from "./Modal";
import {
  APP_ERROR_EVENT,
  reportAppError,
  type UserFacingError,
} from "./errors";

export default function AppErrorModal() {
  const [error, setError] = useState<UserFacingError | null>(null);

  useEffect(() => {
    const showError = (event: Event) => {
      setError((event as CustomEvent<UserFacingError>).detail);
    };
    const showUnhandledError = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      reportAppError(
        event.reason,
        "예상하지 못한 문제로 작업을 완료하지 못했습니다.",
      );
    };
    const showWindowError = (event: ErrorEvent) => {
      reportAppError(
        event.error,
        "화면을 처리하는 중 예상하지 못한 문제가 발생했습니다.",
      );
    };
    window.addEventListener(APP_ERROR_EVENT, showError);
    window.addEventListener("unhandledrejection", showUnhandledError);
    window.addEventListener("error", showWindowError);
    return () => {
      window.removeEventListener(APP_ERROR_EVENT, showError);
      window.removeEventListener("unhandledrejection", showUnhandledError);
      window.removeEventListener("error", showWindowError);
    };
  }, []);

  if (!error) return null;

  const close = () => {
    if (error.action === "LOGIN") {
      localStorage.removeItem("interior_token");
      window.location.assign("/admin");
      return;
    }
    setError(null);
  };

  return (
    <Modal
      title={error.title}
      onClose={close}
      maxWidthClass="max-w-md"
    >
      <div className="border-t border-[#e7ebe8] px-5 py-4">
        <div className="flex gap-3 rounded-xl bg-[#fff5f3] p-4">
          <AlertTriangle className="mt-0.5 shrink-0 text-[#b8493f]" size={21} />
          <div>
            <p className="text-[15px] font-semibold leading-6 text-[#4a302d]">
              {error.message}
            </p>
            <p className="mt-1 text-sm leading-6 text-[#6b514d]">
              {error.suggestion}
            </p>
          </div>
        </div>
      </div>
      <div className="flex justify-end border-t border-[#e7ebe8] bg-[#fafbfa] px-5 py-4">
        <button
          type="button"
          className="btn-primary min-w-24"
          onClick={close}
          autoFocus
        >
          {error.action === "LOGIN" ? "다시 로그인" : "확인"}
        </button>
      </div>
    </Modal>
  );
}
