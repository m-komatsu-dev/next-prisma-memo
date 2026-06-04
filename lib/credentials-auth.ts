import { prisma } from "@/lib/prisma";
import {
  CREDENTIALS_LOGIN_EMAIL_IP_RATE_LIMIT,
  CREDENTIALS_LOGIN_IP_RATE_LIMIT,
  checkRateLimit,
  consumeRateLimit,
  getClientIp,
  getRateLimitHeaders,
  makeRateLimitKey,
  normalizeRateLimitEmail,
  resetRateLimit,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { logServerError } from "@/lib/server-errors";
import { loginSchema } from "@/lib/zod";
import bcrypt from "bcrypt";

export type CredentialsAuthUser = {
  email: string | null;
  id: string;
  image?: string | null;
  name: string | null;
};

type CredentialsRateLimitCheck = {
  blockedBy: "emailAndIp" | "ip" | null;
  result: RateLimitResult;
};

export function getCredentialsRateLimitEmail(credentials: unknown) {
  if (!credentials || typeof credentials !== "object") {
    return null;
  }

  return normalizeRateLimitEmail(
    (credentials as Record<string, unknown>).email,
  );
}

export async function getCredentialsRateLimitEmailFromRequest(request: Request) {
  try {
    const formData = await request.clone().formData();
    return normalizeRateLimitEmail(formData.get("email"));
  } catch {
    return null;
  }
}

export function checkCredentialsLoginRateLimit(
  request: Request,
  email: string | null,
): CredentialsRateLimitCheck {
  const keys = getCredentialsRateLimitKeys(request, email);

  if (keys.emailAndIp) {
    const emailAndIpResult = checkRateLimit(
      keys.emailAndIp,
      CREDENTIALS_LOGIN_EMAIL_IP_RATE_LIMIT,
    );

    if (!emailAndIpResult.allowed) {
      return { blockedBy: "emailAndIp", result: emailAndIpResult };
    }
  }

  const ipResult = checkRateLimit(keys.ip, CREDENTIALS_LOGIN_IP_RATE_LIMIT);

  return {
    blockedBy: ipResult.allowed ? null : "ip",
    result: ipResult,
  };
}

export function recordCredentialsLoginFailure(
  request: Request,
  email: string | null,
) {
  const keys = getCredentialsRateLimitKeys(request, email);

  consumeRateLimit(keys.ip, CREDENTIALS_LOGIN_IP_RATE_LIMIT);

  if (keys.emailAndIp) {
    consumeRateLimit(keys.emailAndIp, CREDENTIALS_LOGIN_EMAIL_IP_RATE_LIMIT);
  }
}

export function resetCredentialsLoginRateLimit(
  request: Request,
  email: string | null,
) {
  const keys = getCredentialsRateLimitKeys(request, email);

  if (keys.emailAndIp) {
    resetRateLimit(keys.emailAndIp);
  }
}

export function getCredentialsRateLimitHeaders(
  check: CredentialsRateLimitCheck,
) {
  return getRateLimitHeaders(check.result);
}

export async function verifyCredentialsUser(credentials: unknown) {
  const validatedFields = loginSchema.safeParse(credentials);

  if (!validatedFields.success) {
    return null;
  }

  const { email, password } = validatedFields.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        email: true,
        id: true,
        image: true,
        name: true,
        password: true,
      },
    });

    if (!user?.password) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return null;
    }

    return {
      email: user.email,
      id: user.id,
      image: user.image,
      name: user.name,
    } satisfies CredentialsAuthUser;
  } catch (error) {
    logServerError(error, {
      action: "verifyCredentialsUser",
      details: { provider: "credentials" },
    });
    return null;
  }
}

function getCredentialsRateLimitKeys(request: Request, email: string | null) {
  const ip = getClientIp(request);

  return {
    ip: makeRateLimitKey("credentials-login:ip", [ip]),
    emailAndIp: email
      ? makeRateLimitKey("credentials-login:email-ip", [email, ip])
      : null,
  };
}
