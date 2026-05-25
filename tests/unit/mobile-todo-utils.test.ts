import { describe, expect, it } from "vitest";
import {
  moveCompletedTodoToBottom,
  normalizeChecklistContentForSave,
  parseEditorContent,
  parseEditorLine,
  serializeEditorLines,
} from "@/mobile/src/todo-utils";

function withoutIds(lines: ReturnType<typeof parseEditorContent>) {
  return lines.map((line) => {
    if (line.kind === "todo") {
      return { kind: line.kind, checked: line.checked, text: line.text };
    }

    return { kind: line.kind, text: line.text };
  });
}

describe("mobile todo utils", () => {
  it("parses unchecked and checked markdown todos", () => {
    expect(withoutIds(parseEditorContent("- [ ] first\n- [x] second"))).toEqual([
      { kind: "todo", checked: false, text: "first" },
      { kind: "todo", checked: true, text: "second" },
    ]);
  });

  it("preserves normal text and handles empty content", () => {
    expect(withoutIds(parseEditorContent("plain\n\n- [] nope"))).toEqual([
      { kind: "text", text: "plain" },
      { kind: "text", text: "" },
      { kind: "text", text: "- [] nope" },
    ]);
    expect(withoutIds(parseEditorContent(""))).toEqual([{ kind: "text", text: "" }]);
  });

  it("does not throw on malformed todo-like content", () => {
    expect(() => parseEditorLine("- [y] nope")).not.toThrow();
    expect(() => parseEditorContent("- [")).not.toThrow();
  });

  it("serializes and normalizes checklist content for save", () => {
    const lines = parseEditorContent("body\n- [ ] open\n- [x] done");

    expect(serializeEditorLines(lines)).toBe("body\n- [ ] open\n- [x] done");
    expect(normalizeChecklistContentForSave("body\n- [ ] \n- [x] done\n")).toBe(
      "body\n- [x] done",
    );
  });

  it("moves completed todos only inside the contiguous todo block", () => {
    const lines = parseEditorContent("- [x] done\n- [ ] open\ntext");

    expect(serializeEditorLines(moveCompletedTodoToBottom(lines, 0))).toBe(
      "- [ ] open\n- [x] done\ntext",
    );
  });
});
