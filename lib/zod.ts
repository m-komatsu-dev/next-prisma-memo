import { z } from "zod";

const DANGEROUS_SCRIPT_PATTERN =
  /<\s*\/?\s*script\b|<\s*(iframe|object|embed|svg|link|meta)\b|javascript\s*:|data\s*:\s*text\/html|\bon[a-z]+\s*=|srcdoc\s*=/i;// 危険なスクリプト文字列のパターン。これには、scriptタグ、iframe/object/embed/svg/link/metaタグ、javascript:やdata:スキーム、イベントハンドラ属性、srcdoc属性などが含まれます。
const DISALLOWED_CONTROL_CHAR_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const OBFUSCATION_REMOVAL_PATTERN = /[\u0000-\u001F\u007F\s]+/g;

const TAG_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s_-]{0,29}$/u;// タグは30文字以内で、先頭は英数字、記号はハイフンとアンダースコアのみ使用可能
const MAX_POST_ID = 2_147_483_647;// 32-bit signed integerの最大値

function doesNotContainDangerousScript(value: string) {
  const normalized = value.normalize("NFKC");
  const compacted = normalized.replace(OBFUSCATION_REMOVAL_PATTERN, "");

  return (
    !DANGEROUS_SCRIPT_PATTERN.test(normalized) &&
    !DANGEROUS_SCRIPT_PATTERN.test(compacted)
  );
}

function doesNotContainDisallowedControlChars(value: string) {
  return !DISALLOWED_CONTROL_CHAR_PATTERN.test(value);
}

function safeString(fieldName: string, maxLength: number) {
  return z
    .string({
      error: `${fieldName}の形式が正しくありません。`,
    })
    .max(maxLength, `${fieldName}は${maxLength}文字以内で入力してください。`)
    .refine(
      doesNotContainDisallowedControlChars,
      `${fieldName}に使用できない制御文字が含まれています。`,
    )
    .refine(
      doesNotContainDangerousScript,
      `${fieldName}に使用できないスクリプト文字列が含まれています。`,
    );
}

const postIdNumberSchema = z
  .number({
    error: "メモIDの形式が正しくありません。",
  })
  .int("メモIDの形式が正しくありません。")
  .positive("メモIDの形式が正しくありません。")
  .max(MAX_POST_ID, "メモIDの形式が正しくありません。");

export const postIdValueSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : value;
}, postIdNumberSchema);

const postTitleSchema = safeString("タイトル", 120);
const postContentSchema = safeString("本文", 20_000);
const aiContentSchema = safeString("本文", 12_000);
const termsAcceptedValueSchema = z
  .string({ error: "利用規約への同意が必要です。" })
  .refine((value) => value === "on", "利用規約への同意が必要です。");

const tagsInputSchema = safeString("タグ", 500)
  .transform((value) =>
    Array.from(
      new Set(
        value
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ),
  )
  .superRefine((tagNames, ctx) => {
    if (tagNames.length > 10) {
      ctx.addIssue({
        code: "custom",
        message: "タグは10個以内で入力してください。",
      });
    }

    for (const tagName of tagNames) {
      if (!TAG_NAME_PATTERN.test(tagName)) {
        ctx.addIssue({
          code: "custom",
          message: "タグは30文字以内で、記号はハイフンとアンダースコアのみ使用できます。",
        });
        break;
      }
    }
  });

export const registerSchema = z.object({
  name: z
    .string({ error: "名前の形式が正しくありません。" })
    .trim()
    .min(1, "名前を入力してください")
    .max(80, "名前は80文字以内で入力してください。")
    .refine(
      doesNotContainDisallowedControlChars,
      "名前に使用できない制御文字が含まれています。",
    )
    .refine(
      doesNotContainDangerousScript,
      "名前に使用できないスクリプト文字列が含まれています。",
    ),
  email: z
    .string({ error: "メールアドレスの形式が正しくありません。" })
    .trim()
    .toLowerCase()
    .email("有効なメールアドレスを入力してください")
    .max(254, "メールアドレスは254文字以内で入力してください。"),
  password: z
    .string({ error: "パスワードの形式が正しくありません。" })
    .min(8, "パスワードは8文字以上で入力してください")
    .max(128, "パスワードは128文字以内で入力してください。"),
  termsAccepted: termsAcceptedValueSchema,
});

export const termsAcceptedFormSchema = z.object({
  termsAccepted: termsAcceptedValueSchema,
});

export const loginSchema = z.object({
  email: z
    .string({ error: "メールアドレスの形式が正しくありません。" })
    .trim()
    .toLowerCase()
    .email("メールアドレスの形式が正しくありません")
    .max(254, "メールアドレスの形式が正しくありません。"),
  password: z
    .string({ error: "パスワードの形式が正しくありません。" })
    .min(1, "パスワードを入力してください")
    .max(128, "パスワードの形式が正しくありません。"),
});

const postPayloadBaseSchema = z.object({
  id: postIdValueSchema.nullish(),
  title: postTitleSchema,
  content: postContentSchema,
  tags: tagsInputSchema,
});

export const postDraftPayloadSchema = postPayloadBaseSchema.extend({
  published: z.boolean().optional(),
});

export const postSavePayloadSchema = postPayloadBaseSchema
  .extend({
    published: z.boolean({
      error: "公開設定の形式が正しくありません。",
    }),
  })
  .superRefine((payload, ctx) => {
    if (!payload.title.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "タイトルは1文字以上必要です。",
      });
    }

    if (!payload.content.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["content"],
        message: "内容は1文字以上必要です。",
      });
    }
  });

export const postIdFormSchema = z.object({
  id: postIdValueSchema,
});

export const togglePublishedFormSchema = postIdFormSchema.extend({
  published: z.enum(["true", "false"], {
    error: "公開設定の形式が正しくありません。",
  }),
});

export const aiContentRequestSchema = z.object({
  content: aiContentSchema
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "AIに渡す本文が空です。"),
  mode: z.enum(["summarize", "title", "tags", "rewrite"], {
    error: "AI処理の種類が正しくありません。",
  }),
});

export const mobileAiGenerateRequestSchema = z.object({
  content: aiContentSchema
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "AIに渡す本文が空です。"),
  mode: z.enum(["summarize", "title", "tags", "rewrite", "improve", "ideas"], {
    error: "AI処理の種類が正しくありません。",
  }),
});

export const aiGeneratedResultSchema = safeString("AIの結果", 12_000)
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, "AIの結果を読み取れませんでした。");

export type PostDraftPayloadInput = {
  id?: number | string | null;
  title: string;
  content: string;
  tags: string;
  published?: boolean;
};

export type PostSavePayloadInput = PostDraftPayloadInput & {
  published: boolean;
};

export type ParsedPostPayload = z.output<typeof postSavePayloadSchema>;

export function getFirstZodErrorMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "入力内容を確認してください。";
}
