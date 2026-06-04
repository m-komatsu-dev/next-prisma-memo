import { z } from "zod";
import {
  nullableDateTimeSchema,
  postContentSchema,
  postIdFormSchema,
  postIdValueSchema,
  postKindSchema,
  postShareIdValueSchema,
  postShareRoleSchema,
  postTitleSchema,
  tagsInputSchema,
} from "./common";

const postPayloadBaseSchema = z.object({
  id: postIdValueSchema.nullish(),
  title: postTitleSchema,
  content: postContentSchema,
  tags: tagsInputSchema,
  kind: postKindSchema.optional().default("text"),
  todoListDueAt: nullableDateTimeSchema("Todoリスト全体の期限").optional(),
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

export const togglePublishedFormSchema = postIdFormSchema.extend({
  published: z.enum(["true", "false"], {
    error: "公開設定の形式が正しくありません。",
  }),
});

export const addPostShareFormSchema = postIdFormSchema.extend({
  email: z
    .string({ error: "メールアドレスの形式が正しくありません。" })
    .trim()
    .toLowerCase()
    .email("有効なメールアドレスを入力してください")
    .max(254, "メールアドレスは254文字以内で入力してください。"),
  role: postShareRoleSchema,
});

export const updatePostShareFormSchema = postIdFormSchema.extend({
  shareId: postShareIdValueSchema,
  role: postShareRoleSchema,
});

export const revokePostShareFormSchema = postIdFormSchema.extend({
  shareId: postShareIdValueSchema,
});

export type PostDraftPayloadInput = {
  id?: number | string | null;
  title: string;
  content: string;
  tags: string;
  published?: boolean;
  kind?: "text" | "dueTodo";
  todoListDueAt?: string | Date | null;
};

export type PostSavePayloadInput = PostDraftPayloadInput & {
  published: boolean;
};

export type ParsedPostPayload = z.output<typeof postSavePayloadSchema>;
