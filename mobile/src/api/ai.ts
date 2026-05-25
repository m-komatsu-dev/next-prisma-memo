import type {
  MobileAiGenerateResponse,
  MobileAiMode,
  MobileApiErrorResponse,
} from "../types/posts";
import { MobileApiRequestError } from "./posts";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

function isMobileApiErrorResponse(value: unknown): value is MobileApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  );
}

function isMobileAiGenerateResponse(
  value: unknown,
): value is MobileAiGenerateResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "result" in value &&
    typeof value.result === "string"
  );
}

function getApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL が設定されていません。");
  }

  return API_BASE_URL;
}

export async function generateMobileAiContent(
  accessToken: string,
  content: string,
  mode: MobileAiMode,
) {
  const response = await fetch(`${getApiBaseUrl()}/api/mobile/ai/generate`, {
    body: JSON.stringify({ content, mode }),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : isMobileApiErrorResponse(data)
          ? data.error
          : "AI生成に失敗しました。",
      response.status,
    );
  }

  if (!isMobileAiGenerateResponse(data)) {
    throw new Error("AI生成のレスポンス形式が正しくありません。");
  }

  return data.result;
}
