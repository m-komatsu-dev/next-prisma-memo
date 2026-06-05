import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { createHash } from "node:crypto";
import {
  AI_USER_RATE_LIMIT,
  CREDENTIALS_LOGIN_EMAIL_IP_RATE_LIMIT,
  MOBILE_OAUTH_EXCHANGE_CODE_RATE_LIMIT,
  MOBILE_REFRESH_TOKEN_RATE_LIMIT,
  resetAllRateLimits,
} from "@/lib/rate-limit";

const authMock = vi.hoisted(() => vi.fn());
const isOAuthProviderConfiguredMock = vi.hoisted(() => vi.fn());
const bcryptCompareMock = vi.hoisted(() => vi.fn());
const generateAiResultMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callbackOrQueries: unknown) => {
    if (typeof callbackOrQueries === "function") {
      return (callbackOrQueries as (tx: unknown) => unknown)(prismaMock);
    }

    return Promise.all(callbackOrQueries as Promise<unknown>[]);
  }),
  apiSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  mobileOAuthCode: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({
  auth: authMock,
  isOAuthProviderConfigured: isOAuthProviderConfiguredMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/ai-content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai-content")>();

  return {
    ...actual,
    generateAiResult: generateAiResultMock,
  };
});

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

function hashRefreshToken(refreshToken: string) {
  return createHash("sha256").update(refreshToken).digest("hex");
}

function hashOAuthCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

describe("mobile auth API", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-for-mobile-auth-route-tests";
    process.env.MOBILE_AUTH_SECRET = "test-mobile-secret-for-mobile-auth-route-tests";
    process.env.MOBILE_OAUTH_CALLBACK_URL = "mymemo://auth/callback";
    authMock.mockResolvedValue(null);
    isOAuthProviderConfiguredMock.mockReturnValue(true);
    resetAllRateLimits();
    vi.clearAllMocks();
  });

  it("returns 400 for an invalid mobile OAuth provider", async () => {
    const { GET } = await import("@/app/api/mobile/oauth/start/route");

    const response = await GET(
      new Request("http://localhost:3000/api/mobile/oauth/start?provider=bad"),
    );

    expect(response.status).toBe(400);
    expect(isOAuthProviderConfiguredMock).not.toHaveBeenCalled();
  });

  it("stores mobile OAuth one-time codes as hashes", async () => {
    const { createMobileOAuthCode } = await import("@/lib/mobile-oauth");

    prismaMock.mobileOAuthCode.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.mobileOAuthCode.create.mockResolvedValue({});

    const code = await createMobileOAuthCode("user-1", "Vitest Mobile");
    const createCall = prismaMock.mobileOAuthCode.create.mock.calls[0]?.[0];

    expect(code).toEqual(expect.any(String));
    expect(createCall.data.userId).toBe("user-1");
    expect(createCall.data.codeHash).toBe(hashOAuthCode(code));
    expect(createCall.data.codeHash).not.toBe(code);
    expect(createCall.data.expiresAt).toBeInstanceOf(Date);
    expect(createCall.data.userAgent).toBe("Vitest Mobile");
  });

  it("exchanges a valid mobile OAuth code for mobile tokens", async () => {
    const { POST } = await import("@/app/api/mobile/oauth/exchange/route");
    const code = "a".repeat(43);

    prismaMock.mobileOAuthCode.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      user: {
        email: "user@example.com",
        id: "user-1",
        name: "User",
      },
      userId: "user-1",
    });
    prismaMock.mobileOAuthCode.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.apiSession.create.mockResolvedValue({ id: "api-session-1" });

    const response = await POST(
      createJsonRequest("/api/mobile/oauth/exchange", { code }),
    );
    const data = (await response.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    const lookupCall = prismaMock.mobileOAuthCode.findUnique.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(data.accessToken).toEqual(expect.any(String));
    expect(data.refreshToken).toEqual(expect.any(String));
    expect(lookupCall.where.codeHash).toBe(hashOAuthCode(code));
    expect(lookupCall.where.codeHash).not.toBe(code);
    expect(prismaMock.mobileOAuthCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { usedAt: expect.any(Date) },
        where: expect.objectContaining({
          codeHash: hashOAuthCode(code),
          usedAt: null,
        }),
      }),
    );
    expect(prismaMock.apiSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          userAgent: "Vitest Mobile",
        }),
      }),
    );
  });

  it("does not reuse a used mobile OAuth code", async () => {
    const { POST } = await import("@/app/api/mobile/oauth/exchange/route");
    const code = "b".repeat(43);

    prismaMock.mobileOAuthCode.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
      user: {
        email: "user@example.com",
        id: "user-1",
        name: "User",
      },
      userId: "user-1",
    });

    const response = await POST(
      createJsonRequest("/api/mobile/oauth/exchange", { code }),
    );
    const text = await response.text();

    expect(response.status).toBe(401);
    expect(text).not.toContain(code);
    expect(prismaMock.mobileOAuthCode.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.apiSession.create).not.toHaveBeenCalled();
  });

  it("does not exchange an expired mobile OAuth code", async () => {
    const { POST } = await import("@/app/api/mobile/oauth/exchange/route");
    const code = "c".repeat(43);

    prismaMock.mobileOAuthCode.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
      user: {
        email: "user@example.com",
        id: "user-1",
        name: "User",
      },
      userId: "user-1",
    });

    const response = await POST(
      createJsonRequest("/api/mobile/oauth/exchange", { code }),
    );
    const text = await response.text();

    expect(response.status).toBe(401);
    expect(text).not.toContain(code);
    expect(prismaMock.mobileOAuthCode.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.apiSession.create).not.toHaveBeenCalled();
  });

  it("does not exchange a mobile OAuth code claimed by another request", async () => {
    const { POST } = await import("@/app/api/mobile/oauth/exchange/route");
    const code = "d".repeat(43);

    prismaMock.mobileOAuthCode.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      user: {
        email: "user@example.com",
        id: "user-1",
        name: "User",
      },
      userId: "user-1",
    });
    prismaMock.mobileOAuthCode.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(
      createJsonRequest("/api/mobile/oauth/exchange", { code }),
    );

    expect(response.status).toBe(401);
    expect(prismaMock.apiSession.create).not.toHaveBeenCalled();
  });

  it("returns 429 after repeated mobile OAuth exchange attempts for the same code", async () => {
    const { POST } = await import("@/app/api/mobile/oauth/exchange/route");
    const code = "e".repeat(43);

    prismaMock.mobileOAuthCode.findUnique.mockResolvedValue(null);

    for (
      let index = 0;
      index < MOBILE_OAUTH_EXCHANGE_CODE_RATE_LIMIT.max;
      index += 1
    ) {
      const response = await POST(
        createJsonRequest("/api/mobile/oauth/exchange", { code }),
      );

      expect(response.status).toBe(401);
    }

    const response = await POST(
      createJsonRequest("/api/mobile/oauth/exchange", { code }),
    );
    const text = await response.text();

    expect(response.status).toBe(429);
    expect(text).toContain("試行回数が多すぎます");
    expect(text).not.toContain(code);
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
    expect(createCall.data.refreshTokenId).toEqual(expect.any(String));
    expect(createCall.data.tokenFamilyId).toBe(createCall.data.refreshTokenId);
    expect(createCall.data.refreshTokenHash).toEqual(expect.any(String));
    expect(createCall.data.refreshTokenHash).not.toBe(data.refreshToken);
    expect(createCall.data.userAgent).toBe("Vitest Mobile");
  });

  it("login allows attempts within the credentials rate limit", async () => {
    const { POST } = await import("@/app/api/mobile/auth/login/route");

    prismaMock.user.findUnique.mockResolvedValue({
      email: "user@example.com",
      id: "user-1",
      name: "User",
      password: "hashed-password",
    });
    bcryptCompareMock.mockResolvedValue(false);

    const response = await POST(
      createJsonRequest("/api/mobile/auth/login", {
        email: "user@example.com",
        password: "wrong-password",
      }),
    );

    expect(response.status).toBe(401);
  });

  it("login returns 429 after repeated credential failures", async () => {
    const { POST } = await import("@/app/api/mobile/auth/login/route");

    prismaMock.user.findUnique.mockResolvedValue({
      email: "user@example.com",
      id: "user-1",
      name: "User",
      password: "hashed-password",
    });
    bcryptCompareMock.mockResolvedValue(false);

    for (let index = 0; index < CREDENTIALS_LOGIN_EMAIL_IP_RATE_LIMIT.max; index += 1) {
      const response = await POST(
        createJsonRequest("/api/mobile/auth/login", {
          email: "user@example.com",
          password: "wrong-password",
        }),
      );

      expect(response.status).toBe(401);
    }

    const response = await POST(
      createJsonRequest("/api/mobile/auth/login", {
        email: "user@example.com",
        password: "wrong-password",
      }),
    );
    const text = await response.text();

    expect(response.status).toBe(429);
    expect(text).toContain("試行回数が多すぎます");
    expect(text).not.toContain("wrong-password");
    expect(text).not.toContain("user@example.com");
  });

  it("refresh returns a new accessToken and rotated refreshToken", async () => {
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const oldRefreshToken = "r".repeat(43);

    prismaMock.apiSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: "api-session-1",
      refreshTokenHash: hashRefreshToken(oldRefreshToken),
      refreshTokenId: null,
      revokedAt: null,
      tokenFamilyId: "api-session-1",
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
    expect(data.refreshToken).toContain(".");
    expect(updateCall.where.id).toBe("api-session-1");
    expect(updateCall.where.refreshTokenHash).toEqual(expect.any(String));
    expect(updateCall.data.previousRefreshTokenHash).toBe(
      hashRefreshToken(oldRefreshToken),
    );
    expect(updateCall.data.refreshTokenId).toEqual(expect.any(String));
    expect(updateCall.data.refreshTokenHash).not.toBe(oldRefreshToken);
    expect(updateCall.data.lastUsedAt).toBeInstanceOf(Date);
  });

  it("refresh returns 429 after repeated attempts for the same token", async () => {
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const refreshToken = "r".repeat(43);

    prismaMock.apiSession.findUnique.mockResolvedValue(null);

    for (let index = 0; index < MOBILE_REFRESH_TOKEN_RATE_LIMIT.max; index += 1) {
      const response = await POST(
        createJsonRequest("/api/mobile/auth/refresh", { refreshToken }),
      );

      expect(response.status).toBe(401);
    }

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(
      createJsonRequest("/api/mobile/auth/refresh", { refreshToken }),
    );
    const text = await response.text();

    expect(response.status).toBe(429);
    expect(text).toContain("試行回数が多すぎます");
    expect(text).not.toContain(refreshToken);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("rejects a replayed refreshToken when rotation no longer matches", async () => {
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const refreshToken = "r".repeat(43);
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    prismaMock.apiSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: "api-session-1",
      refreshTokenHash: hashRefreshToken(refreshToken),
      refreshTokenId: null,
      revokedAt: null,
      tokenFamilyId: "family-1",
      userId: "user-1",
    });
    prismaMock.apiSession.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(
      createJsonRequest("/api/mobile/auth/refresh", { refreshToken }),
    );

    expect(response.status).toBe(401);
    expect(prismaMock.apiSession.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
        where: { tokenFamilyId: "family-1" },
      }),
    );
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    expect(consoleWarnSpy.mock.calls[0]?.[0]).not.toContain(refreshToken);

    consoleWarnSpy.mockRestore();
  });

  it("returns 401 and revokes the whole token family when an old refreshToken is reused", async () => {
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const refreshTokenId = "familytokenid123456";
    const currentRefreshToken = `${refreshTokenId}.${"c".repeat(43)}`;
    const reusedRefreshToken = `${refreshTokenId}.${"r".repeat(43)}`;
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    prismaMock.apiSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: "api-session-1",
      refreshTokenHash: hashRefreshToken(currentRefreshToken),
      refreshTokenId,
      revokedAt: null,
      tokenFamilyId: "family-1",
      userId: "user-1",
    });
    prismaMock.apiSession.updateMany.mockResolvedValue({ count: 2 });

    const response = await POST(
      createJsonRequest("/api/mobile/auth/refresh", {
        refreshToken: reusedRefreshToken,
      }),
    );
    const text = await response.text();
    const auditLog = consoleWarnSpy.mock.calls[0]?.[0] ?? "";

    expect(response.status).toBe(401);
    expect(text).toContain("再ログインしてください");
    expect(text).not.toContain(reusedRefreshToken);
    expect(text).not.toContain(currentRefreshToken);
    expect(text).not.toContain(refreshTokenId);
    expect(prismaMock.apiSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { refreshTokenId },
      }),
    );
    expect(prismaMock.apiSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastUsedAt: expect.any(Date),
          revokedAt: expect.any(Date),
        }),
        where: { tokenFamilyId: "family-1" },
      }),
    );
    expect(auditLog).toContain("mobile_refresh_token_reuse_detected");
    expect(auditLog).toContain("refresh_token_reuse");
    expect(auditLog).not.toContain(reusedRefreshToken);
    expect(auditLog).not.toContain(currentRefreshToken);
    expect(auditLog).not.toContain(refreshTokenId);
    expect(auditLog).not.toContain("Bearer ");
    expect(auditLog).not.toContain("test-mobile-secret");

    consoleWarnSpy.mockRestore();
  });

  it("detects reuse of a rotated legacy refreshToken by its previous hash", async () => {
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const rotatedLegacyRefreshToken = "r".repeat(43);
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    prismaMock.apiSession.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        expiresAt: new Date(Date.now() + 60_000),
        id: "api-session-1",
        previousRefreshTokenHash: hashRefreshToken(rotatedLegacyRefreshToken),
        refreshTokenHash: hashRefreshToken(
          `familytokenid123456.${"c".repeat(43)}`,
        ),
        refreshTokenId: "familytokenid123456",
        revokedAt: null,
        tokenFamilyId: "family-1",
        userId: "user-1",
      });
    prismaMock.apiSession.updateMany.mockResolvedValue({ count: 1 });

    const response = await POST(
      createJsonRequest("/api/mobile/auth/refresh", {
        refreshToken: rotatedLegacyRefreshToken,
      }),
    );

    expect(response.status).toBe(401);
    expect(prismaMock.apiSession.findUnique).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          previousRefreshTokenHash: hashRefreshToken(rotatedLegacyRefreshToken),
        },
      }),
    );
    expect(prismaMock.apiSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenFamilyId: "family-1" },
      }),
    );
    expect(consoleWarnSpy.mock.calls[0]?.[0]).not.toContain(
      rotatedLegacyRefreshToken,
    );

    consoleWarnSpy.mockRestore();
  });

  it("does not refresh the same family after reuse detection revoked it", async () => {
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const refreshTokenId = "familytokenid123456";
    const refreshToken = `${refreshTokenId}.${"c".repeat(43)}`;
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    prismaMock.apiSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: "api-session-1",
      refreshTokenHash: hashRefreshToken(refreshToken),
      refreshTokenId,
      revokedAt: new Date(),
      tokenFamilyId: "family-1",
      userId: "user-1",
    });
    prismaMock.apiSession.updateMany.mockResolvedValue({ count: 2 });

    const response = await POST(
      createJsonRequest("/api/mobile/auth/refresh", { refreshToken }),
    );

    expect(response.status).toBe(401);
    expect(prismaMock.apiSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenFamilyId: "family-1" },
      }),
    );

    consoleWarnSpy.mockRestore();
  });

  it("does not refresh an expired refreshToken and revokes its token family", async () => {
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const refreshTokenId = "familytokenid123456";
    const refreshToken = `${refreshTokenId}.${"e".repeat(43)}`;
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    prismaMock.apiSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 60_000),
      id: "api-session-1",
      refreshTokenHash: hashRefreshToken(refreshToken),
      refreshTokenId,
      revokedAt: null,
      tokenFamilyId: "family-1",
      userId: "user-1",
    });
    prismaMock.apiSession.updateMany.mockResolvedValue({ count: 1 });

    const response = await POST(
      createJsonRequest("/api/mobile/auth/refresh", { refreshToken }),
    );

    expect(response.status).toBe(401);
    expect(prismaMock.apiSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenFamilyId: "family-1" },
      }),
    );

    consoleWarnSpy.mockRestore();
  });

  it("does not refresh after logout revokes the ApiSession", async () => {
    const { POST: logout } = await import("@/app/api/mobile/auth/logout/route");
    const { POST: refresh } = await import("@/app/api/mobile/auth/refresh/route");
    const refreshToken = "r".repeat(43);
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    prismaMock.apiSession.updateMany.mockResolvedValue({ count: 1 });

    const logoutResponse = await logout(
      createJsonRequest("/api/mobile/auth/logout", { refreshToken }),
    );

    prismaMock.apiSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: "api-session-1",
      refreshTokenHash: hashRefreshToken(refreshToken),
      refreshTokenId: null,
      revokedAt: new Date(),
      tokenFamilyId: "family-1",
      userId: "user-1",
    });

    const refreshResponse = await refresh(
      createJsonRequest("/api/mobile/auth/refresh", { refreshToken }),
    );

    expect(logoutResponse.status).toBe(200);
    expect(refreshResponse.status).toBe(401);
    expect(prismaMock.apiSession.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { tokenFamilyId: "family-1" },
      }),
    );

    consoleWarnSpy.mockRestore();
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

  it("AI generate returns 429 after repeated requests by the same user", async () => {
    const { POST } = await import("@/app/api/mobile/ai/generate/route");

    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });
    generateAiResultMock.mockResolvedValue("生成結果");

    for (let index = 0; index < AI_USER_RATE_LIMIT.max; index += 1) {
      const response = await POST(
        createJsonRequest("/api/mobile/ai/generate", {
          content: "本文",
          mode: "summarize",
        }),
      );

      expect(response.status).toBe(200);
    }

    const response = await POST(
      createJsonRequest("/api/mobile/ai/generate", {
        content: "本文",
        mode: "summarize",
      }),
    );
    const text = await response.text();

    expect(response.status).toBe(429);
    expect(text).toContain("試行回数が多すぎます");
    expect(text).not.toContain("user-1");
    expect(generateAiResultMock).toHaveBeenCalledTimes(AI_USER_RATE_LIMIT.max);
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
      .sign(new TextEncoder().encode(process.env.MOBILE_AUTH_SECRET!));

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
      .sign(new TextEncoder().encode(process.env.MOBILE_AUTH_SECRET!));

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

  it("rejects a valid Bearer token when its ApiSession is revoked", async () => {
    const { getMobileAuthUser } = await import("@/lib/mobile-auth");
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setJti("api-session-1")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.MOBILE_AUTH_SECRET!));

    prismaMock.apiSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user: { id: "user-1" },
      userId: "user-1",
    });

    const user = await getMobileAuthUser(
      new Request("http://localhost:3000/api/mobile/posts", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(user).toBeNull();
    expect(prismaMock.apiSession.update).not.toHaveBeenCalled();
  });

  it("mobile post API rejects a valid Bearer token after its token family is revoked", async () => {
    const { GET } = await import("@/app/api/mobile/posts/route");
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setJti("api-session-1")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.MOBILE_AUTH_SECRET!));

    prismaMock.apiSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user: { id: "user-1" },
      userId: "user-1",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/mobile/posts", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    const text = await response.text();

    expect(response.status).toBe(401);
    expect(text).not.toContain(token);
    expect(prismaMock.apiSession.update).not.toHaveBeenCalled();
  });
});
