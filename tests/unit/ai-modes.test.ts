import { describe, expect, it } from "vitest";
import * as aiModes from "@/lib/ai-modes";
import { AI_MODES, MOBILE_AI_MODES } from "@/lib/ai-modes";

describe("AI modes", () => {
  it("keeps web AI modes in the expected order", () => {
    expect(AI_MODES).toEqual(["summarize", "title", "tags", "rewrite"]);
  });

  it("includes mobile-only modes after the shared web modes", () => {
    expect(MOBILE_AI_MODES).toEqual([
      "summarize",
      "title",
      "tags",
      "rewrite",
      "improve",
      "ideas",
    ]);
  });

  it("does not expose AiMode as a runtime value", () => {
    expect("AiMode" in aiModes).toBe(false);
    expect("MobileAiMode" in aiModes).toBe(false);
    expect("AnyAiMode" in aiModes).toBe(false);
  });
});
