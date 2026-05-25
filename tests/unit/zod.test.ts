import { describe, expect, it } from "vitest";
import {
  aiContentRequestSchema,
  loginSchema,
  mobileAiGenerateRequestSchema,
  postDraftPayloadSchema,
  postIdFormSchema,
  postIdValueSchema,
  postSavePayloadSchema,
  postShareIdValueSchema,
  togglePublishedFormSchema,
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
