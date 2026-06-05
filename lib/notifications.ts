import type { PostShareRole, Prisma } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";

export const POST_SHARE_NOTIFICATION_TYPE = "post_shared";
export const NOTIFICATION_LIST_LIMIT = 60;
export const NOTIFICATION_LIST_MAX_LIMIT = 120;

type NotificationClient = Pick<Prisma.TransactionClient, "notification" | "postShare">;
type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

type PostShareNotificationInput = {
  actorUserId: string;
  postId: number;
  postShareId: number;
  role: PostShareRole;
  targetUserId: string;
};

const notificationSelect = {
  body: true,
  createdAt: true,
  id: true,
  postId: true,
  postShareId: true,
  readAt: true,
  title: true,
  type: true,
  updatedAt: true,
} satisfies Prisma.NotificationSelect;

function buildPostShareNotificationBody(role: PostShareNotificationInput["role"]) {
  return role === "editor"
    ? "編集者としてメモに招待されました。"
    : "閲覧者としてメモに招待されました。";
}

export function serializeNotification(notification: NotificationRecord) {
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

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({
    where: {
      readAt: null,
      userId,
    },
  });
}

export async function listNotificationsForUser({
  limit = NOTIFICATION_LIST_LIMIT,
  unreadOnly = false,
  userId,
}: {
  limit?: number;
  unreadOnly?: boolean;
  userId: string;
}) {
  const [notifications, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: notificationSelect,
      take: limit,
    }),
    prisma.notification.count({
      where: {
        readAt: null,
        userId,
      },
    }),
  ]);

  return {
    notifications,
    unreadCount,
  };
}

export async function markNotificationReadForUser(
  userId: string,
  notificationId: string,
) {
  const result = await prisma.notification.updateMany({
    data: { readAt: new Date() },
    where: {
      id: notificationId,
      userId,
    },
  });

  return result.count > 0;
}

export async function markAllNotificationsReadForUser(userId: string) {
  const result = await prisma.notification.updateMany({
    data: { readAt: new Date() },
    where: {
      readAt: null,
      userId,
    },
  });

  return result.count;
}

export async function createPostShareNotification(
  input: PostShareNotificationInput,
  client: NotificationClient = prisma,
) {
  if (input.actorUserId === input.targetUserId) {
    return null;
  }

  return client.notification.upsert({
    where: {
      postShareId_type: {
        postShareId: input.postShareId,
        type: POST_SHARE_NOTIFICATION_TYPE,
      },
    },
    create: {
      actorId: input.actorUserId,
      body: buildPostShareNotificationBody(input.role),
      postId: input.postId,
      postShareId: input.postShareId,
      title: "メモが共有されました",
      type: POST_SHARE_NOTIFICATION_TYPE,
      userId: input.targetUserId,
    },
    update: {
      actorId: input.actorUserId,
      body: buildPostShareNotificationBody(input.role),
      postId: input.postId,
      readAt: null,
      title: "メモが共有されました",
      userId: input.targetUserId,
    },
    select: {
      id: true,
      postId: true,
      postShareId: true,
      type: true,
      userId: true,
    },
  });
}

export async function ensurePostShareNotification(
  postShareId: number,
  actorUserId: string,
  client: NotificationClient = prisma,
) {
  const share = await client.postShare.findUnique({
    where: { id: postShareId },
    select: {
      id: true,
      postId: true,
      role: true,
      userId: true,
    },
  });

  if (!share) {
    return null;
  }

  return createPostShareNotification(
    {
      actorUserId,
      postId: share.postId,
      postShareId: share.id,
      role: share.role,
      targetUserId: share.userId,
    },
    client,
  );
}
