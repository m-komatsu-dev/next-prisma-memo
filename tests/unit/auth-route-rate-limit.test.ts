import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCredentialsRateLimitHeaders,
  recordCredentialsLoginFailure,
} from "@/lib/credentials-auth";
import {
  CREDENTIALS_LOGIN_EMAIL_IP_RATE_LIMIT,
  resetAllRateLimits,
} from "@/lib/rate-limit";

const authPostMock = vi.hoisted(() =>
  vi.fn(async () => Response.json({ ok: true })),
);
const authGetMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({
  handlers: {
    GET: authGetMock,
    POST: authPostMock,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
  },
}));


function createCredentialsCallbackRequest(
  email = "user@example.com",
): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/auth/callback/credentials",
    {
      body: new URLSearchParams({
        email,
        password: "wrong-password",
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-forwarded-for": "203.0.113.10",
      },
      method: "POST",
    },
  );
}

describe("Auth.js credentials callback rate limit", () => {
  beforeEach(() => {
    resetAllRateLimits();
    vi.clearAllMocks();
  });

  it("passes through attempts within the credentials rate limit", async () => {
    const { POST } = await import("@/app/api/auth/[...nextauth]/route");

    recordCredentialsLoginFailure(
      createCredentialsCallbackRequest(),
      "user@example.com",
    );

    const response = await POST(createCredentialsCallbackRequest());

    expect(response.status).toBe(200);
    expect(authPostMock).toHaveBeenCalledOnce();
  });

  it("returns 429 for a blocked credentials callback without exposing secrets", async () => {
    const { POST } = await import("@/app/api/auth/[...nextauth]/route");

    for (let index = 0; index < CREDENTIALS_LOGIN_EMAIL_IP_RATE_LIMIT.max; index += 1) {
      recordCredentialsLoginFailure(
        createCredentialsCallbackRequest(),
        "user@example.com",
      );
    }

    const response = await POST(createCredentialsCallbackRequest());
    const text = await response.text();

    expect(response.status).toBe(429);
    expect(text).toContain("試行回数が多すぎます");
    expect(text).not.toContain("wrong-password");
    expect(text).not.toContain("user@example.com");
    expect(text).not.toContain("203.0.113.10");
    expect(authPostMock).not.toHaveBeenCalled();
  });

  it("keeps rate limit response headers free of key material", () => {
    const rateLimit = {
      blockedBy: "emailAndIp" as const,
      result: {
        allowed: false,
        limit: 5,
        remaining: 0,
        resetAt: new Date("2026-06-04T00:00:00.000Z"),
        retryAfterSeconds: 60,
      },
    };

    expect(JSON.stringify(getCredentialsRateLimitHeaders(rateLimit))).not.toMatch(
      /user@example.com|203\.0\.113\.10|wrong-password/,
    );
  });
});
