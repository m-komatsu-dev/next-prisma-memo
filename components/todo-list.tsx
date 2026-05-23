"use client";

import { useMemo } from "react";
import {
  TodoContentLine,
  TodoEditorLine,
  TodoEditorToolbar,
} from "./todo-list/todo-list-parts";
import type {
  TodoListContentProps,
  TodoListEditorProps,
  TodoListPreviewProps,
} from "./todo-list/types";
import { useTodoEditor } from "./todo-list/use-todo-editor";
import { parseContent, serializeLines } from "./todo-list/utils";

export function TodoListEditor({
  name,
  value,
  onChange,
  placeholder = "本文を書き始める",
}: TodoListEditorProps) {
  const {
    inputRefs,
    lines,
    resizeInput,
    setActiveLineId,
    updateLineText,
    toggleLineKind,
    toggleChecked,
    moveLine,
    handleLineKeyDown,
  } = useTodoEditor({ value, onChange });

  return (
    <div className="todo-editor">
      <input type="hidden" name={name} value={serializeLines(lines)} />
      <TodoEditorToolbar toggleLineKind={toggleLineKind} />

      <div className="todo-editor__lines">
        {lines.map((line, index) => (
          <TodoEditorLine
            key={line.id}
            line={line}
            index={index}
            linesLength={lines.length}
            inputRefs={inputRefs}
            placeholder={placeholder}
            resizeInput={resizeInput}
            setActiveLineId={setActiveLineId}
            updateLineText={updateLineText}
            handleLineKeyDown={handleLineKeyDown}
            toggleChecked={toggleChecked}
            moveLine={moveLine}
          />
        ))}
      </div>
    </div>
  );
}

export function TodoListContent({
  content,
  emptyText = "本文はまだありません。",
  renderText,
}: TodoListContentProps) {
  const lines = useMemo(() => parseContent(content), [content]);

  if (!content.trim()) {
    return <p className="todo-content__empty">{emptyText}</p>;
  }

  return (
    <div className="todo-content">
      {lines.map((line) => (
        <TodoContentLine key={line.id} line={line} renderText={renderText} />
      ))}
    </div>
  );
}

export function TodoListPreview(props: TodoListPreviewProps) {
  return <TodoListContent {...props} />;
}
