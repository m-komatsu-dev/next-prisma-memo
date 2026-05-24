// app/posts/[id]/edit/ai-actions.ts
"use server";

import { auth } from "@/auth";
import { AiContentError, generateAiResult, type AiMode } from "@/lib/ai-content";
import { logServerError } from "@/lib/server-errors";
import {
  aiContentRequestSchema,
  aiGeneratedResultSchema,
  getFirstZodErrorMessage,
} from "@/lib/zod";
export type { AiMode };

type AiSuccess = {
  success: true;
  result: string;
};

type AiFailure = {
  success: false;
  result: string;
};

type AiResponse = AiSuccess | AiFailure;

export async function generateAiContent(content: string, mode: AiMode): Promise<AiResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, result: "ログインが必要です。" };
  }

  const validatedFields = aiContentRequestSchema.safeParse({ content, mode });
  if (!validatedFields.success) {
    return { success: false, result: getFirstZodErrorMessage(validatedFields.error) };
  }

  const { content: trimmedContent, mode: validatedMode } = validatedFields.data;// 入力された内容の前後の空白を削除したものを使います。AIに渡す前に、無駄な空白を減らして内容をすっきりさせるためです。

  try {
    const result = await generateAiResult(trimmedContent, validatedMode);
    const validatedResult = aiGeneratedResultSchema.safeParse(result);
    if (!validatedResult.success) {
      return { success: false, result: "AIの結果を読み取れませんでした。" };
    }

    return { success: true, result: validatedResult.data };
  } catch (error) {
    if (error instanceof AiContentError && error.message === "AI処理を利用できません。") {
      logServerError(error, {
        action: "generateAiContent",
        userId: session.user.id,
        details: { reason: "missingApiKey" },
      });
    }

    if (error instanceof AiContentError) {
      return { success: false, result: error.message };
    }

    logServerError(error, {
      action: "generateAiContent",
      userId: session.user.id,
      details: { mode: validatedMode },
    });
    return { success: false, result: "AI処理に失敗しました。" };
  }
}
