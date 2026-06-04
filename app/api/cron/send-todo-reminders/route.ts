import { logServerError } from "@/lib/server-errors";
import { sendDueTodoReminders } from "@/lib/todo-reminders";
import { NextResponse } from "next/server";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");

  return (
    authorization === `Bearer ${cronSecret}` ||
    headerSecret === cronSecret
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendDueTodoReminders();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logServerError(error, {
      action: "cronSendTodoReminders",
    });

    return NextResponse.json(
      { error: "Todoリマインダーの送信に失敗しました。" },
      { status: 500 },
    );
  }
}
