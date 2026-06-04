import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";

export const MOBILE_ACCESS_TOKEN_EXPIRES_IN = "15m";
export const MOBILE_REFRESH_TOKEN_EXPIRES_IN_DAYS = 30;

export type MobileAuthUser = {
  id: string;
};

function getMobileAuthSecret() {
  const secret = process.env.MOBILE_AUTH_SECRET ?? process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("MOBILE_AUTH_SECRET or AUTH_SECRET is required.");
  }

  return new TextEncoder().encode(secret);
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token, ...rest] = authorization.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) {
    return null;
  }

  return token;
}

async function createMobileSessionAccessToken(
  userId: string,
  apiSessionId: string,
) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(apiSessionId)
    .setIssuedAt()
    .setExpirationTime(MOBILE_ACCESS_TOKEN_EXPIRES_IN)
    .sign(getMobileAuthSecret());
}

function createRefreshToken() {
  return randomBytes(32).toString("base64url");
}

export function hashMobileRefreshToken(refreshToken: string) {
  return createHash("sha256").update(refreshToken).digest("hex");
}

function getRefreshTokenExpiresAt(now = new Date()) {
  return new Date(
    now.getTime() + MOBILE_REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  );
}

export async function createMobileApiSession(
  userId: string,
  userAgent?: string | null,
) {
  const refreshToken = createRefreshToken();
  const apiSession = await prisma.apiSession.create({
    data: {
      expiresAt: getRefreshTokenExpiresAt(),
      refreshTokenHash: hashMobileRefreshToken(refreshToken),
      userAgent: userAgent?.slice(0, 512) ?? null,
      userId,
    },
    select: { id: true },
  });
  const accessToken = await createMobileSessionAccessToken(userId, apiSession.id);

  return { accessToken, refreshToken };
}

export async function refreshMobileApiSession(refreshToken: string) {
  const now = new Date();
  const refreshTokenHash = hashMobileRefreshToken(refreshToken);
  const apiSession = await prisma.apiSession.findUnique({
    where: { refreshTokenHash },
    select: {
      expiresAt: true,
      id: true,
      revokedAt: true,
      userId: true,
    },
  });

  if (
    !apiSession ||
    apiSession.revokedAt ||
    apiSession.expiresAt.getTime() <= now.getTime()
  ) {
    return null;
  }

  const nextRefreshToken = createRefreshToken();

  const result = await prisma.apiSession.updateMany({
    data: {
      lastUsedAt: now,
      refreshTokenHash: hashMobileRefreshToken(nextRefreshToken),
    },
    where: {
      expiresAt: { gt: now },
      id: apiSession.id,
      refreshTokenHash,
      revokedAt: null,
    },
  });

  if (result.count === 0) {
    return null;
  }

  const accessToken = await createMobileSessionAccessToken(
    apiSession.userId,
    apiSession.id,
  );

  return { accessToken, refreshToken: nextRefreshToken };
}

export async function revokeMobileApiSession(refreshToken: string) {
  const now = new Date();
  const result = await prisma.apiSession.updateMany({
    data: {
      lastUsedAt: now,
      revokedAt: now,
    },
    where: {
      expiresAt: { gt: now },
      refreshTokenHash: hashMobileRefreshToken(refreshToken),
      revokedAt: null,
    },
  });

  return result.count > 0;
}

async function getUserFromBearerToken(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getMobileAuthSecret(), {
      algorithms: ["HS256"],
    });

    if (typeof payload.sub !== "string" || !payload.sub) {
      return null;
    }

    if (typeof payload.jti !== "string" || !payload.jti) {
      return null;
    }

    // The JWT id is bound to an active API session so stolen/rotated refresh tokens can be revoked server-side.
    const apiSession = await prisma.apiSession.findUnique({
      where: { id: payload.jti },
      select: {
        expiresAt: true,
        revokedAt: true,
        user: { select: { id: true } },
        userId: true,
      },
    });

    if (
      !apiSession ||
      apiSession.userId !== payload.sub ||
      apiSession.revokedAt ||
      apiSession.expiresAt.getTime() <= Date.now()
    ) {
      return null;
    }

    await prisma.apiSession
      .update({
        data: { lastUsedAt: new Date() },
        where: { id: payload.jti },
      })
      .catch(() => null);

    return apiSession.user;
  } catch {
    return null;
  }
}

export async function getMobileAuthUser(
  request: Request,
): Promise<MobileAuthUser | null> {
  const session = await auth();

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });

    return user;
  }

  return getUserFromBearerToken(request);
}
