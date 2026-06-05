type MobileNotificationInput = {
  body: string | null;
  createdAt: Date;
  id: string;
  postId: number | null;
  postShareId: number | null;
  readAt: Date | null;
  title: string;
  type: string;
  updatedAt: Date;
};

export function serializeMobileNotification(notification: MobileNotificationInput) {
  return {
    body: notification.body,
    createdAt: notification.createdAt.toISOString(),
    id: notification.id,
    postId: notification.postId,
    postShareId: notification.postShareId,
    readAt: notification.readAt?.toISOString() ?? null,
    title: notification.title,
    type: notification.type,
    updatedAt: notification.updatedAt.toISOString(),
  };
}
