import { exchangeMobileOAuthCode } from "@/lib/mobile-oauth";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import {
  MOBILE_OAUTH_EXCHANGE_CODE_RATE_LIMIT,
  MOBILE_OAUTH_EXCHANGE_IP_RATE_LIMIT,
  RATE_LIMIT_MESSAGE,
  consumeRateLimit,
  getClientIp,
  getRateLimitHeaders,
  makeRateLimitKey,
} from "@/lib/rate-limit";
import { logServerError } from "@/lib/server-errors";
import { mobileOAuthExchangeSchema } from "@/lib/zod";
import { NextResponse } from "next/server";

const invalidCodeResponse = {
  error: "ログインコードが無効、または期限切れです。もう一度お試しください。",
};

export async function POST(request: Request) {
  const ipRateLimit = consumeRateLimit(
    makeRateLimitKey("mobile-oauth-exchange:ip", [getClientIp(request)]),
    MOBILE_OAUTH_EXCHANGE_IP_RATE_LIMIT,
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

  const validatedFields = mobileOAuthExchangeSchema.safeParse(body);

  if (!validatedFields.success) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "codeの形式が正しくありません。" },
        { status: 400 },
      ),
    );
  }

  const codeRateLimit = consumeRateLimit(
    makeRateLimitKey("mobile-oauth-exchange:code", [
      validatedFields.data.code,
    ]),
    MOBILE_OAUTH_EXCHANGE_CODE_RATE_LIMIT,
  );

  if (!codeRateLimit.allowed) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: RATE_LIMIT_MESSAGE },
        {
          headers: getRateLimitHeaders(codeRateLimit),
          status: 429,
        },
      ),
    );
  }

  try {
    const session = await exchangeMobileOAuthCode(
      validatedFields.data.code,
      request.headers.get("user-agent"),
    );

    if (!session) {
      return withMobileCors(
        request,
        NextResponse.json(invalidCodeResponse, { status: 401 }),
      );
    }

    return withMobileCors(request, NextResponse.json(session));
  } catch (error) {
    logServerError(error, {
      action: "mobileOAuthExchange",
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "OAuthログイン処理に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}
