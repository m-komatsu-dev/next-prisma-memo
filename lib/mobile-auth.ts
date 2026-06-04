import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";

export const MOBILE_ACCESS_TOKEN_EXPIRES_IN = "15m";
export const MOBILE_REFRESH_TOKEN_EXPIRES_IN_DAYS = 30;

export type MobileAuthUser = {
  id: string;
};

type RefreshTokenParts = {
  refreshToken: string;
  refreshTokenId: string;
};

type RefreshApiSession = {
  expiresAt: Date;
  id: string;
  previousRefreshTokenHash: string | null;
  refreshTokenHash: string;
  refreshTokenId: string | null;
  revokedAt: Date | null;
  tokenFamilyId: string;
  userId: string;
};

type RefreshApiSessionMatch = {
  apiSession: RefreshApiSession;
  matchedRotatedToken: boolean;
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

function createTokenId() {
  return randomBytes(16).toString("base64url");
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

function createRefreshToken(refreshTokenId = createTokenId()): RefreshTokenParts {
  const refreshTokenSecret = randomBytes(32).toString("base64url");

  return {
    refreshToken: `${refreshTokenId}.${refreshTokenSecret}`,
    refreshTokenId,
  };
}

function parseRefreshToken(refreshToken: string) {
  const [refreshTokenId, refreshTokenSecret, ...rest] = refreshToken.split(".");

  if (
    rest.length === 0 &&
    /^[A-Za-z0-9_-]{16,128}$/.test(refreshTokenId ?? "") &&
    /^[A-Za-z0-9_-]{32,256}$/.test(refreshTokenSecret ?? "")
  ) {
    return { refreshTokenId };
  }

  return { refreshTokenId: null };
}

export function hashMobileRefreshToken(refreshToken: string) {
  return createHash("sha256").update(refreshToken).digest("hex");
}

function createAuditFingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
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
  const { refreshToken, refreshTokenId } = createRefreshToken();
  const apiSession = await prisma.apiSession.create({
    data: {
      expiresAt: getRefreshTokenExpiresAt(),
      refreshTokenId,
      refreshTokenHash: hashMobileRefreshToken(refreshToken),
      tokenFamilyId: refreshTokenId,
      userAgent: userAgent?.slice(0, 512) ?? null,
      userId,
    },
    select: { id: true },
  });
  const accessToken = await createMobileSessionAccessToken(userId, apiSession.id);

  return { accessToken, refreshToken };
}

async function revokeTokenFamilyForReuse(
  apiSession: RefreshApiSession,
  now: Date,
  reason: string,
) {
  const result = await prisma.apiSession.updateMany({
    data: {
      lastUsedAt: now,
      revokedAt: now,
    },
    where: {
      tokenFamilyId: apiSession.tokenFamilyId,
    },
  });

  console.warn(
    JSON.stringify({
      level: "warn",
      timestamp: now.toISOString(),
      event: "mobile_refresh_token_reuse_detected",
      context: {
        action: "mobileRefreshTokenReuse",
        apiSessionId: apiSession.id,
        familyFingerprint: createAuditFingerprint(apiSession.tokenFamilyId),
        reason,
        revokedSessions: result.count,
        userId: apiSession.userId,
      },
    }),
  );
}

async function findRefreshApiSession(
  refreshTokenHash: string,
  refreshTokenId: string | null,
): Promise<RefreshApiSessionMatch | null> {
  const select = {
    expiresAt: true,
    id: true,
    previousRefreshTokenHash: true,
    refreshTokenHash: true,
    refreshTokenId: true,
    revokedAt: true,
    tokenFamilyId: true,
    userId: true,
  } as const;

  if (refreshTokenId) {
    const apiSession = await prisma.apiSession.findUnique({
      where: { refreshTokenId },
      select,
    });

    return apiSession ? { apiSession, matchedRotatedToken: false } : null;
  }

  const currentApiSession = await prisma.apiSession.findUnique({
    where: { refreshTokenHash },
    select,
  });

  if (currentApiSession) {
    return { apiSession: currentApiSession, matchedRotatedToken: false };
  }

  const rotatedApiSession = await prisma.apiSession.findUnique({
    where: { previousRefreshTokenHash: refreshTokenHash },
    select,
  });

  return rotatedApiSession
    ? { apiSession: rotatedApiSession, matchedRotatedToken: true }
    : null;
}

export async function refreshMobileApiSession(refreshToken: string) {
  const now = new Date();
  const parsedRefreshToken = parseRefreshToken(refreshToken);
  const refreshTokenHash = hashMobileRefreshToken(refreshToken);
  const matchedApiSession = await findRefreshApiSession(
    refreshTokenHash,
    parsedRefreshToken.refreshTokenId,
  );

  if (!matchedApiSession) {
    return null;
  }

  const { apiSession } = matchedApiSession;

  if (apiSession.revokedAt) {
    await revokeTokenFamilyForReuse(apiSession, now, "revoked_session");
    return null;
  }

  if (apiSession.expiresAt.getTime() <= now.getTime()) {
    await revokeTokenFamilyForReuse(apiSession, now, "expired_session");
    return null;
  }

  if (matchedApiSession.matchedRotatedToken) {
    await revokeTokenFamilyForReuse(apiSession, now, "refresh_token_reuse");
    return null;
  }

  if (
    parsedRefreshToken.refreshTokenId &&
    apiSession.refreshTokenHash !== refreshTokenHash
  ) {
    await revokeTokenFamilyForReuse(apiSession, now, "refresh_token_reuse");
    return null;
  }

  const nextRefreshToken = createRefreshToken(
    apiSession.refreshTokenId ?? undefined,
  );

  const result = await prisma.$transaction(async (tx) =>
    tx.apiSession.updateMany({
      data: {
        lastUsedAt: now,
        previousRefreshTokenHash: refreshTokenHash,
        refreshTokenHash: hashMobileRefreshToken(nextRefreshToken.refreshToken),
        refreshTokenId: nextRefreshToken.refreshTokenId,
      },
      where: {
        expiresAt: { gt: now },
        id: apiSession.id,
        refreshTokenHash,
        revokedAt: null,
      },
    }),
  );

  if (result.count === 0) {
    await revokeTokenFamilyForReuse(apiSession, now, "rotation_conflict");
    return null;
  }

  const accessToken = await createMobileSessionAccessToken(
    apiSession.userId,
    apiSession.id,
  );

  return { accessToken, refreshToken: nextRefreshToken.refreshToken };
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
