import type {
  MobileNotification,
  MobileNotificationsResponse,
} from "../types/posts";
import {
  buildListQuery,
  getErrorMessage,
  getResponseFormatError,
  isRecord,
  type MobileListOptions,
  MobileApiRequestError,
  readNormalizedArrayField,
  requestMobileApi,
} from "./posts/client";

function normalizeMobileNotification(value: unknown): MobileNotification | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    body,
    createdAt,
    id,
    postId,
    postShareId,
    readAt,
    title,
    type,
    updatedAt,
  } = value;

  if (
    typeof createdAt !== "string" ||
    typeof id !== "string" ||
    typeof title !== "string" ||
    typeof type !== "string" ||
    typeof updatedAt !== "string"
  ) {
    return null;
  }

  if (
    (body !== null && typeof body !== "string") ||
    (postId !== null && typeof postId !== "number") ||
    (postShareId !== null && typeof postShareId !== "number") ||
    (readAt !== null && typeof readAt !== "string")
  ) {
    return null;
  }

  return {
    body,
    createdAt,
    id,
    postId,
    postShareId,
    readAt,
    title,
    type,
    updatedAt,
  };
}

function readUnreadCount(data: unknown) {
  return isRecord(data) && typeof data.unreadCount === "number"
    ? data.unreadCount
    : null;
}

export async function fetchMobileNotifications(
  accessToken: string,
  options?: MobileListOptions,
): Promise<MobileNotificationsResponse> {
  const apiResponse = await requestMobileApi(
    `/api/mobile/notifications${buildListQuery(options)}`,
    accessToken,
  );
  const { data, response } = apiResponse;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "通知一覧の取得に失敗しました。"),
      response.status,
    );
  }

  const notifications = readNormalizedArrayField(
    data,
    "notifications",
    normalizeMobileNotification,
  );
  const unreadCount = readUnreadCount(data);

  if (!notifications || unreadCount === null) {
    throw getResponseFormatError("通知一覧", apiResponse);
  }

  return { notifications, unreadCount };
}

export async function markMobileNotificationRead(
  accessToken: string,
  notificationId: string,
) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/notifications/${notificationId}/read`,
    accessToken,
    { method: "PATCH" },
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "通知の既読化に失敗しました。"),
      response.status,
    );
  }
}

export async function markAllMobileNotificationsRead(accessToken: string) {
  const { data, response } = await requestMobileApi(
    "/api/mobile/notifications/read-all",
    accessToken,
    { method: "PATCH" },
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "通知の既読化に失敗しました。"),
      response.status,
    );
  }
}
