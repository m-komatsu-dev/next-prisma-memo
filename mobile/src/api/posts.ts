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

type MobileApiResponse = {
  bodyPreview: string;
  contentType: string | null;
  data: unknown;
  endpoint: string;
  response: Response;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMobileApiErrorResponse(value: unknown): value is MobileApiErrorResponse {
  return (
    isRecord(value) &&
    "error" in value &&
    typeof value.error === "string"
  );
}

function isMobilePost(value: unknown): value is MobilePost {
  return (
    isRecord(value) &&
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

function isMobilePostAccessRole(
  value: unknown,
): value is MobilePost["accessRole"] {
  return (
    value === "owner" ||
    value === "editor" ||
    value === "viewer" ||
    value === "public"
  );
}

function isMobileTodoItem(value: unknown): value is MobileTodoItem {
  return (
    isRecord(value) &&
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

function normalizeDateString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeNullableDateString(value: unknown) {
  return typeof value === "string" || value === null ? value : null;
}

function normalizeMobileTodoItem(value: unknown): MobileTodoItem | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    typeof value.text !== "string"
  ) {
    return null;
  }

  return {
    completed: typeof value.completed === "boolean" ? value.completed : false,
    createdAt: normalizeDateString(value.createdAt),
    dueAt: normalizeNullableDateString(value.dueAt),
    id: value.id,
    position: typeof value.position === "number" ? value.position : 0,
    postId: typeof value.postId === "number" ? value.postId : 0,
    reminderAt: normalizeNullableDateString(value.reminderAt),
    reminderSentAt: normalizeNullableDateString(value.reminderSentAt),
    text: value.text,
    updatedAt: normalizeDateString(value.updatedAt),
  };
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

function normalizeMobilePostTags(value: unknown): MobilePost["tags"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((tag, index) => {
    if (typeof tag === "string") {
      return [{ id: index, name: tag }];
    }

    if (
      isRecord(tag) &&
      typeof tag.id === "number" &&
      typeof tag.name === "string"
    ) {
      return [{ id: tag.id, name: tag.name }];
    }

    return [];
  });
}

function normalizeMobilePost(value: unknown): MobilePost | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    typeof value.title !== "string" ||
    typeof value.content !== "string"
  ) {
    return null;
  }

  return {
    accessRole: isMobilePostAccessRole(value.accessRole)
      ? value.accessRole
      : "owner",
    authorId: typeof value.authorId === "string" ? value.authorId : "",
    content: value.content,
    createdAt: normalizeDateString(value.createdAt),
    id: value.id,
    published: typeof value.published === "boolean" ? value.published : false,
    tags: normalizeMobilePostTags(value.tags),
    title: value.title,
    todoItems: Array.isArray(value.todoItems)
      ? value.todoItems.flatMap((todoItem) => {
          const normalizedTodoItem = normalizeMobileTodoItem(todoItem);
          return normalizedTodoItem ? [normalizedTodoItem] : [];
        })
      : [],
    updatedAt: normalizeDateString(value.updatedAt),
  };
}

function normalizeMobileCrossMemoTodoItem(
  value: unknown,
): MobileCrossMemoTodoItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const todoItem = normalizeMobileTodoItem(value);

  if (!todoItem) {
    return null;
  }

  return {
    ...todoItem,
    canEdit: typeof value.canEdit === "boolean" ? value.canEdit : true,
    postTitle: typeof value.postTitle === "string" ? value.postTitle : "",
  };
}

function normalizePostTodoItem(
  todoItem: MobileTodoItem,
  post: MobilePost,
): MobileCrossMemoTodoItem {
  return {
    ...todoItem,
    canEdit: post.accessRole === "owner" || post.accessRole === "editor",
    postId: todoItem.postId || post.id,
    postTitle: post.title,
  };
}

function isMobilePostShare(value: unknown): value is MobilePostShare {
  return (
    isRecord(value) &&
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
  const baseUrl = API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL が設定されていません。");
  }

  return baseUrl.replace(/\/+$/, "");
}

function getBodyPreview(body: string) {
  return body
    .replace(/"accessToken"\s*:\s*"[^"]*"/gi, '"accessToken":"[redacted]"')
    .replace(/"refreshToken"\s*:\s*"[^"]*"/gi, '"refreshToken":"[redacted]"')
    .replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"[redacted]"')
    .replace(/"secret"\s*:\s*"[^"]*"/gi, '"secret":"[redacted]"')
    .replace(/"DATABASE_URL"\s*:\s*"[^"]*"/gi, '"DATABASE_URL":"[redacted]"')
    .replace(/"AUTH_SECRET"\s*:\s*"[^"]*"/gi, '"AUTH_SECRET":"[redacted]"')
    .replace(/"CRON_SECRET"\s*:\s*"[^"]*"/gi, '"CRON_SECRET":"[redacted]"')
    .replace(/"expoPushToken"\s*:\s*"[^"]*"/gi, '"expoPushToken":"[redacted]"')
    .slice(0, 200);
}

function parseJsonResponse(body: string) {
  if (!body.trim()) {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
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
): Promise<MobileApiResponse> {
  const endpoint = `${getApiBaseUrl()}${path}`;
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  const body = await response.text();

  return {
    bodyPreview: getBodyPreview(body),
    contentType: response.headers.get("content-type"),
    data: parseJsonResponse(body),
    endpoint,
    response,
  };
}

function getResponseFormatError(
  label: string,
  { bodyPreview, contentType, endpoint, response }: MobileApiResponse,
) {
  return new Error(
    `${label}のレスポンス形式が正しくありません。 endpoint=${endpoint} status=${response.status} content-type=${contentType ?? "unknown"} body=${bodyPreview || "(empty)"}`,
  );
}

function readDirectArray<T>(
  data: unknown,
  isItem: (value: unknown) => value is T,
) {
  if (!Array.isArray(data)) {
    return null;
  }

  return data.every(isItem) ? data : null;
}

function readArrayField<T>(
  data: unknown,
  fieldName: string,
  isItem: (value: unknown) => value is T,
) {
  if (!isRecord(data) || !(fieldName in data) || !Array.isArray(data[fieldName])) {
    return null;
  }

  return data[fieldName].every(isItem) ? data[fieldName] : null;
}

function readObjectField<T>(
  data: unknown,
  fieldName: string,
  isItem: (value: unknown) => value is T,
) {
  if (!isRecord(data) || !(fieldName in data)) {
    return null;
  }

  return isItem(data[fieldName]) ? data[fieldName] : null;
}

function readDirectNormalizedArray<T>(
  data: unknown,
  normalize: (value: unknown) => T | null,
) {
  if (!Array.isArray(data)) {
    return null;
  }

  const normalizedItems = data.flatMap((item) => {
    const normalizedItem = normalize(item);
    return normalizedItem ? [normalizedItem] : [];
  });

  return normalizedItems.length === data.length ? normalizedItems : null;
}

function readNormalizedArrayField<T>(
  data: unknown,
  fieldName: string,
  normalize: (value: unknown) => T | null,
) {
  if (!isRecord(data) || !(fieldName in data) || !Array.isArray(data[fieldName])) {
    return null;
  }

  return readDirectNormalizedArray(data[fieldName], normalize);
}

function readNormalizedObjectField<T>(
  data: unknown,
  fieldName: string,
  normalize: (value: unknown) => T | null,
) {
  if (!isRecord(data) || !(fieldName in data)) {
    return null;
  }

  return normalize(data[fieldName]);
}

async function fetchMobilePostsForFallback(accessToken: string) {
  const apiResponse = await requestMobileApi(
    "/api/mobile/posts",
    accessToken,
  );
  const { data, response } = apiResponse;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "メモ一覧の取得に失敗しました。"),
      response.status,
    );
  }

  const posts =
    readNormalizedArrayField(data, "posts", normalizeMobilePost) ??
    readNormalizedArrayField(data, "data", normalizeMobilePost) ??
    readDirectNormalizedArray(data, normalizeMobilePost);

  if (!posts) {
    throw getResponseFormatError("メモ一覧", apiResponse);
  }

  return posts as MobilePostsResponse["posts"];
}

async function fetchMobileTodosFromPosts(accessToken: string, onlyWithDueAt: boolean) {
  const posts = await fetchMobilePostsForFallback(accessToken);

  return posts
    .flatMap((post) =>
      (post.todoItems ?? []).map((todoItem) =>
        normalizePostTodoItem(todoItem, post),
      ),
    )
    .filter((todoItem) => !onlyWithDueAt || Boolean(todoItem.dueAt));
}

export async function fetchMobilePosts(accessToken: string) {
  return fetchMobilePostsForFallback(accessToken);
}

export async function fetchMobilePost(accessToken: string, postId: number) {
  const apiResponse = await requestMobileApi(
    `/api/mobile/posts/${postId}`,
    accessToken,
  );
  const { data, response } = apiResponse;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "メモの取得に失敗しました。"),
      response.status,
    );
  }

  const post =
    readNormalizedObjectField(data, "post", normalizeMobilePost) ??
    readNormalizedObjectField(data, "data", normalizeMobilePost);

  if (!post) {
    throw getResponseFormatError("メモ詳細", apiResponse);
  }

  return post as MobilePostResponse["post"];
}

export async function createMobilePost(
  accessToken: string,
  payload: MobilePostPayload,
) {
  const apiResponse = await requestMobileApi(
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
  const { data, response } = apiResponse;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "メモの作成に失敗しました。"),
      response.status,
    );
  }

  const post =
    readNormalizedObjectField(data, "post", normalizeMobilePost) ??
    readNormalizedObjectField(data, "data", normalizeMobilePost);

  if (!post) {
    throw getResponseFormatError("メモ作成", apiResponse);
  }

  return post as MobilePostResponse["post"];
}

export async function updateMobilePost(
  accessToken: string,
  postId: number,
  payload: MobilePostPayload,
) {
  const apiResponse = await requestMobileApi(
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
  const { data, response } = apiResponse;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "メモの更新に失敗しました。"),
      response.status,
    );
  }

  const post =
    readNormalizedObjectField(data, "post", normalizeMobilePost) ??
    readNormalizedObjectField(data, "data", normalizeMobilePost);

  if (!post) {
    throw getResponseFormatError("メモ更新", apiResponse);
  }

  return post as MobilePostResponse["post"];
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
  const apiResponse = await requestMobileApi(
    `/api/mobile/posts/${postId}/todos`,
    accessToken,
  );
  const { data, response } = apiResponse;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "Todoの取得に失敗しました。"),
      response.status,
    );
  }

  const todos =
    readNormalizedArrayField(data, "todos", normalizeMobileTodoItem) ??
    readNormalizedArrayField(data, "todoItems", normalizeMobileTodoItem) ??
    readNormalizedArrayField(data, "data", normalizeMobileTodoItem) ??
    readDirectNormalizedArray(data, normalizeMobileTodoItem);

  if (!todos) {
    const posts = await fetchMobilePostsForFallback(accessToken);
    const post = posts.find((currentPost) => currentPost.id === postId);

    if (post) {
      return post.todoItems ?? [];
    }

    throw getResponseFormatError("Todo一覧", apiResponse);
  }

  return todos as MobileTodoItemsResponse["todos"];
}

export async function fetchMobileAllTodos(accessToken: string) {
  const apiResponse = await requestMobileApi(
    "/api/mobile/todos",
    accessToken,
  );
  const { data, response } = apiResponse;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "Todo一覧の取得に失敗しました。"),
      response.status,
    );
  }

  const todos =
    readNormalizedArrayField(data, "todos", normalizeMobileCrossMemoTodoItem) ??
    readNormalizedArrayField(data, "data", normalizeMobileCrossMemoTodoItem) ??
    readDirectNormalizedArray(data, normalizeMobileCrossMemoTodoItem);

  if (!todos) {
    return fetchMobileTodosFromPosts(accessToken, false);
  }

  return todos as MobileCrossMemoTodoItemsResponse["todos"];
}

export async function fetchMobileTodoCalendar(accessToken: string) {
  const apiResponse = await requestMobileApi(
    "/api/mobile/todos/calendar",
    accessToken,
  );
  const { data, response } = apiResponse;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "Todoカレンダーの取得に失敗しました。"),
      response.status,
    );
  }

  const todos =
    readNormalizedArrayField(data, "todos", normalizeMobileCrossMemoTodoItem) ??
    readNormalizedArrayField(data, "data", normalizeMobileCrossMemoTodoItem) ??
    readDirectNormalizedArray(data, normalizeMobileCrossMemoTodoItem);

  if (!todos) {
    return fetchMobileTodosFromPosts(accessToken, true);
  }

  return todos as MobileCrossMemoTodoItemsResponse["todos"];
}

export async function createMobileTodoItem(
  accessToken: string,
  postId: number,
  payload: { dueAt?: string | null; reminderAt?: string | null; text: string },
) {
  const apiResponse = await requestMobileApi(
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
  const { data, response } = apiResponse;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "Todoの追加に失敗しました。"),
      response.status,
    );
  }

  const todo =
    readNormalizedObjectField(data, "todo", normalizeMobileTodoItem) ??
    readNormalizedObjectField(data, "todoItem", normalizeMobileTodoItem) ??
    readNormalizedObjectField(data, "data", normalizeMobileTodoItem);

  if (!todo) {
    throw getResponseFormatError("Todo追加", apiResponse);
  }

  return todo as MobileTodoItemResponse["todo"];
}

export async function updateMobileTodoItem(
  accessToken: string,
  postId: number,
  todoItemId: number,
  payload: MobileTodoItemPayload,
) {
  const apiResponse = await requestMobileApi(
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
  const { data, response } = apiResponse;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "Todoの更新に失敗しました。"),
      response.status,
    );
  }

  const todo =
    readNormalizedObjectField(data, "todo", normalizeMobileTodoItem) ??
    readNormalizedObjectField(data, "todoItem", normalizeMobileTodoItem) ??
    readNormalizedObjectField(data, "data", normalizeMobileTodoItem);

  if (!todo) {
    throw getResponseFormatError("Todo更新", apiResponse);
  }

  return todo as MobileTodoItemResponse["todo"];
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
