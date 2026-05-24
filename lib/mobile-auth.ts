import { auth } from "@/auth";
import { SignJWT, jwtVerify } from "jose";

const MOBILE_ACCESS_TOKEN_EXPIRES_IN = "12h";

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

export async function createMobileAccessToken(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(MOBILE_ACCESS_TOKEN_EXPIRES_IN)
    .sign(getMobileAuthSecret());
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

    return { id: payload.sub };
  } catch {
    return null;
  }
}

export async function getMobileAuthUser(
  request: Request,
): Promise<MobileAuthUser | null> {
  const session = await auth();

  if (session?.user?.id) {
    return { id: session.user.id };
  }

  return getUserFromBearerToken(request);
}
