import { refreshMobileApiSession } from "@/lib/mobile-auth";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import { logServerError } from "@/lib/server-errors";
import { mobileRefreshTokenRequestSchema } from "@/lib/zod";
import { NextResponse } from "next/server";

const invalidRefreshTokenResponse = {
  error: "refreshTokenが無効、または期限切れです。",
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
