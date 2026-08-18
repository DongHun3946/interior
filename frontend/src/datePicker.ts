import type { MouseEvent } from "react";

export function showDatePicker(event: MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker?.();
  } catch {
    // 브라우저 기본 입력 동작은 그대로 사용할 수 있습니다.
  }
}
