import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

const authMock = vi.hoisted(() => vi.fn());
const bcryptCompareMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  apiSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: bcryptCompareMock,
  },
}));

function createJsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost:3000${path}`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Vitest Mobile",
    },
    method: "POST",
  });
}

describe("mobile auth API", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-for-mobile-auth-route-tests";
    authMock.mockResolvedValue(null);
    vi.clearAllMocks();
  });

  it("login returns accessToken and refreshToken without storing the refresh token plaintext", async () => {
    const { POST } = await import("@/app/api/mobile/auth/login/route");

    prismaMock.user.findUnique.mockResolvedValue({
      email: "user@example.com",
      id: "user-1",
      name: "User",
      password: "hashed-password",
    });
    bcryptCompareMock.mockResolvedValue(true);
    prismaMock.apiSession.create.mockResolvedValue({ id: "api-session-1" });

    const response = await POST(
      createJsonRequest("/api/mobile/auth/login", {
        email: "user@example.com",
        password: "password",
      }),
    );
    const data = (await response.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    const createCall = prismaMock.apiSession.create.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(data.accessToken).toEqual(expect.any(String));
    expect(data.refreshToken).toEqual(expect.any(String));
    expect(createCall.data.userId).toBe("user-1");
    expect(createCall.data.refreshTokenHash).toEqual(expect.any(String));
    expect(createCall.data.refreshTokenHash).not.toBe(data.refreshToken);
    expect(createCall.data.userAgent).toBe("Vitest Mobile");
  });

  it("refresh returns a new accessToken and rotated refreshToken", async () => {
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const oldRefreshToken = "r".repeat(43);

    prismaMock.apiSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: "api-session-1",
      revokedAt: null,
      userId: "user-1",
    });
    prismaMock.apiSession.updateMany.mockResolvedValue({ count: 1 });

    const response = await POST(
      createJsonRequest("/api/mobile/auth/refresh", {
        refreshToken: oldRefreshToken,
      }),
    );
    const data = (await response.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    const updateCall = prismaMock.apiSession.updateMany.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(data.accessToken).toEqual(expect.any(String));
    expect(data.refreshToken).toEqual(expect.any(String));
    expect(data.refreshToken).not.toBe(oldRefreshToken);
    expect(updateCall.where.id).toBe("api-session-1");
    expect(updateCall.where.refreshTokenHash).toEqual(expect.any(String));
    expect(updateCall.data.refreshTokenHash).not.toBe(oldRefreshToken);
    expect(updateCall.data.lastUsedAt).toBeInstanceOf(Date);
  });

  it("rejects a replayed refreshToken when rotation no longer matches", async () => {
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const refreshToken = "r".repeat(43);

    prismaMock.apiSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: "api-session-1",
      revokedAt: null,
      userId: "user-1",
    });
    prismaMock.apiSession.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(
      createJsonRequest("/api/mobile/auth/refresh", { refreshToken }),
    );

    expect(response.status).toBe(401);
  });

  it("does not refresh after logout revokes the ApiSession", async () => {
    const { POST: logout } = await import("@/app/api/mobile/auth/logout/route");
    const { POST: refresh } = await import("@/app/api/mobile/auth/refresh/route");
    const refreshToken = "r".repeat(43);

    prismaMock.apiSession.updateMany.mockResolvedValue({ count: 1 });

    const logoutResponse = await logout(
      createJsonRequest("/api/mobile/auth/logout", { refreshToken }),
    );

    prismaMock.apiSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: "api-session-1",
      revokedAt: new Date(),
      userId: "user-1",
    });

    const refreshResponse = await refresh(
      createJsonRequest("/api/mobile/auth/refresh", { refreshToken }),
    );

    expect(logoutResponse.status).toBe(200);
    expect(refreshResponse.status).toBe(401);
  });

  it("rejects an invalid refreshToken", async () => {
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");

    prismaMock.apiSession.findUnique.mockResolvedValue(null);

    const response = await POST(
      createJsonRequest("/api/mobile/auth/refresh", {
        refreshToken: "r".repeat(43),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("mobile post API rejects an invalid Bearer token with 401", async () => {
    const { GET } = await import("@/app/api/mobile/posts/route");

    const response = await GET(
      new Request("http://localhost:3000/api/mobile/posts", {
        headers: { Authorization: "Bearer not-a-valid-jwt" },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("mobile post API rejects an expired Bearer token with 401", async () => {
    const { GET } = await import("@/app/api/mobile/posts/route");
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setJti("api-session-1")
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));

    const response = await GET(
      new Request("http://localhost:3000/api/mobile/posts", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(response.status).toBe(401);
    expect(prismaMock.apiSession.findUnique).not.toHaveBeenCalled();
  });

  it("resolves a valid Bearer token only when its ApiSession is active", async () => {
    const { getMobileAuthUser } = await import("@/lib/mobile-auth");
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setJti("api-session-1")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));

    prismaMock.apiSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: { id: "user-1" },
      userId: "user-1",
    });
    prismaMock.apiSession.update.mockResolvedValue({});

    const user = await getMobileAuthUser(
      new Request("http://localhost:3000/api/mobile/posts", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(user).toEqual({ id: "user-1" });
  });
});
