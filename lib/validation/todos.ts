import { z } from "zod";
import {
  nullableDateTimeSchema,
  postIdFormSchema,
  postTitleSchema,
  tagsInputSchema,
  todoItemIdValueSchema,
  todoItemTextSchema,
} from "./common";

const todoItemDueAtSchema = nullableDateTimeSchema("期限");
const todoItemReminderAtSchema = nullableDateTimeSchema("リマインダー");

export const dueTodoListCreateSchema = z
  .object({
    title: postTitleSchema.transform((value) => value.trim()),
    tags: z.preprocess((value) => value ?? "", tagsInputSchema),
    todoListDueAt: nullableDateTimeSchema("Todoリスト全体の期限"),
    items: z
      .array(
        z.object({
          text: todoItemTextSchema,
          dueAt: todoItemDueAtSchema,
        }),
      )
      .min(1, "Todo項目を1件以上追加してください。")
      .max(50, "Todo項目は50件以内で入力してください。"),
  })
  .superRefine((payload, ctx) => {
    if (!payload.title) {
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "Todoリストのタイトルを入力してください。",
      });
    }

    if (!payload.todoListDueAt) {
      ctx.addIssue({
        code: "custom",
        path: ["todoListDueAt"],
        message: "Todoリスト全体の期限を入力してください。",
      });
    }

    payload.items.forEach((item, index) => {
      if (!item.dueAt) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "dueAt"],
          message: "各Todo項目の期限を入力してください。",
        });
      }
    });
  });

export const createTodoItemSchema = postIdFormSchema.extend({
  text: todoItemTextSchema,
  dueAt: todoItemDueAtSchema,
  reminderAt: todoItemReminderAtSchema.optional(),
});

export const updateTodoItemSchema = postIdFormSchema.extend({
  todoItemId: todoItemIdValueSchema,
  text: todoItemTextSchema,
  dueAt: todoItemDueAtSchema,
  reminderAt: todoItemReminderAtSchema.optional(),
});

export const toggleTodoItemSchema = postIdFormSchema.extend({
  todoItemId: todoItemIdValueSchema,
  completed: z.enum(["true", "false"], {
    error: "完了状態の形式が正しくありません。",
  }),
});

export const deleteTodoItemSchema = postIdFormSchema.extend({
  todoItemId: todoItemIdValueSchema,
});

export const mobileCreateTodoItemSchema = z.object({
  text: todoItemTextSchema,
  dueAt: todoItemDueAtSchema.optional(),
  reminderAt: todoItemReminderAtSchema.optional(),
});

export const mobileUpdateTodoItemSchema = z
  .object({
    text: todoItemTextSchema.optional(),
    completed: z.boolean({ error: "完了状態の形式が正しくありません。" }).optional(),
    dueAt: todoItemDueAtSchema.optional(),
    reminderAt: todoItemReminderAtSchema.optional(),
  })
  .refine(
    (payload) =>
      payload.text !== undefined ||
      payload.completed !== undefined ||
      payload.dueAt !== undefined ||
      payload.reminderAt !== undefined,
    "更新するTodoの内容がありません。",
  );
