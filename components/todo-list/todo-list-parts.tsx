"use client";

import { ArrowDown, ArrowUp, CheckSquare, Square } from "lucide-react";
import type { Dispatch, KeyboardEvent, RefObject, SetStateAction } from "react";
import type { EditorLine, TodoListTextRenderer } from "./types";

type TodoEditorToolbarProps = {
  toggleLineKind: (index?: number) => void;
};

type TodoEditorLineProps = {
  ariaLabel?: string;
  dataTestId?: string;
  line: EditorLine;
  index: number;
  linesLength: number;
  inputRefs: RefObject<Map<string, HTMLTextAreaElement | null>>;
  placeholder: string;
  resizeInput: (input: HTMLTextAreaElement | null) => void;
  setActiveLineId: Dispatch<SetStateAction<string>>;
  updateLineText: (index: number, text: string) => void;
  handleLineKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>, index: number) => void;
  toggleChecked: (index: number) => void;
  moveLine: (index: number, direction: -1 | 1) => void;
};

export function TodoEditorToolbar({ toggleLineKind }: TodoEditorToolbarProps) {
  return (
    <div className="todo-editor__controls" aria-label="チェックリスト操作">
      <button type="button" className="todo-editor__toolbar-button" onClick={() => toggleLineKind()}>
        <CheckSquare size={16} aria-hidden="true" />
        チェックボックス
      </button>
      <span>ショートカット: Ctrl/⌘ + Shift + 7</span>
    </div>
  );
}

export function TodoEditorLine({
  ariaLabel,
  dataTestId,
  line,
  index,
  linesLength,
  inputRefs,
  placeholder,
  resizeInput,
  setActiveLineId,
  updateLineText,
  handleLineKeyDown,
  toggleChecked,
  moveLine,
}: TodoEditorLineProps) {
  return (
    <div
      className={`todo-editor__line ${
        line.kind === "todo" && line.checked ? "todo-editor__line--checked" : ""
      }`}
    >
      {line.kind === "todo" ? (
        <button
          type="button"
          className="todo-editor__check-button"
          aria-label={line.checked ? "未完了に戻す" : "完了にする"}
          aria-pressed={line.checked}
          onClick={() => toggleChecked(index)}
        >
          {line.checked ? <CheckSquare size={18} /> : <Square size={18} />}
        </button>
      ) : (
        <span className="todo-editor__text-spacer" aria-hidden="true" />
      )}

      <textarea
        aria-label={ariaLabel}
        data-testid={dataTestId}
        rows={1}
        ref={(node) => {
          inputRefs.current.set(line.id, node);
          resizeInput(node);
          if (!node) inputRefs.current.delete(line.id);
        }}
        value={line.text}
        onFocus={() => setActiveLineId(line.id)}
        onChange={(event) => {
          resizeInput(event.currentTarget);
          updateLineText(index, event.target.value);
        }}
        onKeyDown={(event) => handleLineKeyDown(event, index)}
        className="todo-editor__input"
        placeholder={linesLength === 1 && !line.text ? placeholder : ""}
      />

      <div className="todo-editor__move-buttons" aria-label="並び替え">
        <button
          type="button"
          onClick={() => moveLine(index, -1)}
          disabled={index === 0}
          aria-label="上へ移動"
        >
          <ArrowUp size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => moveLine(index, 1)}
          disabled={index === linesLength - 1}
          aria-label="下へ移動"
        >
          <ArrowDown size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

type TodoContentLineProps = {
  line: EditorLine;
  renderText?: TodoListTextRenderer;
};

export function TodoContentLine({ line, renderText }: TodoContentLineProps) {
  const renderedText = renderText ? renderText(line.text || "\u00a0") : line.text || "\u00a0";

  if (line.kind === "todo") {
    return (
      <div className={`todo-content__line ${line.checked ? "todo-content__line--checked" : ""}`}>
        <span
          className="todo-content__checkbox"
          role="checkbox"
          aria-checked={line.checked}
          aria-readonly="true"
          aria-label={line.checked ? "完了" : "未完了"}
        >
          {line.checked ? <CheckSquare size={18} /> : <Square size={18} />}
        </span>
        <span>{renderedText}</span>
      </div>
    );
  }

  return <p className="todo-content__paragraph">{renderedText}</p>;
}
