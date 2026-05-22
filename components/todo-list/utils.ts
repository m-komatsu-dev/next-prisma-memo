import type { RefObject } from "react";
import type { EditorLine } from "./types";

const TODO_PATTERN = /^(\s*)-\s+\[([ xX])\]\s?(.*)$/;

export function createLineId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parses the markdown-like checklist syntax while preserving the editor's
 * existing normalization: matched TODO lines keep only checked state and text.
 */
export function parseLine(rawLine: string): EditorLine {
  const todoMatch = rawLine.match(TODO_PATTERN);

  if (!todoMatch) {
    return { id: createLineId(), kind: "text", text: rawLine };
  }

  return {
    id: createLineId(),
    kind: "todo",
    checked: todoMatch[2].toLowerCase() === "x",
    text: todoMatch[3],
  };
}

export function parseContent(content: string): EditorLine[] {
  const lines = content.length ? content.split("\n") : [""];
  return lines.map(parseLine);
}

export function serializeLine(line: EditorLine) {
  if (line.kind === "todo") {
    return `- [${line.checked ? "x" : " "}] ${line.text}`;
  }

  return line.text;
}

export function serializeLines(lines: EditorLine[]) {
  return lines.map(serializeLine).join("\n");
}

function findTodoBlock(lines: EditorLine[], index: number) {
  let start = index;
  let end = index;

  while (start > 0 && lines[start - 1].kind === "todo") start -= 1;
  while (end < lines.length - 1 && lines[end + 1].kind === "todo") end += 1;

  return { start, end };
}

/**
 * Keeps completed items grouped at the bottom of the contiguous TODO block,
 * without letting a toggle reorder surrounding free-text paragraphs.
 */
export function moveCompletedToBottom(lines: EditorLine[], index: number) {
  if (lines[index]?.kind !== "todo") return lines;

  const { start, end } = findTodoBlock(lines, index);
  const before = lines.slice(0, start);
  const block = lines.slice(start, end + 1);
  const after = lines.slice(end + 1);
  const openItems = block.filter((line) => line.kind !== "todo" || !line.checked);
  const completedItems = block.filter((line) => line.kind === "todo" && line.checked);

  return [...before, ...openItems, ...completedItems, ...after];
}

export function focusLine(
  inputRefs: RefObject<Map<string, HTMLTextAreaElement | null>>,
  lineId: string | undefined,
) {
  if (!lineId) return;

  window.requestAnimationFrame(() => {
    const input = inputRefs.current.get(lineId);
    input?.focus();

    const end = input?.value.length ?? 0;
    input?.setSelectionRange(end, end);
  });
}
