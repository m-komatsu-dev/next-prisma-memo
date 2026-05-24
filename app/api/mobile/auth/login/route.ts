import { createMobileAccessToken } from "@/lib/mobile-auth";
import { withMobileCors } from "@/lib/mobile-cors";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import { loginSchema } from "@/lib/zod";
import bcrypt from "bcrypt";
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

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
      },
    });

    if (!user?.password) {
      return withMobileCors(
        request,
        NextResponse.json(invalidCredentialsResponse, { status: 401 }),
      );
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return withMobileCors(
        request,
        NextResponse.json(invalidCredentialsResponse, { status: 401 }),
      );
    }

    const accessToken = await createMobileAccessToken(user.id);

    return withMobileCors(
      request,
      NextResponse.json({
        accessToken,
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
