import type {
  MobileApiErrorResponse,
  MobilePost,
  MobilePostPayload,
  MobilePostResponse,
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

function isMobilePost(value: unknown): value is MobilePost {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "number" &&
    "title" in value &&
    typeof value.title === "string" &&
    "content" in value &&
    typeof value.content === "string" &&
    "published" in value &&
    typeof value.published === "boolean" &&
    "createdAt" in value &&
    typeof value.createdAt === "string" &&
    "updatedAt" in value &&
    typeof value.updatedAt === "string" &&
    "tags" in value &&
    Array.isArray(value.tags)
  );
}

function getApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL が設定されていません。");
  }

  return API_BASE_URL;
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

async function requestMobileApi(
  path: string,
  accessToken: string,
  options: Omit<RequestInit, "headers"> & {
    headers?: Record<string, string>;
  } = {},
) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  const data = await readJsonResponse(response);

  return { data, response };
}

export async function fetchMobilePosts(accessToken: string) {
  const { data, response } = await requestMobileApi(
    "/api/mobile/posts",
    accessToken,
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "メモ一覧の取得に失敗しました。"),
      response.status,
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("posts" in data) ||
    !Array.isArray(data.posts) ||
    !data.posts.every(isMobilePost)
  ) {
    throw new Error("メモ一覧のレスポンス形式が正しくありません。");
  }

  return (data as MobilePostsResponse).posts;
}

export async function fetchMobilePost(accessToken: string, postId: number) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}`,
    accessToken,
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "メモの取得に失敗しました。"),
      response.status,
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("post" in data) ||
    !isMobilePost(data.post)
  ) {
    throw new Error("メモ詳細のレスポンス形式が正しくありません。");
  }

  return (data as MobilePostResponse).post;
}

export async function createMobilePost(
  accessToken: string,
  payload: MobilePostPayload,
) {
  const { data, response } = await requestMobileApi(
    "/api/mobile/posts",
    accessToken,
    {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "メモの作成に失敗しました。"),
      response.status,
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("post" in data) ||
    !isMobilePost(data.post)
  ) {
    throw new Error("メモ作成のレスポンス形式が正しくありません。");
  }

  return (data as MobilePostResponse).post;
}

export async function updateMobilePost(
  accessToken: string,
  postId: number,
  payload: MobilePostPayload,
) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}`,
    accessToken,
    {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    },
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "メモの更新に失敗しました。"),
      response.status,
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("post" in data) ||
    !isMobilePost(data.post)
  ) {
    throw new Error("メモ更新のレスポンス形式が正しくありません。");
  }

  return (data as MobilePostResponse).post;
}

export async function deleteMobilePost(accessToken: string, postId: number) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}`,
    accessToken,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "メモの削除に失敗しました。"),
      response.status,
    );
  }
}
