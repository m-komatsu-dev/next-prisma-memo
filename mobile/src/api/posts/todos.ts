import type {
  MobileCrossMemoTodoItemsResponse,
  MobileTodoItemPayload,
  MobileTodoItemResponse,
  MobileTodoItemsResponse,
} from "../../types/posts";
import {
  buildListQuery,
  getErrorMessage,
  getResponseFormatError,
  type MobileListOptions,
  MobileApiRequestError,
  readDirectNormalizedArray,
  readNormalizedArrayField,
  readNormalizedObjectField,
  requestMobileApi,
} from "./client";
import { fetchMobilePostsForFallback } from "./posts";
import {
  normalizeMobileCrossMemoTodoItem,
  normalizeMobileTodoItem,
  normalizePostTodoItem,
} from "./normalizers";

async function fetchMobileTodosFromPosts(
  accessToken: string,
  onlyWithDueAt: boolean,
) {
  const posts = await fetchMobilePostsForFallback(accessToken);

  return posts
    .flatMap((post) =>
      (post.todoItems ?? []).map((todoItem) =>
        normalizePostTodoItem(todoItem, post),
      ),
    )
    .filter((todoItem) => !onlyWithDueAt || Boolean(todoItem.dueAt));
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

export async function fetchMobileAllTodos(
  accessToken: string,
  options?: MobileListOptions,
) {
  const apiResponse = await requestMobileApi(
    `/api/mobile/todos${buildListQuery(options)}`,
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

export async function fetchMobileTodoCalendar(
  accessToken: string,
  options?: MobileListOptions,
) {
  const apiResponse = await requestMobileApi(
    `/api/mobile/todos/calendar${buildListQuery(options)}`,
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
