import { z } from "zod";
import { AI_MODES, MOBILE_AI_MODES } from "@/lib/ai-modes";
import { aiContentSchema, safeString } from "./common";

export const aiContentRequestSchema = z.object({
  content: aiContentSchema
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "AIに渡す本文が空です。"),
  mode: z.enum(AI_MODES, {
    error: "AI処理の種類が正しくありません。",
  }),
});

export const mobileAiGenerateRequestSchema = z.object({
  content: aiContentSchema
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "AIに渡す本文が空です。"),
  mode: z.enum(MOBILE_AI_MODES, {
    error: "AI処理の種類が正しくありません。",
  }),
});

export const aiGeneratedResultSchema = safeString("AIの結果", 12_000)
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, "AIの結果を読み取れませんでした。");
