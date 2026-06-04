import type { KeyboardEvent } from "react";

export type TodoActionState = {
  message?: string;
  success: boolean;
};

export const initialTodoActionState: TodoActionState = { success: true };

export function buildTodoFormData(
  values: Record<string, number | string | null>,
) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value === null ? "" : String(value));
  }

  return formData;
}

export function isComposingEnter(event: KeyboardEvent<HTMLInputElement>) {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

export function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}
