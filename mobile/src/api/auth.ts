import type { MobileLoginResponse, MobileTokenResponse } from "../types/auth";
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
    "refreshToken" in value &&
    typeof value.refreshToken === "string" &&
    "user" in value &&
    typeof value.user === "object" &&
    value.user !== null &&
    "id" in value.user &&
    typeof value.user.id === "string"
  );
}

function isMobileTokenResponse(value: unknown): value is MobileTokenResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "accessToken" in value &&
    typeof value.accessToken === "string" &&
    "refreshToken" in value &&
    typeof value.refreshToken === "string"
  );
}

function getApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL が設定されていません。");
  }

  return API_BASE_URL;
}

export async function loginWithEmailPassword(email: string, password: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/mobile/auth/login`, {
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

export async function refreshMobileTokens(refreshToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/mobile/auth/refresh`, {
    body: JSON.stringify({ refreshToken }),
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
        : "ログイン情報の更新に失敗しました。",
      response.status,
    );
  }

  if (!isMobileTokenResponse(data)) {
    throw new Error("トークン更新レスポンスの形式が正しくありません。");
  }

  return data;
}

export async function exchangeMobileOAuthCode(code: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/mobile/oauth/exchange`, {
    body: JSON.stringify({ code }),
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
        : "OAuthログインに失敗しました。",
      response.status,
    );
  }

  if (!isMobileTokenResponse(data)) {
    throw new Error("OAuthログインレスポンスの形式が正しくありません。");
  }

  return data;
}

export async function logoutMobileSession(refreshToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/mobile/auth/logout`, {
    body: JSON.stringify({ refreshToken }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new MobileApiRequestError(
      isMobileApiErrorResponse(data)
        ? data.error
        : "ログアウトに失敗しました。",
      response.status,
    );
  }
}

export async function deleteMobileAccount(accessToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/mobile/account`, {
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
