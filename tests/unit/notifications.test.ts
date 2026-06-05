import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  notification: {
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.notification.upsert.mockResolvedValue({
      id: "notification-1",
      postId: 10,
      postShareId: 20,
      type: "post_shared",
      userId: "target-user",
    });
  });

  it("creates a post share notification for the shared user", async () => {
    const { createPostShareNotification, POST_SHARE_NOTIFICATION_TYPE } =
      await import("@/lib/notifications");

    await createPostShareNotification({
      actorUserId: "owner-user",
      postId: 10,
      postShareId: 20,
      role: "editor",
      targetUserId: "target-user",
    });

    expect(prismaMock.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          actorId: "owner-user",
          postId: 10,
          postShareId: 20,
          type: POST_SHARE_NOTIFICATION_TYPE,
          userId: "target-user",
        }),
        where: {
          postShareId_type: {
            postShareId: 20,
            type: POST_SHARE_NOTIFICATION_TYPE,
          },
        },
      }),
    );
  });

  it("does not create a notification when actor and target are the same user", async () => {
    const { createPostShareNotification } = await import("@/lib/notifications");

    const result = await createPostShareNotification({
      actorUserId: "same-user",
      postId: 10,
      postShareId: 20,
      role: "viewer",
      targetUserId: "same-user",
    });

    expect(result).toBeNull();
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });
});
