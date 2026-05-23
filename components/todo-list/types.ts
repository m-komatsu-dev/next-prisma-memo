import type { ReactNode } from "react";

export type TodoLine = {
  id: string;
  kind: "todo";
  text: string;
  checked: boolean;
};

export type TextLine = {
  id: string;
  kind: "text";
  text: string;
};

export type EditorLine = TodoLine | TextLine;

export type TodoListEditorProps = {
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export type TodoListTextRenderer = (text: string) => ReactNode;

export type TodoListContentProps = {
  content: string;
  emptyText?: string;
  renderText?: TodoListTextRenderer;
};

export type TodoListPreviewProps = TodoListContentProps;
