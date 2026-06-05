import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "node:crypto";
import { createMobileApiSession } from "./mobile-auth";

export const MOBILE_OAUTH_PROVIDERS = ["google", "github"] as const;
export const MOBILE_OAUTH_CODE_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_MOBILE_OAUTH_CALLBACK_URL = "mymemo://auth/callback";

export type MobileOAuthProvider = (typeof MOBILE_OAUTH_PROVIDERS)[number];

export function isMobileOAuthProvider(
  provider: string | null,
): provider is MobileOAuthProvider {
  return provider === "google" || provider === "github";
}

export function getMobileOAuthCallbackUrl() {
  return (
    process.env.MOBILE_OAUTH_CALLBACK_URL ??
    DEFAULT_MOBILE_OAUTH_CALLBACK_URL
  );
}

export function hashMobileOAuthCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function createMobileOAuthCode(
  userId: string,
  userAgent?: string | null,
) {
  const code = randomBytes(32).toString("base64url");
  const now = new Date();

  await prisma.mobileOAuthCode.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  await prisma.mobileOAuthCode.create({
    data: {
      codeHash: hashMobileOAuthCode(code),
      expiresAt: new Date(now.getTime() + MOBILE_OAUTH_CODE_TTL_MS),
      userAgent: userAgent?.slice(0, 512) ?? null,
      userId,
    },
  });

  return code;
}

export async function exchangeMobileOAuthCode(
  code: string,
  userAgent?: string | null,
) {
  const codeHash = hashMobileOAuthCode(code);
  const now = new Date();

  const mobileOAuthCode = await prisma.mobileOAuthCode.findUnique({
    where: { codeHash },
    select: {
      expiresAt: true,
      usedAt: true,
      user: {
        select: {
          email: true,
          id: true,
          name: true,
        },
      },
      userId: true,
    },
  });

  if (
    !mobileOAuthCode ||
    mobileOAuthCode.usedAt ||
    mobileOAuthCode.expiresAt.getTime() <= now.getTime()
  ) {
    return null;
  }

  const claimed = await prisma.mobileOAuthCode.updateMany({
    data: { usedAt: now },
    where: {
      codeHash,
      expiresAt: { gt: now },
      usedAt: null,
    },
  });

  if (claimed.count !== 1) {
    return null;
  }

  const tokens = await createMobileApiSession(
    mobileOAuthCode.userId,
    userAgent,
  );

  return {
    ...tokens,
    user: mobileOAuthCode.user,
  };
}
