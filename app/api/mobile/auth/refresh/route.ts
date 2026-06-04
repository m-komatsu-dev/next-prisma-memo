import { refreshMobileApiSession } from "@/lib/mobile-auth";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import {
  MOBILE_REFRESH_IP_RATE_LIMIT,
  MOBILE_REFRESH_TOKEN_RATE_LIMIT,
  RATE_LIMIT_MESSAGE,
  consumeRateLimit,
  getClientIp,
  getRateLimitHeaders,
  makeRateLimitKey,
} from "@/lib/rate-limit";
import { logServerError } from "@/lib/server-errors";
import { mobileRefreshTokenRequestSchema } from "@/lib/zod";
import { NextResponse } from "next/server";

const invalidRefreshTokenResponse = {
  error: "ログイン情報を更新できません。再ログインしてください。",
};

export async function POST(request: Request) {
  const ipRateLimit = consumeRateLimit(
    makeRateLimitKey("mobile-refresh:ip", [getClientIp(request)]),
    MOBILE_REFRESH_IP_RATE_LIMIT,
  );

  if (!ipRateLimit.allowed) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: RATE_LIMIT_MESSAGE },
        {
          headers: getRateLimitHeaders(ipRateLimit),
          status: 429,
        },
      ),
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "リクエスト本文の形式が正しくありません。" },
        { status: 400 },
      ),
    );
  }

  const validatedFields = mobileRefreshTokenRequestSchema.safeParse(body);

  if (!validatedFields.success) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "refreshTokenの形式が正しくありません。" },
        { status: 400 },
      ),
    );
  }

  const tokenRateLimit = consumeRateLimit(
    makeRateLimitKey("mobile-refresh:token", [
      validatedFields.data.refreshToken,
    ]),
    MOBILE_REFRESH_TOKEN_RATE_LIMIT,
  );

  if (!tokenRateLimit.allowed) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: RATE_LIMIT_MESSAGE },
        {
          headers: getRateLimitHeaders(tokenRateLimit),
          status: 429,
        },
      ),
    );
  }

  try {
    const tokens = await refreshMobileApiSession(
      validatedFields.data.refreshToken,
    );

    if (!tokens) {
      return withMobileCors(
        request,
        NextResponse.json(invalidRefreshTokenResponse, { status: 401 }),
      );
    }

    return withMobileCors(request, NextResponse.json(tokens));
  } catch (error) {
    logServerError(error, {
      action: "mobileRefreshToken",
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "トークン更新に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}
