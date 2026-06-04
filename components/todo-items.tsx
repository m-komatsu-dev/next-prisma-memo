"use client";

import { useState, useTransition } from "react";
import type { KeyboardEvent } from "react";
import { createTodoItem } from "@/app/posts/[id]/todo-actions";
import type { PostFormTodoItem } from "@/components/post-form/types";
import {
  matchesTodoItemFilter,
  todoItemFilterOptions,
  type TodoItemFilter,
} from "@/components/todo-items-utils";
import {
  buildTodoFormData,
  initialTodoActionState,
  isComposingEnter,
  type TodoActionState,
} from "@/components/todo-items/helpers";
import { TodoItemRow } from "@/components/todo-items/todo-item-row";

type TodoItemView = PostFormTodoItem;

type TodoItemsPanelProps = {
  canEdit: boolean;
  embedded?: boolean;
  forceDueTodo?: boolean;
  hideCreateForm?: boolean;
  nowIso: string;
  onEnsurePostId?: () => Promise<number>;
  postId: number | null;
  todoItems: TodoItemView[];
};

export default function TodoItemsPanel({
  canEdit,
  embedded = false,
  forceDueTodo = false,
  hideCreateForm = false,
  nowIso,
  onEnsurePostId,
  postId,
  todoItems,
}: TodoItemsPanelProps) {
  const [createState, setCreateState] = useState<TodoActionState>(
    initialTodoActionState,
  );
  const [activePostId, setActivePostId] = useState(postId);
  const [items, setItems] = useState(todoItems);
  const [newText, setNewText] = useState("");
  const [newDueAt, setNewDueAt] = useState("");
  const [newReminderAt, setNewReminderAt] = useState("");
  const [todoKind, setTodoKind] = useState<"plain" | "due">(
    forceDueTodo ? "due" : "plain",
  );
  const [activeFilter, setActiveFilter] = useState<TodoItemFilter>("all");
  const [isCreating, startCreateTransition] = useTransition();
  const nowTime = new Date(nowIso).getTime();
  const activeTodoKind = forceDueTodo ? "due" : todoKind;
  const filteredItems = items.filter((todoItem) =>
    matchesTodoItemFilter(todoItem, activeFilter, nowTime),
  );

  const replaceTodoItem = (nextTodoItem: TodoItemView) => {
    setItems((currentItems) => {
      if (!nextTodoItem.text) {
        return currentItems.filter((item) => item.id !== nextTodoItem.id);
      }

      const existingIndex = currentItems.findIndex(
        (item) => item.id === nextTodoItem.id,
      );
      if (existingIndex === -1) {
        return [...currentItems, nextTodoItem].sort(
          (a, b) => a.position - b.position || a.id - b.id,
        );
      }

      return currentItems.map((item) =>
        item.id === nextTodoItem.id ? nextTodoItem : item,
      );
    });
  };

  const handleCreate = () => {
    if (!newText.trim()) {
      setCreateState({ success: false, message: "Todo内容を入力してください。" });
      return;
    }

    if (activeTodoKind === "due" && !newDueAt) {
      setCreateState({ success: false, message: "期限日時を入力してください。" });
      return;
    }

    startCreateTransition(async () => {
      let ensuredPostId = activePostId;

      if (!ensuredPostId) {
        if (!onEnsurePostId) {
          setCreateState({
            success: false,
            message: "下書きメモを作成できませんでした。",
          });
          return;
        }

        try {
          ensuredPostId = await onEnsurePostId();
        } catch (error) {
          setCreateState({
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "下書きメモの作成に失敗しました。時間をおいてもう一度お試しください。",
          });
          return;
        }
      }

      setActivePostId(ensuredPostId);

      const formData = buildTodoFormData({
        dueAt: activeTodoKind === "due" ? newDueAt : null,
        postId: ensuredPostId,
        reminderAt: activeTodoKind === "due" ? newReminderAt : null,
        text: newText.trim(),
      });
      const result = await createTodoItem(initialTodoActionState, formData);
      setCreateState(result);
      if (result.success && result.todoItem) {
        replaceTodoItem(result.todoItem);
        setNewText("");
        setNewDueAt("");
        setNewReminderAt("");
      }
    });
  };

  const handleCreateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    if (isComposingEnter(event)) return;
    event.preventDefault();
    if (!newText.trim() || (activeTodoKind === "due" && !newDueAt)) return;
    handleCreate();
  };

  return (
    <section
      className={embedded ? "todo-items todo-items--embedded" : "todo-items"}
      aria-labelledby={embedded ? "editor-todo-items-title" : "todo-items-title"}
    >
      <div className="todo-items__header">
        <div>
          <p className="todo-items__eyebrow">Todos</p>
          <h2 id={embedded ? "editor-todo-items-title" : "todo-items-title"}>
            このメモのTodo
          </h2>
        </div>
        {!canEdit && <span className="memo-badge">閲覧のみ</span>}
      </div>

      {!hideCreateForm && (
        <>
          <p className="todo-items__create-title">
            {forceDueTodo ? "期限付きTodoを追加" : "Todoを追加"}
          </p>
          {!forceDueTodo && (
            <div className="todo-items__kind" role="radiogroup" aria-label="Todo種別">
              <label>
                <input
                  type="radio"
                  name={embedded ? "editorTodoKind" : "detailTodoKind"}
                  value="plain"
                  checked={todoKind === "plain"}
                  onChange={() => setTodoKind("plain")}
                  disabled={!canEdit || isCreating}
                />
                <span>普通のTodo</span>
              </label>
              <label>
                <input
                  type="radio"
                  name={embedded ? "editorTodoKind" : "detailTodoKind"}
                  value="due"
                  checked={todoKind === "due"}
                  onChange={() => setTodoKind("due")}
                  disabled={!canEdit || isCreating}
                />
                <span>期限付きTodo</span>
              </label>
            </div>
          )}
          <div
            className={[
              "todo-items__create-form",
              activeTodoKind === "due" ? "todo-items__create-form--due" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <label>
              <span>Todo内容</span>
              <input
                value={newText}
                onChange={(event) => setNewText(event.target.value)}
                onKeyDown={handleCreateKeyDown}
                placeholder="このメモのTodo"
                disabled={!canEdit || isCreating}
                maxLength={500}
              />
            </label>
            {activeTodoKind === "due" && (
              <>
                <label>
                  <span>期限日時</span>
                  <input
                    type="datetime-local"
                    value={newDueAt}
                    onChange={(event) => setNewDueAt(event.target.value)}
                    onKeyDown={handleCreateKeyDown}
                    disabled={!canEdit || isCreating}
                    required
                  />
                </label>
                <label>
                  <span>通知予定</span>
                  <input
                    type="datetime-local"
                    value={newReminderAt}
                    onChange={(event) => setNewReminderAt(event.target.value)}
                    onKeyDown={handleCreateKeyDown}
                    disabled={!canEdit || isCreating}
                  />
                </label>
              </>
            )}
            <button
              type="button"
              className="todo-items__button"
              onClick={handleCreate}
              disabled={
                !canEdit ||
                isCreating ||
                !newText.trim() ||
                (activeTodoKind === "due" && !newDueAt)
              }
            >
              追加
            </button>
          </div>
        </>
      )}

      {!createState.success && createState.message && (
        <p className="todo-items__message" role="alert">
          {createState.message}
        </p>
      )}

      <div className="todo-items__filters" aria-label="Todoの絞り込み">
        {todoItemFilterOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className="todo-items__filter-button"
            aria-pressed={activeFilter === option.value}
            onClick={() => setActiveFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filteredItems.length > 0 ? (
        <ul className="todo-items__list">
          {filteredItems.map((todoItem) => (
            <TodoItemRow
              key={todoItem.id}
              canEdit={canEdit}
              forceDueTodo={forceDueTodo}
              nowTime={nowTime}
              onTodoChange={replaceTodoItem}
              postId={activePostId}
              todoItem={todoItem}
            />
          ))}
        </ul>
      ) : items.length > 0 ? (
        <p className="todo-items__empty">該当するTodoはありません。</p>
      ) : (
        <p className="todo-items__empty">このメモのTodoはまだありません。</p>
      )}
    </section>
  );
}
