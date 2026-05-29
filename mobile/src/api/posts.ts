import type {
  MobileApiErrorResponse,
  MobileCrossMemoTodoItem,
  MobileCrossMemoTodoItemsResponse,
  MobilePost,
  MobilePostPayload,
  MobilePostResponse,
  MobilePostShare,
  MobilePostShareResponse,
  MobilePostSharesResponse,
  MobilePostShareRole,
  MobilePostsResponse,
  MobileTodoItem,
  MobileTodoItemPayload,
  MobileTodoItemResponse,
  MobileTodoItemsResponse,
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
    "accessRole" in value &&
    (value.accessRole === "owner" ||
      value.accessRole === "editor" ||
      value.accessRole === "viewer" ||
      value.accessRole === "public") &&
    "authorId" in value &&
    typeof value.authorId === "string" &&
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
    Array.isArray(value.tags) &&
    (!("todoItems" in value) || (Array.isArray(value.todoItems) && value.todoItems.every(isMobileTodoItem)))
  );
}

function isMobileTodoItem(value: unknown): value is MobileTodoItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "completed" in value &&
    typeof value.completed === "boolean" &&
    "createdAt" in value &&
    typeof value.createdAt === "string" &&
    "dueAt" in value &&
    (typeof value.dueAt === "string" || value.dueAt === null) &&
    "id" in value &&
    typeof value.id === "number" &&
    "position" in value &&
    typeof value.position === "number" &&
    "postId" in value &&
    typeof value.postId === "number" &&
    "reminderAt" in value &&
    (typeof value.reminderAt === "string" || value.reminderAt === null) &&
    "reminderSentAt" in value &&
    (typeof value.reminderSentAt === "string" || value.reminderSentAt === null) &&
    "text" in value &&
    typeof value.text === "string" &&
    "updatedAt" in value &&
    typeof value.updatedAt === "string"
  );
}

function isMobileCrossMemoTodoItem(
  value: unknown,
): value is MobileCrossMemoTodoItem {
  return (
    isMobileTodoItem(value) &&
    "canEdit" in value &&
    typeof value.canEdit === "boolean" &&
    "postTitle" in value &&
    typeof value.postTitle === "string"
  );
}

function isMobilePostShare(value: unknown): value is MobilePostShare {
  return (
    typeof value === "object" &&
    value !== null &&
    "email" in value &&
    typeof value.email === "string" &&
    "id" in value &&
    typeof value.id === "number" &&
    "name" in value &&
    (typeof value.name === "string" || value.name === null) &&
    "role" in value &&
    (value.role === "viewer" || value.role === "editor") &&
    "userId" in value &&
    typeof value.userId === "string"
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

export async function fetchMobileTodoItems(accessToken: string, postId: number) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}/todos`,
    accessToken,
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "Todoの取得に失敗しました。"),
      response.status,
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("todoItems" in data) ||
    !Array.isArray(data.todoItems) ||
    !data.todoItems.every(isMobileTodoItem)
  ) {
    throw new Error("Todo一覧のレスポンス形式が正しくありません。");
  }

  return (data as MobileTodoItemsResponse).todoItems;
}

export async function fetchMobileAllTodos(accessToken: string) {
  const { data, response } = await requestMobileApi(
    "/api/mobile/todos",
    accessToken,
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "Todo一覧の取得に失敗しました。"),
      response.status,
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("todos" in data) ||
    !Array.isArray(data.todos) ||
    !data.todos.every(isMobileCrossMemoTodoItem)
  ) {
    throw new Error("Todo一覧のレスポンス形式が正しくありません。");
  }

  return (data as MobileCrossMemoTodoItemsResponse).todos;
}

export async function fetchMobileTodoCalendar(accessToken: string) {
  const { data, response } = await requestMobileApi(
    "/api/mobile/todos/calendar",
    accessToken,
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "Todoカレンダーの取得に失敗しました。"),
      response.status,
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("todos" in data) ||
    !Array.isArray(data.todos) ||
    !data.todos.every(isMobileCrossMemoTodoItem)
  ) {
    throw new Error("Todoカレンダーのレスポンス形式が正しくありません。");
  }

  return (data as MobileCrossMemoTodoItemsResponse).todos;
}

export async function createMobileTodoItem(
  accessToken: string,
  postId: number,
  payload: { dueAt?: string | null; reminderAt?: string | null; text: string },
) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}/todos`,
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
        : getErrorMessage(data, "Todoの追加に失敗しました。"),
      response.status,
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("todoItem" in data) ||
    !isMobileTodoItem(data.todoItem)
  ) {
    throw new Error("Todo追加のレスポンス形式が正しくありません。");
  }

  return (data as MobileTodoItemResponse).todoItem;
}

export async function updateMobileTodoItem(
  accessToken: string,
  postId: number,
  todoItemId: number,
  payload: MobileTodoItemPayload,
) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}/todos/${todoItemId}`,
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
        : getErrorMessage(data, "Todoの更新に失敗しました。"),
      response.status,
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("todoItem" in data) ||
    !isMobileTodoItem(data.todoItem)
  ) {
    throw new Error("Todo更新のレスポンス形式が正しくありません。");
  }

  return (data as MobileTodoItemResponse).todoItem;
}

export async function deleteMobileTodoItem(
  accessToken: string,
  postId: number,
  todoItemId: number,
) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}/todos/${todoItemId}`,
    accessToken,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "Todoの削除に失敗しました。"),
      response.status,
    );
  }
}

export async function fetchMobilePostShares(accessToken: string, postId: number) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}/shares`,
    accessToken,
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "共有設定の取得に失敗しました。"),
      response.status,
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("shares" in data) ||
    !Array.isArray(data.shares) ||
    !data.shares.every(isMobilePostShare)
  ) {
    throw new Error("共有設定のレスポンス形式が正しくありません。");
  }

  return (data as MobilePostSharesResponse).shares;
}

export async function createMobilePostShare(
  accessToken: string,
  postId: number,
  payload: { email: string; role: MobilePostShareRole },
) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}/shares`,
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
        : getErrorMessage(data, "共有設定の追加に失敗しました。"),
      response.status,
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("share" in data) ||
    !isMobilePostShare(data.share)
  ) {
    throw new Error("共有設定追加のレスポンス形式が正しくありません。");
  }

  return (data as MobilePostShareResponse).share;
}

export async function updateMobilePostShare(
  accessToken: string,
  postId: number,
  shareId: number,
  role: MobilePostShareRole,
) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}/shares/${shareId}`,
    accessToken,
    {
      body: JSON.stringify({ role }),
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
        : getErrorMessage(data, "共有権限の更新に失敗しました。"),
      response.status,
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("share" in data) ||
    !isMobilePostShare(data.share)
  ) {
    throw new Error("共有権限更新のレスポンス形式が正しくありません。");
  }

  return (data as MobilePostShareResponse).share;
}

export async function deleteMobilePostShare(
  accessToken: string,
  postId: number,
  shareId: number,
) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}/shares/${shareId}`,
    accessToken,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "共有解除に失敗しました。"),
      response.status,
    );
  }
}
