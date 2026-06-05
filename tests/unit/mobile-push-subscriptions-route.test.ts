import { beforeEach, describe, expect, it, vi } from "vitest";

const getMobileAuthUserMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  pushSubscription: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/mobile-auth", () => ({
  getMobileAuthUser: getMobileAuthUserMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

function createRequest(method: "DELETE" | "POST", body: unknown) {
  return new Request("http://localhost:3000/api/mobile/push-subscriptions", {
    body: JSON.stringify(body),
    headers: {
      Authorization: "Bearer access-token",
      "Content-Type": "application/json",
    },
    method,
  });
}

describe("mobile push subscription API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMobileAuthUserMock.mockResolvedValue({ id: "user-1" });
    prismaMock.pushSubscription.findUnique.mockResolvedValue(null);
    prismaMock.pushSubscription.upsert.mockResolvedValue({
      id: "push-1",
      platform: "android",
      updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    });
    prismaMock.pushSubscription.updateMany.mockResolvedValue({ count: 1 });
  });

  it("rejects push token registration when the user is not logged in", async () => {
    const { POST } = await import("@/app/api/mobile/push-subscriptions/route");
    getMobileAuthUserMock.mockResolvedValue(null);

    const response = await POST(
      createRequest("POST", {
        expoPushToken: "ExponentPushToken[test-token]",
        platform: "android",
      }),
    );

    expect(response.status).toBe(401);
    expect(prismaMock.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  it("registers the push token for the logged-in user without returning the token", async () => {
    const { POST } = await import("@/app/api/mobile/push-subscriptions/route");

    const response = await POST(
      createRequest("POST", {
        deviceName: "Pixel",
        expoPushToken: "ExponentPushToken[test-token]",
        platform: "android",
      }),
    );
    const text = await response.text();
    const upsertCall = prismaMock.pushSubscription.upsert.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(upsertCall.create.userId).toBe("user-1");
    expect(upsertCall.create.expoPushToken).toBe("ExponentPushToken[test-token]");
    expect(upsertCall.create.platform).toBe("android");
    expect(upsertCall.create.deviceName).toBe("Pixel");
    expect(upsertCall.update.userId).toBe("user-1");
    expect(upsertCall.update.revokedAt).toBeNull();
    expect(upsertCall.update.updatedAt).toBeInstanceOf(Date);
    expect(text).not.toContain("ExponentPushToken[test-token]");
    expect(text).not.toContain("access-token");
  });

  it("reactivates an existing revoked push token for the logged-in user", async () => {
    const { POST } = await import("@/app/api/mobile/push-subscriptions/route");
    prismaMock.pushSubscription.findUnique.mockResolvedValue({
      id: "push-1",
      revokedAt: new Date("2026-06-04T00:00:00.000Z"),
      userId: "user-1",
    });

    const response = await POST(
      createRequest("POST", {
        deviceName: "EAS Android",
        expoPushToken: "ExponentPushToken[test-token]",
        platform: "android",
      }),
    );
    const upsertCall = prismaMock.pushSubscription.upsert.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(upsertCall.where).toEqual({
      expoPushToken: "ExponentPushToken[test-token]",
    });
    expect(upsertCall.update).toEqual(
      expect.objectContaining({
        deviceName: "EAS Android",
        platform: "android",
        revokedAt: null,
        updatedAt: expect.any(Date),
        userId: "user-1",
      }),
    );
  });

  it("does not let a user claim another user's active push token", async () => {
    const { POST } = await import("@/app/api/mobile/push-subscriptions/route");
    prismaMock.pushSubscription.findUnique.mockResolvedValue({
      id: "push-2",
      revokedAt: null,
      userId: "user-2",
    });

    const response = await POST(
      createRequest("POST", {
        expoPushToken: "ExponentPushToken[test-token]",
        platform: "android",
      }),
    );

    expect(response.status).toBe(409);
    expect(prismaMock.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  it("revokes only the logged-in user's matching push token on logout", async () => {
    const { DELETE } = await import("@/app/api/mobile/push-subscriptions/route");

    const response = await DELETE(
      createRequest("DELETE", {
        expoPushToken: "ExponentPushToken[test-token]",
      }),
    );
    const updateCall = prismaMock.pushSubscription.updateMany.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(updateCall.where).toEqual({
      expoPushToken: "ExponentPushToken[test-token]",
      revokedAt: null,
      userId: "user-1",
    });
  });

  it("can revoke all active push tokens for the logged-in user when no token is provided", async () => {
    const { DELETE } = await import("@/app/api/mobile/push-subscriptions/route");

    const response = await DELETE(createRequest("DELETE", {}));
    const updateCall = prismaMock.pushSubscription.updateMany.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(updateCall.where).toEqual({
      revokedAt: null,
      userId: "user-1",
    });
  });
});
