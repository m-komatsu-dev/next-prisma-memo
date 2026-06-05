import { auth } from "@/auth";
import {
  NOTIFICATION_LIST_LIMIT,
  NOTIFICATION_LIST_MAX_LIMIT,
  listNotificationsForUser,
  serializeNotification,
} from "@/lib/notifications";
import { resolveListLimit } from "@/lib/list-query";
import { logServerError } from "@/lib/server-errors";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = resolveListLimit(
    url.searchParams.get("limit"),
    NOTIFICATION_LIST_LIMIT,
    NOTIFICATION_LIST_MAX_LIMIT,
  );
  const unreadOnly = url.searchParams.get("unread") === "true";

  try {
    const { notifications, unreadCount } = await listNotificationsForUser({
      limit,
      unreadOnly,
      userId: session.user.id,
    });

    return NextResponse.json({
      notifications: notifications.map(serializeNotification),
      unreadCount,
    });
  } catch (error) {
    logServerError(error, {
      action: "webListNotifications",
      userId: session.user.id,
    });

    return NextResponse.json(
      { error: "通知一覧の取得に失敗しました。" },
      { status: 500 },
    );
  }
}
