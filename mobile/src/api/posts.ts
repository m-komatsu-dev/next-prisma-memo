import type {
  MobileApiErrorResponse,
  MobilePostsResponse,
} from "../types/posts";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export class MobileApiRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MobileApiRequestError";
  }
}

function isMobileApiErrorResponse(value: unknown): value is MobileApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  );
}

export async function fetchMobilePosts() {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL が設定されていません。");
  }

  const response = await fetch(`${API_BASE_URL}/api/mobile/posts`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  const data = (await response.json()) as unknown;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : isMobileApiErrorResponse(data)
          ? data.error
          : "メモ一覧の取得に失敗しました。",
      response.status,
    );
  }

  if (typeof data !== "object" || data === null || !("posts" in data)) {
    throw new Error("メモ一覧のレスポンス形式が正しくありません。");
  }

  return (data as MobilePostsResponse).posts;
}
