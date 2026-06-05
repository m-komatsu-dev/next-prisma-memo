import {
  MOBILE_MEMO_LIST_LIMIT,
  MEMO_LIST_MAX_LIMIT,
  resolveListLimit,
} from "@/lib/list-query";
import { getMobileAuthUser } from "@/lib/mobile-auth";
import { mobileError, mobileJson } from "@/lib/mobile-api-response";
import { mobileCorsOptions } from "@/lib/mobile-cors";
import { serializeMobileNotification } from "@/lib/mobile-notifications";
import { listNotificationsForUser } from "@/lib/notifications";
import { logServerError } from "@/lib/server-errors";

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}

export async function GET(request: Request) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return mobileError(request, "ログインが必要です。", 401);
  }

  const url = new URL(request.url);
  const limit = resolveListLimit(
    url.searchParams.get("limit"),
    MOBILE_MEMO_LIST_LIMIT,
    MEMO_LIST_MAX_LIMIT,
  );
  const unreadOnly = url.searchParams.get("unread") === "true";

  try {
    const { notifications, unreadCount } = await listNotificationsForUser({
      limit,
      unreadOnly,
      userId: authUser.id,
    });

    return mobileJson(request, {
      notifications: notifications.map(serializeMobileNotification),
      unreadCount,
    });
  } catch (error) {
    logServerError(error, {
      action: "mobileListNotifications",
      userId: authUser.id,
    });

    return mobileError(request, "通知一覧の取得に失敗しました。", 500);
  }
}
