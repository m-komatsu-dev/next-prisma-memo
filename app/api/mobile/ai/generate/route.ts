import { AiContentError, generateAiResult } from "@/lib/ai-content";
import { getMobileAuthUser } from "@/lib/mobile-auth";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import { logServerError } from "@/lib/server-errors";
import {
  aiGeneratedResultSchema,
  getFirstZodErrorMessage,
  mobileAiGenerateRequestSchema,
} from "@/lib/zod";
import { NextResponse } from "next/server";

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}

export async function POST(request: Request) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
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

  const validatedFields = mobileAiGenerateRequestSchema.safeParse(body);

  if (!validatedFields.success) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: getFirstZodErrorMessage(validatedFields.error) },
        { status: 400 },
      ),
    );
  }

  const { content, mode } = validatedFields.data;

  try {
    const result = await generateAiResult(content, mode);
    const validatedResult = aiGeneratedResultSchema.safeParse(result);

    if (!validatedResult.success) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "AIの結果を読み取れませんでした。" },
          { status: 500 },
        ),
      );
    }

    return withMobileCors(
      request,
      NextResponse.json({ result: validatedResult.data }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileGenerateAiContent",
      userId: authUser.id,
      details: { mode },
    });

    return withMobileCors(
      request,
      NextResponse.json(
        {
          error:
            error instanceof AiContentError
              ? error.message
              : "AI生成に失敗しました。",
        },
        { status: 500 },
      ),
    );
  }
}
