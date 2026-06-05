import { auth } from "@/auth";
import {
  NOTIFICATION_LIST_LIMIT,
  listNotificationsForUser,
  serializeNotification,
} from "@/lib/notifications";
import { logServerError } from "@/lib/server-errors";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import NotificationsList from "./notifications-list";

export const metadata: Metadata = {
  title: "My Memo App - 通知",
  description: "共有やTodo通知の一覧と既読状態を確認できます。",
};

export default async function NotificationsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  let notificationData: Awaited<ReturnType<typeof listNotificationsForUser>>;

  try {
    notificationData = await listNotificationsForUser({
      limit: NOTIFICATION_LIST_LIMIT,
      userId: session.user.id,
    });
  } catch (error) {
    logServerError(error, {
      action: "webNotificationsPage",
      userId: session.user.id,
    });
    throw new Error("通知一覧の取得に失敗しました。");
  }

  const { notifications, unreadCount } = notificationData;

  return (
    <main className="notifications-page">
      <div className="notifications-shell">
        <nav className="post-breadcrumb" aria-label="パンくずリスト">
          <Link href="/">ホーム</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">通知</span>
        </nav>

        <header className="notifications-heading">
          <p className="eyebrow">Notifications</p>
          <h1>通知</h1>
          <p>
            共有されたメモやTodo通知を確認できます。未読通知を開くと既読になります。
          </p>
        </header>

        <NotificationsList
          initialNotifications={notifications.map(serializeNotification)}
          initialUnreadCount={unreadCount}
        />
      </div>
    </main>
  );
}
