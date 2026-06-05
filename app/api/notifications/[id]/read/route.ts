import { auth } from "@/auth";
import { markNotificationReadForUser } from "@/lib/notifications";
import { logServerError } from "@/lib/server-errors";
import { notificationIdValueSchema } from "@/lib/zod";
import { NextResponse } from "next/server";

type NotificationReadRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  _request: Request,
  { params }: NotificationReadRouteContext,
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { id } = await params;
  const validatedNotificationId = notificationIdValueSchema.safeParse(id);

  if (!validatedNotificationId.success) {
    return NextResponse.json(
      { error: "通知IDの形式が正しくありません。" },
      { status: 400 },
    );
  }

  try {
    const marked = await markNotificationReadForUser(
      session.user.id,
      validatedNotificationId.data,
    );

    if (!marked) {
      return NextResponse.json(
        { error: "通知が見つかりません。" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError(error, {
      action: "webMarkNotificationRead",
      userId: session.user.id,
    });

    return NextResponse.json(
      { error: "通知の既読化に失敗しました。" },
      { status: 500 },
    );
  }
}
