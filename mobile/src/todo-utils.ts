export type EditorLine =
  | {
      id: string;
      kind: "text";
      text: string;
    }
  | {
      checked: boolean;
      id: string;
      kind: "todo";
      text: string;
    };

const TODO_LINE_PATTERN = /^(\s*)-\s+\[([ xX])\]\s?(.*)$/;

export function createEditorLineId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseEditorLine(rawLine: string): EditorLine {
  const match = rawLine.match(TODO_LINE_PATTERN);

  if (!match) {
    return {
      id: createEditorLineId(),
      kind: "text",
      text: rawLine,
    };
  }

  return {
    checked: match[2].toLowerCase() === "x",
    id: createEditorLineId(),
    kind: "todo",
    text: match[3],
  };
}

export function parseEditorContent(content: string) {
  const rawLines = content.length > 0 ? content.split("\n") : [""];
  return rawLines.map(parseEditorLine);
}

export function serializeEditorLine(line: EditorLine) {
  if (line.kind === "todo") {
    return `- [${line.checked ? "x" : " "}] ${line.text}`;
  }

  return line.text;
}

export function serializeEditorLines(lines: EditorLine[]) {
  return lines.map(serializeEditorLine).join("\n");
}

export function normalizeChecklistContentForSave(content: string) {
  return parseEditorContent(content)
    .filter((line) => line.kind !== "todo" || line.text.trim().length > 0)
    .map(serializeEditorLine)
    .join("\n")
    .trimEnd();
}

export function moveCompletedTodoToBottom(lines: EditorLine[], index: number) {
  if (lines[index]?.kind !== "todo") return lines;

  let start = index;
  let end = index;

  while (start > 0 && lines[start - 1].kind === "todo") start -= 1;
  while (end < lines.length - 1 && lines[end + 1].kind === "todo") end += 1;

  const before = lines.slice(0, start);
  const block = lines.slice(start, end + 1);
  const after = lines.slice(end + 1);
  const openItems = block.filter((line) => line.kind !== "todo" || !line.checked);
  const completedItems = block.filter(
    (line) => line.kind === "todo" && line.checked,
  );

  return [...before, ...openItems, ...completedItems, ...after];
}
