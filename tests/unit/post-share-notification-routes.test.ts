import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const getMobileAuthUserMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => unknown) =>
    callback(prismaMock),
  ),
  notification: {
    upsert: vi.fn(),
  },
  post: {
    findFirst: vi.fn(),
  },
  postShare: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
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

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

function createShareFormData(email = "shared@example.com") {
  const formData = new FormData();
  formData.set("id", "10");
  formData.set("email", email);
  formData.set("role", "viewer");
  return formData;
}

function createMobileShareRequest(email = "shared@example.com") {
  return new Request("http://localhost:3000/api/mobile/posts/10/shares", {
    body: JSON.stringify({ email, role: "viewer" }),
    headers: {
      Authorization: "Bearer access-token",
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

function mockSuccessfulShare() {
  prismaMock.post.findFirst.mockResolvedValue({ id: 10 });
  prismaMock.user.findUnique.mockResolvedValue({
    email: "shared@example.com",
    id: "target-user",
  });
  prismaMock.postShare.upsert.mockResolvedValue({
    id: 2,
    role: "viewer",
    user: {
      email: "shared@example.com",
      name: "Shared User",
    },
    userId: "target-user",
  });
  prismaMock.postShare.findUnique.mockResolvedValue({
    id: 2,
    postId: 10,
    role: "viewer",
    userId: "target-user",
  });
  prismaMock.notification.upsert.mockResolvedValue({
    id: "notification-1",
    postId: 10,
    postShareId: 2,
    type: "post_shared",
    userId: "target-user",
  });
}

describe("post share notification creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "owner-user" } });
    getMobileAuthUserMock.mockResolvedValue({ id: "owner-user" });
    mockSuccessfulShare();
  });

  it("creates a notification when a Web share creates a PostShare", async () => {
    const { addPostShare } = await import("@/app/posts/[id]/share-actions");

    const result = await addPostShare(
      { message: "", status: "idle" },
      createShareFormData(),
    );

    expect(result.status).toBe("success");
    expect(prismaMock.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          actorId: "owner-user",
          postId: 10,
          postShareId: 2,
          type: "post_shared",
          userId: "target-user",
        }),
        where: {
          postShareId_type: {
            postShareId: 2,
            type: "post_shared",
          },
        },
      }),
    );
  });

  it("uses notification upsert so the same share does not duplicate notifications", async () => {
    const { addPostShare } = await import("@/app/posts/[id]/share-actions");

    await addPostShare({ message: "", status: "idle" }, createShareFormData());
    await addPostShare({ message: "", status: "idle" }, createShareFormData());

    expect(prismaMock.notification.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.notification.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          postShareId_type: {
            postShareId: 2,
            type: "post_shared",
          },
        },
      }),
    );
  });

  it("does not create a share notification when the Web user is not logged in", async () => {
    const { addPostShare } = await import("@/app/posts/[id]/share-actions");
    authMock.mockResolvedValue(null);

    const result = await addPostShare(
      { message: "", status: "idle" },
      createShareFormData(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("ログイン");
    expect(prismaMock.postShare.upsert).not.toHaveBeenCalled();
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });

  it("does not create a share notification for another user's post on Web", async () => {
    const { addPostShare } = await import("@/app/posts/[id]/share-actions");
    prismaMock.post.findFirst.mockResolvedValue(null);

    const result = await addPostShare(
      { message: "", status: "idle" },
      createShareFormData(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("権限");
    expect(prismaMock.postShare.upsert).not.toHaveBeenCalled();
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });

  it("returns a clear error when the Web share target does not exist", async () => {
    const { addPostShare } = await import("@/app/posts/[id]/share-actions");
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await addPostShare(
      { message: "", status: "idle" },
      createShareFormData("missing@example.com"),
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("ユーザーが見つかりません");
    expect(prismaMock.postShare.upsert).not.toHaveBeenCalled();
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });

  it("creates a notification when the mobile share API creates a PostShare", async () => {
    const { POST } = await import("@/app/api/mobile/posts/[id]/shares/route");

    const response = await POST(createMobileShareRequest(), {
      params: Promise.resolve({ id: "10" }),
    });

    expect(response.status).toBe(200);
    expect(prismaMock.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          actorId: "owner-user",
          postShareId: 2,
          type: "post_shared",
          userId: "target-user",
        }),
      }),
    );
  });

  it("does not create a mobile share notification when the user is not logged in", async () => {
    const { POST } = await import("@/app/api/mobile/posts/[id]/shares/route");
    getMobileAuthUserMock.mockResolvedValue(null);

    const response = await POST(createMobileShareRequest(), {
      params: Promise.resolve({ id: "10" }),
    });

    expect(response.status).toBe(401);
    expect(prismaMock.postShare.upsert).not.toHaveBeenCalled();
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });

  it("does not create a mobile share notification for another user's post", async () => {
    const { POST } = await import("@/app/api/mobile/posts/[id]/shares/route");
    prismaMock.post.findFirst.mockResolvedValue(null);

    const response = await POST(createMobileShareRequest(), {
      params: Promise.resolve({ id: "10" }),
    });

    expect(response.status).toBe(403);
    expect(prismaMock.postShare.upsert).not.toHaveBeenCalled();
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });
});
