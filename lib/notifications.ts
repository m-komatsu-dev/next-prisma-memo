import type { PostShareRole, Prisma } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";

export const POST_SHARE_NOTIFICATION_TYPE = "post_shared";

type NotificationClient = Pick<Prisma.TransactionClient, "notification" | "postShare">;

type PostShareNotificationInput = {
  actorUserId: string;
  postId: number;
  postShareId: number;
  role: PostShareRole;
  targetUserId: string;
};

function buildPostShareNotificationBody(role: PostShareNotificationInput["role"]) {
  return role === "editor"
    ? "編集者としてメモに招待されました。"
    : "閲覧者としてメモに招待されました。";
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
