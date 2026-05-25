import type { MobileLoginResponse } from "../types/auth";
import type { MobileApiErrorResponse } from "../types/posts";
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

function isMobileLoginResponse(value: unknown): value is MobileLoginResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "accessToken" in value &&
    typeof value.accessToken === "string" &&
    "user" in value &&
    typeof value.user === "object" &&
    value.user !== null &&
    "id" in value.user &&
    typeof value.user.id === "string"
  );
}

export async function loginWithEmailPassword(email: string, password: string) {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL が設定されていません。");
  }

  const response = await fetch(`${API_BASE_URL}/api/mobile/auth/login`, {
    body: JSON.stringify({ email, password }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const data = (await response.json()) as unknown;

  if (!response.ok) {
    throw new MobileApiRequestError(
      isMobileApiErrorResponse(data)
        ? data.error
        : "ログインに失敗しました。",
      response.status,
    );
  }

  if (!isMobileLoginResponse(data)) {
    throw new Error("ログインレスポンスの形式が正しくありません。");
  }

  return data;
}

export async function deleteMobileAccount(accessToken: string) {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL が設定されていません。");
  }

  const response = await fetch(`${API_BASE_URL}/api/mobile/account`, {
    body: JSON.stringify({ confirmed: true }),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "DELETE",
  });

  const data = (await response.json()) as unknown;

  if (!response.ok) {
    throw new MobileApiRequestError(
      isMobileApiErrorResponse(data)
        ? data.error
        : "アカウント削除に失敗しました。",
      response.status,
    );
  }
}
