import { getMobileAuthUser } from "@/lib/mobile-auth";
import { mobileError, mobileJson } from "@/lib/mobile-api-response";
import { mobileCorsOptions } from "@/lib/mobile-cors";
import { markAllNotificationsReadForUser } from "@/lib/notifications";
import { logServerError } from "@/lib/server-errors";

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}

export async function PATCH(request: Request) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return mobileError(request, "ログインが必要です。", 401);
  }

  try {
    const updatedCount = await markAllNotificationsReadForUser(authUser.id);

    return mobileJson(request, { ok: true, updatedCount });
  } catch (error) {
    logServerError(error, {
      action: "mobileMarkAllNotificationsRead",
      userId: authUser.id,
    });

    return mobileError(request, "通知の既読化に失敗しました。", 500);
  }
}
