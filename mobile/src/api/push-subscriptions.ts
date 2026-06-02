import type { MobileApiErrorResponse } from "../types/posts";
import { MobileApiRequestError } from "./posts";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

type PushPlatform = "android" | "ios" | "web" | "unknown";

type RegisterPushSubscriptionPayload = {
  deviceName?: string | null;
  expoPushToken: string;
  platform: PushPlatform;
};

function getApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL が設定されていません。");
  }

  return API_BASE_URL;
}

function isMobileApiErrorResponse(value: unknown): value is MobileApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  );
}

async function readJsonResponse(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function getErrorMessage(data: unknown, fallback: string) {
  return isMobileApiErrorResponse(data) ? data.error : fallback;
}

export async function registerMobilePushSubscription(
  accessToken: string,
  payload: RegisterPushSubscriptionPayload,
) {
  const response = await fetch(`${getApiBaseUrl()}/api/mobile/push-subscriptions`, {
    body: JSON.stringify(payload),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "Push Tokenの登録に失敗しました。"),
      response.status,
    );
  }
}

export async function revokeMobilePushSubscription(
  accessToken: string,
  expoPushToken?: string | null,
) {
  const response = await fetch(`${getApiBaseUrl()}/api/mobile/push-subscriptions`, {
    body: JSON.stringify(expoPushToken ? { expoPushToken } : {}),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "DELETE",
  });
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "Push Tokenの無効化に失敗しました。"),
      response.status,
    );
  }
}

export async function sendMobileTestPush(accessToken: string) {
  const response = await fetch(
    `${getApiBaseUrl()}/api/mobile/push-subscriptions/test`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      method: "POST",
    },
  );
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "テスト通知の送信に失敗しました。"),
      response.status,
    );
  }
}
