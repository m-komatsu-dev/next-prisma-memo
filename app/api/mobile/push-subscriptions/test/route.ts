import { getMobileAuthUser } from "@/lib/mobile-auth";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import { logServerError } from "@/lib/server-errors";
import { sendTestPushToUser } from "@/lib/todo-reminders";
import { NextResponse } from "next/server";

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PUSH_TEST_API !== "true") {
    return withMobileCors(
      request,
      NextResponse.json({ error: "テスト通知は無効です。" }, { status: 404 }),
    );
  }

  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
    );
  }

  try {
    const result = await sendTestPushToUser(authUser.id);

    return withMobileCors(request, NextResponse.json(result));
  } catch (error) {
    logServerError(error, {
      action: "mobileSendTestPush",
      userId: authUser.id,
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "テスト通知の送信に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}
