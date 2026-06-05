import { createHash } from "node:crypto";

export type RateLimitConfig = {
  max: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();
let cleanupCounter = 0;

export const RATE_LIMIT_MESSAGE =
  "試行回数が多すぎます。少し時間をおいて再度お試しください。";

export const CREDENTIALS_LOGIN_IP_RATE_LIMIT = {
  max: 20,
  windowMs: 15 * 60 * 1000,
} satisfies RateLimitConfig;

export const CREDENTIALS_LOGIN_EMAIL_IP_RATE_LIMIT = {
  max: 5,
  windowMs: 15 * 60 * 1000,
} satisfies RateLimitConfig;

export const MOBILE_REFRESH_IP_RATE_LIMIT = {
  max: 60,
  windowMs: 5 * 60 * 1000,
} satisfies RateLimitConfig;

export const MOBILE_REFRESH_TOKEN_RATE_LIMIT = {
  max: 10,
  windowMs: 15 * 60 * 1000,
} satisfies RateLimitConfig;

export const MOBILE_OAUTH_EXCHANGE_IP_RATE_LIMIT = {
  max: 30,
  windowMs: 5 * 60 * 1000,
} satisfies RateLimitConfig;

export const MOBILE_OAUTH_EXCHANGE_CODE_RATE_LIMIT = {
  max: 5,
  windowMs: 5 * 60 * 1000,
} satisfies RateLimitConfig;

export const AI_USER_RATE_LIMIT = {
  max: 10,
  windowMs: 60 * 1000,
} satisfies RateLimitConfig;

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedIp ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

export function normalizeRateLimitEmail(email: unknown) {
  if (typeof email !== "string") {
    return null;
  }

  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

export function hashRateLimitPart(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function makeRateLimitKey(scope: string, parts: string[]) {
  return `${scope}:${hashRateLimitPart(parts.join("\u001f"))}`;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  now = Date.now(),
): RateLimitResult {
  cleanupExpiredBuckets(now);

  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    return buildResult(true, 0, now + config.windowMs, config);
  }

  return buildResult(entry.count < config.max, entry.count, entry.resetAt, config);
}

export function consumeRateLimit(
  key: string,
  config: RateLimitConfig,
  now = Date.now(),
): RateLimitResult {
  cleanupExpiredBuckets(now);

  const current = buckets.get(key);
  const entry =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + config.windowMs }
      : current;

  entry.count += 1;
  buckets.set(key, entry);

  return buildResult(entry.count <= config.max, entry.count, entry.resetAt, config);
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function resetAllRateLimits() {
  buckets.clear();
}

export function getRateLimitHeaders(result: RateLimitResult) {
  return {
    "Retry-After": String(result.retryAfterSeconds),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt.getTime() / 1000)),
  };
}

function buildResult(
  allowed: boolean,
  count: number,
  resetAt: number,
  config: RateLimitConfig,
): RateLimitResult {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((resetAt - Date.now()) / 1000),
  );

  return {
    allowed,
    limit: config.max,
    remaining: Math.max(0, config.max - count),
    resetAt: new Date(resetAt),
    retryAfterSeconds,
  };
}

function cleanupExpiredBuckets(now: number) {
  cleanupCounter += 1;
  if (cleanupCounter < 100) {
    return;
  }

  cleanupCounter = 0;

  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
