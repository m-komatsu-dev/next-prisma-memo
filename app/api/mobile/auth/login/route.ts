import { createMobileApiSession } from "@/lib/mobile-auth";
import { withMobileCors } from "@/lib/mobile-cors";
import {
  checkCredentialsLoginRateLimit,
  getCredentialsRateLimitHeaders,
  recordCredentialsLoginFailure,
  resetCredentialsLoginRateLimit,
  verifyCredentialsUser,
} from "@/lib/credentials-auth";
import { RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { logServerError } from "@/lib/server-errors";
import { loginSchema } from "@/lib/zod";
import { NextResponse } from "next/server";

const invalidCredentialsResponse = {
  error: "メールアドレスまたはパスワードが正しくありません。",
};

export async function POST(request: Request) {
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

  const validatedFields = loginSchema.safeParse(body);

  if (!validatedFields.success) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "メールアドレスまたはパスワードの形式が正しくありません。" },
        { status: 400 },
      ),
    );
  }

  const { email, password } = validatedFields.data;
  const rateLimit = checkCredentialsLoginRateLimit(request, email);

  if (rateLimit.blockedBy) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: RATE_LIMIT_MESSAGE },
        {
          headers: getCredentialsRateLimitHeaders(rateLimit),
          status: 429,
        },
      ),
    );
  }

  try {
    const user = await verifyCredentialsUser({ email, password });

    if (!user) {
      recordCredentialsLoginFailure(request, email);
      return withMobileCors(
        request,
        NextResponse.json(invalidCredentialsResponse, { status: 401 }),
      );
    }

    resetCredentialsLoginRateLimit(request, email);

    const { accessToken, refreshToken } = await createMobileApiSession(
      user.id,
      request.headers.get("user-agent"),
    );

    return withMobileCors(
      request,
      NextResponse.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileLogin",
      details: { provider: "credentials" },
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "ログイン処理に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}
