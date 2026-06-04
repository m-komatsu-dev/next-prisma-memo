import { handlers } from "@/auth"; // Referring to the auth.ts we just created
import {
  checkCredentialsLoginRateLimit,
  getCredentialsRateLimitEmailFromRequest,
  getCredentialsRateLimitHeaders,
} from "@/lib/credentials-auth";
import { RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const { GET } = handlers;

export async function POST(request: NextRequest) {
  if (new URL(request.url).pathname.endsWith("/api/auth/callback/credentials")) {
    const email = await getCredentialsRateLimitEmailFromRequest(request);
    const rateLimit = checkCredentialsLoginRateLimit(request, email);

    if (rateLimit.blockedBy) {
      return NextResponse.json(
        { error: RATE_LIMIT_MESSAGE },
        {
          headers: getCredentialsRateLimitHeaders(rateLimit),
          status: 429,
        },
      );
    }
  }

  return handlers.POST(request);
}
