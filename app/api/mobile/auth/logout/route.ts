import { revokeMobileApiSession } from "@/lib/mobile-auth";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import { logServerError } from "@/lib/server-errors";
import { mobileRefreshTokenRequestSchema } from "@/lib/zod";
import { NextResponse } from "next/server";

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
    const revoked = await revokeMobileApiSession(
      validatedFields.data.refreshToken,
    );

    if (!revoked) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "refreshTokenが無効、または期限切れです。" },
          { status: 401 },
        ),
      );
    }

    return withMobileCors(request, NextResponse.json({ success: true }));
  } catch (error) {
    logServerError(error, {
      action: "mobileLogout",
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "ログアウト処理に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}
