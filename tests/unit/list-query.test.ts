import { describe, expect, it } from "vitest";
import {
  createMemoPreview,
  getNextListLimit,
  MEMO_CONTENT_PREVIEW_CHARS,
  resolveListLimit,
} from "@/lib/list-query";

describe("list query helpers", () => {
  it("clamps list limits to a positive integer range", () => {
    expect(resolveListLimit("12", 24, 100)).toBe(12);
    expect(resolveListLimit("0", 24, 100)).toBe(24);
    expect(resolveListLimit("abc", 24, 100)).toBe(24);
    expect(resolveListLimit("500", 24, 100)).toBe(100);
    expect(resolveListLimit(["36", "72"], 24, 100)).toBe(36);
  });

  it("caps the next limit at the maximum", () => {
    expect(getNextListLimit(24, 24, 100)).toBe(48);
    expect(getNextListLimit(96, 24, 100)).toBe(100);
  });

  it("truncates long memo content for list previews", () => {
    const preview = createMemoPreview("x".repeat(MEMO_CONTENT_PREVIEW_CHARS + 10));

    expect(preview.isTruncated).toBe(true);
    expect(preview.content).toHaveLength(MEMO_CONTENT_PREVIEW_CHARS);
  });
});
