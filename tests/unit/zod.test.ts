import { describe, expect, it } from "vitest";
import {
  aiContentRequestSchema,
  changePasswordSchema,
  createTodoItemSchema,
  deleteTodoItemSchema,
  loginSchema,
  mobileAiGenerateRequestSchema,
  mobileCreateTodoItemSchema,
  mobileUpdateTodoItemSchema,
  postDraftPayloadSchema,
  postIdFormSchema,
  postIdValueSchema,
  postSavePayloadSchema,
  postShareIdValueSchema,
  todoItemIdValueSchema,
  togglePublishedFormSchema,
  toggleTodoItemSchema,
  updateTodoItemSchema,
} from "@/lib/zod";

describe("zod validation", () => {
  it("normalizes valid login input", () => {
    expect(
      loginSchema.parse({
        email: "  USER@example.COM  ",
        password: "secret",
      }),
    ).toEqual({
      email: "user@example.com",
      password: "secret",
    });
  });

  it("rejects invalid login input", () => {
    expect(
      loginSchema.safeParse({
        email: "not-an-email",
        password: "",
      }).success,
    ).toBe(false);
  });

  it("validates password change confirmation", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "current-password",
        newPassword: "new-password",
        confirmPassword: "different-password",
      }).success,
    ).toBe(false);
  });

  it("accepts draft payloads without requiring title or content", () => {
    expect(
      postDraftPayloadSchema.parse({
        title: "",
        content: "",
        tags: " work, work, memo ",
      }),
    ).toEqual({
      title: "",
      content: "",
      tags: ["work", "memo"],
    });
  });

  it("requires title and content for saved posts", () => {
    expect(
      postSavePayloadSchema.safeParse({
        title: " ",
        content: " ",
        tags: "",
        published: false,
      }).success,
    ).toBe(false);
  });

  it("normalizes saved post tags and post IDs", () => {
    expect(
      postSavePayloadSchema.parse({
        id: "42",
        title: "Memo",
        content: "Body",
        tags: "alpha, beta, alpha",
        published: true,
      }),
    ).toEqual({
      id: 42,
      title: "Memo",
      content: "Body",
      tags: ["alpha", "beta"],
      published: true,
    });
  });

  it("rejects dangerous script content", () => {
    expect(
      postSavePayloadSchema.safeParse({
        title: "Memo",
        content: "<script>alert(1)</script>",
        tags: "",
        published: false,
      }).success,
    ).toBe(false);
  });

  it("validates post ID values and forms", () => {
    expect(postIdValueSchema.parse(" 123 ")).toBe(123);
    expect(postIdFormSchema.parse({ id: "123" })).toEqual({ id: 123 });
    expect(togglePublishedFormSchema.parse({ id: "123", published: "false" })).toEqual({
      id: 123,
      published: "false",
    });
    expect(postIdValueSchema.safeParse("1.5").success).toBe(false);
    expect(postIdValueSchema.safeParse(0).success).toBe(false);
    expect(postIdValueSchema.safeParse(2_147_483_648).success).toBe(false);
  });

  it("validates post share IDs", () => {
    expect(postShareIdValueSchema.parse("7")).toBe(7);
    expect(postShareIdValueSchema.safeParse("-1").success).toBe(false);
  });

  it("validates todo item payloads and due dates", () => {
    expect(
      createTodoItemSchema.parse({
        id: "12",
        text: "  Pay invoice ",
        dueAt: "2026-05-29T10:30",
      }),
    ).toEqual({
      id: 12,
      text: "Pay invoice",
      dueAt: new Date("2026-05-29T10:30"),
    });

    expect(
      updateTodoItemSchema.parse({
        id: "12",
        todoItemId: "3",
        text: "Pay invoice",
        dueAt: "",
      }),
    ).toEqual({
      id: 12,
      todoItemId: 3,
      text: "Pay invoice",
      dueAt: null,
    });

    expect(
      createTodoItemSchema.parse({
        id: "12",
        text: "Buy milk",
        dueAt: "",
      }),
    ).toEqual({
      id: 12,
      text: "Buy milk",
      dueAt: null,
    });

    expect(mobileCreateTodoItemSchema.parse({ text: "Todo" })).toEqual({
      text: "Todo",
    });

    expect(toggleTodoItemSchema.parse({ id: "12", todoItemId: "3", completed: "true" })).toEqual({
      id: 12,
      todoItemId: 3,
      completed: "true",
    });
    expect(deleteTodoItemSchema.parse({ id: "12", todoItemId: "3" })).toEqual({
      id: 12,
      todoItemId: 3,
    });
    expect(todoItemIdValueSchema.safeParse("0").success).toBe(false);
    expect(createTodoItemSchema.safeParse({ id: "12", text: " ", dueAt: null }).success).toBe(
      false,
    );
    expect(createTodoItemSchema.safeParse({ id: "12", text: "Todo", dueAt: "bad" }).success).toBe(
      false,
    );
    expect(mobileCreateTodoItemSchema.safeParse({ text: "Todo", dueAt: "bad" }).success).toBe(
      false,
    );
  });

  it("validates mobile todo item updates", () => {
    expect(
      mobileUpdateTodoItemSchema.parse({
        completed: true,
        dueAt: null,
      }),
    ).toEqual({
      completed: true,
      dueAt: null,
    });
    expect(mobileUpdateTodoItemSchema.safeParse({}).success).toBe(false);
  });

  it("validates AI modes without external API calls", () => {
    expect(
      aiContentRequestSchema.parse({
        content: " summarize me ",
        mode: "summarize",
      }),
    ).toEqual({
      content: "summarize me",
      mode: "summarize",
    });
    expect(aiContentRequestSchema.safeParse({ content: "x", mode: "improve" }).success).toBe(
      false,
    );
    expect(
      mobileAiGenerateRequestSchema.safeParse({ content: "x", mode: "improve" }).success,
    ).toBe(true);
  });
});
