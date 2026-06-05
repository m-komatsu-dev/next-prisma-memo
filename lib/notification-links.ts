export function getNotificationPostHref(notification: { postId: number | null }) {
  return notification.postId ? `/posts/${notification.postId}` : null;
}
