"use client";

import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { EditorLine, TodoListEditorProps } from "./types";
import {
  createLineId,
  focusLine,
  moveCompletedToBottom,
  parseContent,
  serializeLines,
} from "./utils";

type UseTodoEditorArgs = Pick<TodoListEditorProps, "value" | "onChange">;

export function useTodoEditor({ value, onChange }: UseTodoEditorArgs) {
  const inputRefs = useRef<Map<string, HTMLTextAreaElement | null>>(new Map());
  const [lines, setLines] = useState<EditorLine[]>(() => parseContent(value));
  const [activeLineId, setActiveLineId] = useState(lines[0]?.id ?? "");
  const internalValueRef = useRef(value);

  useEffect(() => {
    if (value === internalValueRef.current) return;

    const nextLines = parseContent(value);
    internalValueRef.current = value;
    setLines(nextLines);
    setActiveLineId(nextLines[0]?.id ?? "");
  }, [value]);

  const activeIndex = useMemo(
    () => lines.findIndex((line) => line.id === activeLineId),
    [activeLineId, lines],
  );

  const resizeInput = (input: HTMLTextAreaElement | null) => {
    if (!input) return;

    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  };

  useEffect(() => {
    inputRefs.current.forEach((input) => resizeInput(input));
  }, [lines]);

  const commitLines = (nextLines: EditorLine[], nextFocusId?: string) => {
    setLines(nextLines);

    const nextValue = serializeLines(nextLines);
    internalValueRef.current = nextValue;
    onChange(nextValue);

    if (nextFocusId) {
      setActiveLineId(nextFocusId);
      focusLine(inputRefs, nextFocusId);
    }
  };

  const updateLineText = (index: number, text: string) => {
    const nextLines = lines.map((line, lineIndex) =>
      lineIndex === index ? { ...line, text } : line,
    );

    commitLines(nextLines);
  };

  const toggleLineKind = (index = activeIndex) => {
    if (index < 0) return;

    const nextLines = lines.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      if (line.kind === "todo") return { id: line.id, kind: "text" as const, text: line.text };
      return { id: line.id, kind: "todo" as const, text: line.text, checked: false };
    });

    commitLines(nextLines, nextLines[index]?.id);
  };

  const toggleChecked = (index: number) => {
    const toggled = lines.map((line, lineIndex) =>
      lineIndex === index && line.kind === "todo"
        ? { ...line, checked: !line.checked }
        : line,
    );
    const nextLines = moveCompletedToBottom(toggled, index);
    const focusId = toggled[index]?.id;

    commitLines(nextLines, focusId);
  };

  const insertLineAfter = (index: number, kind: EditorLine["kind"]) => {
    const nextLine: EditorLine =
      kind === "todo"
        ? { id: createLineId(), kind: "todo", text: "", checked: false }
        : { id: createLineId(), kind: "text", text: "" };
    const nextLines = [...lines.slice(0, index + 1), nextLine, ...lines.slice(index + 1)];

    commitLines(nextLines, nextLine.id);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) {
      const nextLines: EditorLine[] = [{ id: lines[0].id, kind: "text", text: "" }];
      commitLines(nextLines, nextLines[0].id);
      return;
    }

    const nextLines = lines.filter((_, lineIndex) => lineIndex !== index);
    const nextFocusId = nextLines[Math.max(0, index - 1)]?.id;

    commitLines(nextLines, nextFocusId);
  };

  const moveLine = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= lines.length) return;

    const nextLines = [...lines];
    const [line] = nextLines.splice(index, 1);
    nextLines.splice(targetIndex, 0, line);

    commitLines(nextLines, line.id);
  };

  const handleLineKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    // IME composition can report control keys before text is finalized.
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "7") {
      event.preventDefault();
      toggleLineKind(index);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      insertLineAfter(index, lines[index].kind === "todo" ? "todo" : "text");
      return;
    }

    if (event.key === "Backspace" && lines[index].text.length === 0) {
      event.preventDefault();
      removeLine(index);
      return;
    }

    if (event.key === "ArrowUp" && event.altKey) {
      event.preventDefault();
      moveLine(index, -1);
      return;
    }

    if (event.key === "ArrowDown" && event.altKey) {
      event.preventDefault();
      moveLine(index, 1);
    }
  };

  return {
    inputRefs,
    lines,
    resizeInput,
    setActiveLineId,
    updateLineText,
    toggleLineKind,
    toggleChecked,
    moveLine,
    handleLineKeyDown,
  };
}
