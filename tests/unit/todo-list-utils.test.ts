import { describe, expect, it } from "vitest";
import {
  moveCompletedToBottom,
  parseContent,
  parseLine,
  serializeLine,
  serializeLines,
} from "@/components/todo-list/utils";

function withoutIds(lines: ReturnType<typeof parseContent>) {
  return lines.map((line) => {
    if (line.kind === "todo") {
      return { kind: line.kind, checked: line.checked, text: line.text };
    }

    return { kind: line.kind, text: line.text };
  });
}

describe("web todo-list utils", () => {
  it("parses unchecked and checked markdown todos", () => {
    expect(withoutIds(parseContent("- [ ] first\n- [x] second\n- [X] third"))).toEqual([
      { kind: "todo", checked: false, text: "first" },
      { kind: "todo", checked: true, text: "second" },
      { kind: "todo", checked: true, text: "third" },
    ]);
  });

  it("preserves normal text and empty lines", () => {
    expect(withoutIds(parseContent("hello\n\n- [] not todo"))).toEqual([
      { kind: "text", text: "hello" },
      { kind: "text", text: "" },
      { kind: "text", text: "- [] not todo" },
    ]);
  });

  it("serializes todo and text lines without changing normal body text", () => {
    const lines = parseContent("hello\n- [ ] open\n- [x] done\nnot a todo");

    expect(serializeLines(lines)).toBe("hello\n- [ ] open\n- [x] done\nnot a todo");
  });

  it("does not throw on empty or malformed lines", () => {
    expect(() => parseLine("")).not.toThrow();
    expect(() => parseContent("- [y] nope\n- [")).not.toThrow();
  });

  it("keeps completed todos at the bottom of their contiguous todo block", () => {
    const lines = parseContent("- [ ] a\n- [x] b\ntext\n- [x] c\n- [ ] d");
    const moved = moveCompletedToBottom(lines, 3);

    expect(serializeLines(moved)).toBe("- [ ] a\n- [x] b\ntext\n- [ ] d\n- [x] c");
  });

  it("serializes individual lines", () => {
    expect(
      serializeLine({
        id: "1",
        kind: "todo",
        checked: false,
        text: "task",
      }),
    ).toBe("- [ ] task");
    expect(serializeLine({ id: "2", kind: "text", text: "plain" })).toBe("plain");
  });
});
