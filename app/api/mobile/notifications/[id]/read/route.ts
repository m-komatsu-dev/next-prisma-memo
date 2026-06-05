import { getMobileAuthUser } from "@/lib/mobile-auth";
import { mobileError, mobileJson } from "@/lib/mobile-api-response";
import { mobileCorsOptions } from "@/lib/mobile-cors";
import { markNotificationReadForUser } from "@/lib/notifications";
import { logServerError } from "@/lib/server-errors";
import { notificationIdValueSchema } from "@/lib/zod";

type MobileNotificationReadRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}

export async function PATCH(
  request: Request,
  { params }: MobileNotificationReadRouteContext,
) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return mobileError(request, "ログインが必要です。", 401);
  }

  const { id } = await params;
  const validatedNotificationId = notificationIdValueSchema.safeParse(id);

  if (!validatedNotificationId.success) {
    return mobileError(request, "通知IDの形式が正しくありません。", 400);
  }

  try {
    const marked = await markNotificationReadForUser(
      authUser.id,
      validatedNotificationId.data,
    );

    if (!marked) {
      return mobileError(request, "通知が見つかりません。", 404);
    }

    return mobileJson(request, { ok: true });
  } catch (error) {
    logServerError(error, {
      action: "mobileMarkNotificationRead",
      userId: authUser.id,
    });

    return mobileError(request, "通知の既読化に失敗しました。", 500);
  }
}
