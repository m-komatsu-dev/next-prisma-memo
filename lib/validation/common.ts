import { z } from "zod";

const DANGEROUS_SCRIPT_PATTERN =
  /<\s*\/?\s*script\b|<\s*(iframe|object|embed|svg|link|meta)\b|javascript\s*:|data\s*:\s*text\/html|\bon[a-z]+\s*=|srcdoc\s*=/i;
const DISALLOWED_CONTROL_CHAR_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const OBFUSCATION_REMOVAL_PATTERN = /[\u0000-\u001F\u007F\s]+/g;

const TAG_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s_-]{0,29}$/u;
const MAX_POST_ID = 2_147_483_647;

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

export function safeString(fieldName: string, maxLength: number) {
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

function numericIdSchema(fieldName: string) {
  return z
    .number({
      error: `${fieldName}の形式が正しくありません。`,
    })
    .int(`${fieldName}の形式が正しくありません。`)
    .positive(`${fieldName}の形式が正しくありません。`)
    .max(MAX_POST_ID, `${fieldName}の形式が正しくありません。`);
}

function stringOrNumberIdSchema(fieldName: string) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) ? Number(trimmed) : value;
  }, numericIdSchema(fieldName));
}

export const postIdValueSchema = stringOrNumberIdSchema("メモID");
export const postShareIdValueSchema = stringOrNumberIdSchema("共有設定ID");
export const todoItemIdValueSchema = stringOrNumberIdSchema("Todo ID");
export const notificationIdValueSchema = z
  .string({ error: "通知IDの形式が正しくありません。" })
  .trim()
  .min(1, "通知IDの形式が正しくありません。")
  .max(128, "通知IDの形式が正しくありません。")
  .regex(/^[A-Za-z0-9_-]+$/, "通知IDの形式が正しくありません。");

export const postTitleSchema = safeString("タイトル", 120);
export const postContentSchema = safeString("本文", 20_000);
export const todoItemTextSchema = safeString("Todo", 500)
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, "Todoを入力してください。");
export const aiContentSchema = safeString("本文", 12_000);

export const termsAcceptedValueSchema = z
  .string({ error: "利用規約への同意が必要です。" })
  .refine((value) => value === "on", "利用規約への同意が必要です。");

export const postKindSchema = z.enum(["text", "dueTodo"], {
  error: "メモ種別の形式が正しくありません。",
});

export const nullableDateTimeSchema = (fieldName: string) =>
  z.preprocess((value) => {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? value : value;
    }

    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.includes("T")
      ? trimmed
      : trimmed.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/, "$1T$2");
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? value : date;
  }, z.date({ error: `${fieldName}の形式が正しくありません。` }).nullable());

export const tagsInputSchema = safeString("タグ", 500)
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

export const postIdFormSchema = z.object({
  id: postIdValueSchema,
});

export const postShareRoleSchema = z.enum(["viewer", "editor"], {
  error: "共有権限の形式が正しくありません。",
});

export function getFirstZodErrorMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "入力内容を確認してください。";
}
