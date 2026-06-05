"use client";

import { getNotificationPostHref } from "@/lib/notification-links";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type AppNotification = {
  body: string | null;
  createdAt: string;
  id: string;
  postId: number | null;
  postShareId: number | null;
  readAt: string | null;
  title: string;
  type: string;
  updatedAt: string;
};

const notificationDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return notificationDateFormatter.format(date);
}

async function patchJson(path: string) {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error("通知の更新に失敗しました。");
  }
}

export default function NotificationsList({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: AppNotification[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const hasNotifications = notifications.length > 0;
  const unreadIds = useMemo(
    () => new Set(notifications.filter((item) => !item.readAt).map((item) => item.id)),
    [notifications],
  );

  const markLocalRead = (notificationId: string) => {
    const now = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId && !notification.readAt
          ? { ...notification, readAt: now }
          : notification,
      ),
    );
    setUnreadCount((current) =>
      unreadIds.has(notificationId) ? Math.max(0, current - 1) : current,
    );
  };

  const handleOpen = (notification: AppNotification) => {
    setMessage("");
    markLocalRead(notification.id);

    startTransition(async () => {
      try {
        await patchJson(`/api/notifications/${notification.id}/read`);

        const postHref = getNotificationPostHref(notification);

        if (postHref) {
          router.push(postHref);
        } else {
          router.refresh();
        }
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "通知の更新に失敗しました。",
        );
        router.refresh();
      }
    });
  };

  const handleMarkAllRead = () => {
    setMessage("");
    const now = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) =>
        notification.readAt ? notification : { ...notification, readAt: now },
      ),
    );
    setUnreadCount(0);

    startTransition(async () => {
      try {
        await patchJson("/api/notifications/read-all");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "通知の更新に失敗しました。",
        );
        router.refresh();
      }
    });
  };

  if (!hasNotifications) {
    return (
      <section className="posts-empty-state notifications-empty" aria-live="polite">
        <p className="posts-empty-kicker">Notifications</p>
        <h2>通知はありません</h2>
        <p>共有やTodo通知が届くと、ここに一覧で表示されます。</p>
      </section>
    );
  }

  return (
    <>
      <div className="notifications-toolbar">
        <p>
          未読 <strong>{unreadCount}</strong> 件
        </p>
        <button
          className="button button-secondary notifications-mark-all"
          disabled={unreadCount === 0 || isPending}
          onClick={handleMarkAllRead}
          type="button"
        >
          すべて既読にする
        </button>
      </div>
      {message ? <p className="notifications-error">{message}</p> : null}
      <ul className="notifications-list" aria-label="通知一覧">
        {notifications.map((notification) => {
          const unread = !notification.readAt;

          return (
            <li
              className={[
                "notification-item",
                unread ? "notification-item--unread" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={notification.id}
            >
              <button
                className="notification-item__button"
                disabled={isPending}
                onClick={() => handleOpen(notification)}
                type="button"
              >
                <span className="notification-item__main">
                  <span className="notification-item__title-row">
                    <span className="notification-item__title">
                      {notification.title}
                    </span>
                    <span
                      className={[
                        "memo-badge",
                        unread ? "memo-badge--shared" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {unread ? "未読" : "既読"}
                    </span>
                  </span>
                  {notification.body ? (
                    <span className="notification-item__body">
                      {notification.body}
                    </span>
                  ) : null}
                  <span className="notification-item__meta">
                    {formatNotificationDate(notification.createdAt)}
                    {notification.postId ? " / 関連メモへ移動" : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
