import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const getMobileAuthUserMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (queries: Promise<unknown>[]) => Promise.all(queries)),
  notification: {
    count: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/mobile-auth", () => ({
  getMobileAuthUser: getMobileAuthUserMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const notification = {
  body: "閲覧者としてメモに招待されました。",
  createdAt: new Date("2026-06-05T00:00:00.000Z"),
  id: "notification-1",
  postId: 10,
  postShareId: 20,
  readAt: null,
  title: "メモが共有されました",
  type: "post_shared",
  updatedAt: new Date("2026-06-05T00:00:00.000Z"),
};

function createRequest(path: string, method = "GET") {
  return new Request(`http://localhost:3000${path}`, {
    headers: { Authorization: "Bearer access-token" },
    method,
  });
}

describe("notification list and read APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getMobileAuthUserMock.mockResolvedValue({ id: "user-1" });
    prismaMock.notification.findMany.mockResolvedValue([notification]);
    prismaMock.notification.count.mockResolvedValue(1);
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 });
  });

  it("lists Web notifications and returns the unread count for the logged-in user", async () => {
    const { GET } = await import("@/app/api/notifications/route");

    const response = await GET(createRequest("/api/notifications"));
    const data = (await response.json()) as {
      notifications: { id: string; readAt: string | null }[];
      unreadCount: number;
    };
    const findCall = prismaMock.notification.findMany.mock.calls[0]?.[0];
    const countCall = prismaMock.notification.count.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(data.notifications[0]?.id).toBe("notification-1");
    expect(data.notifications[0]?.readAt).toBeNull();
    expect(data.unreadCount).toBe(1);
    expect(findCall.where.userId).toBe("user-1");
    expect(countCall.where).toEqual({ readAt: null, userId: "user-1" });
  });

  it("lists mobile notifications and returns the unread count", async () => {
    const { GET } = await import("@/app/api/mobile/notifications/route");

    const response = await GET(createRequest("/api/mobile/notifications"));
    const data = (await response.json()) as {
      notifications: { id: string }[];
      unreadCount: number;
    };

    expect(response.status).toBe(200);
    expect(data.notifications[0]?.id).toBe("notification-1");
    expect(data.unreadCount).toBe(1);
    expect(prismaMock.notification.findMany.mock.calls[0]?.[0].where.userId).toBe(
      "user-1",
    );
  });

  it("marks only the logged-in user's notification as read", async () => {
    const { PATCH } = await import("@/app/api/notifications/[id]/read/route");

    const response = await PATCH(
      createRequest("/api/notifications/notification-1/read", "PATCH"),
      { params: Promise.resolve({ id: "notification-1" }) },
    );
    const updateCall = prismaMock.notification.updateMany.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(updateCall.where).toEqual({
      id: "notification-1",
      userId: "user-1",
    });
    expect(updateCall.data.readAt).toBeInstanceOf(Date);
  });

  it("does not mark another user's notification as read", async () => {
    const { PATCH } = await import("@/app/api/notifications/[id]/read/route");
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 });

    const response = await PATCH(
      createRequest("/api/notifications/notification-2/read", "PATCH"),
      { params: Promise.resolve({ id: "notification-2" }) },
    );

    expect(response.status).toBe(404);
    expect(prismaMock.notification.updateMany.mock.calls[0]?.[0].where).toEqual({
      id: "notification-2",
      userId: "user-1",
    });
  });

  it("marks all of the logged-in user's unread notifications as read", async () => {
    const { PATCH } = await import("@/app/api/notifications/read-all/route");

    const response = await PATCH();
    const data = (await response.json()) as { updatedCount: number };
    const updateCall = prismaMock.notification.updateMany.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(data.updatedCount).toBe(1);
    expect(updateCall.where).toEqual({ readAt: null, userId: "user-1" });
    expect(updateCall.data.readAt).toBeInstanceOf(Date);
  });

  it("rejects notification APIs when the user is not logged in", async () => {
    const { GET } = await import("@/app/api/notifications/route");
    const { PATCH } = await import("@/app/api/notifications/[id]/read/route");
    authMock.mockResolvedValue(null);

    const listResponse = await GET(createRequest("/api/notifications"));
    const readResponse = await PATCH(
      createRequest("/api/notifications/notification-1/read", "PATCH"),
      { params: Promise.resolve({ id: "notification-1" }) },
    );

    expect(listResponse.status).toBe(401);
    expect(readResponse.status).toBe(401);
  });

  it("builds the correct Web memo destination for notification clicks", async () => {
    const { getNotificationPostHref } = await import("@/lib/notification-links");

    expect(getNotificationPostHref({ postId: 42 })).toBe("/posts/42");
    expect(getNotificationPostHref({ postId: null })).toBeNull();
  });
});
