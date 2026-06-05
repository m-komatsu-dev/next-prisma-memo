import { auth } from "@/auth";
import { markAllNotificationsReadForUser } from "@/lib/notifications";
import { logServerError } from "@/lib/server-errors";
import { NextResponse } from "next/server";

export async function PATCH() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  try {
    const updatedCount = await markAllNotificationsReadForUser(session.user.id);

    return NextResponse.json({ ok: true, updatedCount });
  } catch (error) {
    logServerError(error, {
      action: "webMarkAllNotificationsRead",
      userId: session.user.id,
    });

    return NextResponse.json(
      { error: "通知の既読化に失敗しました。" },
      { status: 500 },
    );
  }
}
