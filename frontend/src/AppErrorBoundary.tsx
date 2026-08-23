import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCcw } from "lucide-react";

import { reportAppError } from "./errors";

export default class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    reportAppError(
      error,
      "화면을 표시하는 중 문제가 발생해 작업을 계속할 수 없습니다.",
    );
  }

  render() {
    if (this.state.failed)
      return (
        <main className="grid min-h-screen place-items-center bg-[#f6f7f8] p-5">
          <section className="panel max-w-md p-8 text-center">
            <h1 className="text-xl font-bold text-[#24382d]">
              화면을 다시 불러와 주세요
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#596a60]">
              화면을 표시하는 중 일시적인 문제가 발생했습니다. 입력 중이던 내용은
              저장되지 않았을 수 있습니다.
            </p>
            <button
              type="button"
              className="btn-primary mt-6"
              onClick={() => window.location.reload()}
            >
              <RefreshCcw size={16} /> 화면 새로고침
            </button>
          </section>
        </main>
      );
    return this.props.children;
  }
}
