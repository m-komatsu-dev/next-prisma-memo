"use client";

import { useState, useTransition } from "react";
import type { KeyboardEvent } from "react";
import {
  createTodoItem,
  deleteTodoItem,
  toggleTodoItem,
  updateTodoItem,
} from "@/app/posts/[id]/todo-actions";
import type { PostFormTodoItem } from "@/components/post-form/types";

type TodoItemView = PostFormTodoItem;

type TodoItemsPanelProps = {
  canEdit: boolean;
  embedded?: boolean;
  hideCreateForm?: boolean;
  nowIso: string;
  onEnsurePostId?: () => Promise<number>;
  postId: number | null;
  todoItems: TodoItemView[];
};

type TodoActionState = {
  message?: string;
  success: boolean;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const initialActionState: TodoActionState = { success: true };

function buildTodoFormData(values: Record<string, number | string | null>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value === null ? "" : String(value));
  }

  return formData;
}

function isComposingEnter(event: KeyboardEvent<HTMLInputElement>) {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function getTodoDueDisplay(value: string | null, nowTime: number) {
  if (!value) {
    return { isOverdue: false, label: "" };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { isOverdue: false, label: "" };
  }

  const isOverdue = date.getTime() < nowTime;
  if (isOverdue) {
    return { isOverdue: true, label: `期限切れ: ${dateTimeFormatter.format(date)}` };
  }

  const now = new Date(nowTime);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (getLocalDateKey(date) === getLocalDateKey(now)) {
    return { isOverdue: false, label: `期限: 今日 ${dateTimeFormatter.format(date).split(" ")[1] ?? ""}` };
  }

  if (getLocalDateKey(date) === getLocalDateKey(tomorrow)) {
    return { isOverdue: false, label: `期限: 明日 ${dateTimeFormatter.format(date).split(" ")[1] ?? ""}` };
  }

  return { isOverdue: false, label: `期限: ${dateTimeFormatter.format(date)}` };
}

function TodoItemRow({
  canEdit,
  nowTime,
  postId,
  onTodoChange,
  todoItem,
}: {
  canEdit: boolean;
  nowTime: number;
  onTodoChange: (todoItem: TodoItemView) => void;
  postId: number | null;
  todoItem: TodoItemView;
}) {
  const [updateState, setUpdateState] = useState<TodoActionState>(initialActionState);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todoItem.text);
  const [editDueAt, setEditDueAt] = useState(toDateTimeLocalValue(todoItem.dueAt));
  const [isPending, startTransition] = useTransition();
  const dueDisplay = getTodoDueDisplay(todoItem.dueAt, nowTime);
  const isOverdue = dueDisplay.isOverdue && !todoItem.completed;

  const handleToggle = () => {
    if (!postId) return;

    const formData = buildTodoFormData({
      completed: todoItem.completed ? "false" : "true",
      postId,
      todoItemId: todoItem.id,
    });

    startTransition(async () => {
      const result = await toggleTodoItem(formData);
      setUpdateState(result);
      if (result.success && result.todoItem) {
        onTodoChange(result.todoItem);
      }
    });
  };

  const handleUpdate = () => {
    if (!postId) return;

    const formData = buildTodoFormData({
      dueAt: editDueAt,
      postId,
      text: editText,
      todoItemId: todoItem.id,
    });

    startTransition(async () => {
      const result = await updateTodoItem(initialActionState, formData);
      setUpdateState(result);
      if (result.success && result.todoItem) {
        onTodoChange(result.todoItem);
        setIsEditing(false);
      }
    });
  };

  const handleDelete = () => {
    if (!postId) return;

    const formData = buildTodoFormData({
      postId,
      todoItemId: todoItem.id,
    });

    startTransition(async () => {
      const result = await deleteTodoItem(formData);
      setUpdateState(result);
      if (result.success) {
        onTodoChange({ ...todoItem, text: "" });
      }
    });
  };

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    if (isComposingEnter(event)) return;
    event.preventDefault();
    handleUpdate();
  };

  return (
    <li
      className={[
        "todo-items__row",
        todoItem.completed ? "todo-items__row--completed" : "",
        isOverdue ? "todo-items__row--overdue" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="todo-items__toggle-form">
        <button
          type="button"
          className="todo-items__check"
          onClick={handleToggle}
          aria-label={todoItem.completed ? "未完了にする" : "完了にする"}
          aria-pressed={todoItem.completed}
          disabled={!canEdit || isPending}
        >
          {todoItem.completed ? "✓" : ""}
        </button>
      </div>

      <div className="todo-items__body">
        {isEditing ? (
          <div className="todo-items__edit-form">
            <label>
              <span>Todo</span>
              <input
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                onKeyDown={handleEditKeyDown}
                disabled={!canEdit || isPending}
                maxLength={500}
              />
            </label>
            <label>
              <span>期限</span>
              <input
                type="datetime-local"
                value={editDueAt}
                onChange={(event) => setEditDueAt(event.target.value)}
                onKeyDown={handleEditKeyDown}
                disabled={!canEdit || isPending}
              />
            </label>
            <div className="todo-items__edit-actions">
              <button
                type="button"
                className="todo-items__button todo-items__button--ghost"
                onClick={() => setIsEditing(false)}
                disabled={isPending}
              >
                閉じる
              </button>
              <button
                type="button"
                className="todo-items__button"
                onClick={handleUpdate}
                disabled={!canEdit || isPending}
              >
                保存
              </button>
            </div>
            {!updateState.success && updateState.message && (
              <p className="todo-items__message" role="alert">
                {updateState.message}
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="todo-items__text">{todoItem.text}</p>
            {todoItem.dueAt && (
              <span
                className={[
                  "todo-items__due",
                  isOverdue ? "todo-items__due--overdue" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {dueDisplay.label}
              </span>
            )}
          </>
        )}
      </div>

      <div className="todo-items__actions">
        <button
          type="button"
          className="todo-items__icon-button"
          onClick={() => setIsEditing((current) => !current)}
          disabled={!canEdit}
          title="編集"
        >
          編集
        </button>
        <div className="todo-items__delete-form">
          <button
            type="button"
            className="todo-items__icon-button todo-items__icon-button--danger"
            onClick={handleDelete}
            disabled={!canEdit || isPending}
            title="削除"
          >
            削除
          </button>
        </div>
      </div>
    </li>
  );
}

export default function TodoItemsPanel({
  canEdit,
  embedded = false,
  hideCreateForm = false,
  nowIso,
  onEnsurePostId,
  postId,
  todoItems,
}: TodoItemsPanelProps) {
  const [createState, setCreateState] = useState<TodoActionState>(initialActionState);
  const [activePostId, setActivePostId] = useState(postId);
  const [items, setItems] = useState(todoItems);
  const [newText, setNewText] = useState("");
  const [newDueAt, setNewDueAt] = useState("");
  const [todoKind, setTodoKind] = useState<"plain" | "due">("plain");
  const [isCreating, startCreateTransition] = useTransition();
  const nowTime = new Date(nowIso).getTime();

  const replaceTodoItem = (nextTodoItem: TodoItemView) => {
    setItems((currentItems) => {
      if (!nextTodoItem.text) {
        return currentItems.filter((item) => item.id !== nextTodoItem.id);
      }

      const existingIndex = currentItems.findIndex((item) => item.id === nextTodoItem.id);
      if (existingIndex === -1) {
        return [...currentItems, nextTodoItem].sort((a, b) => a.position - b.position || a.id - b.id);
      }

      return currentItems.map((item) => (item.id === nextTodoItem.id ? nextTodoItem : item));
    });
  };

  const handleCreate = () => {
    if (!newText.trim()) {
      setCreateState({ success: false, message: "Todo内容を入力してください。" });
      return;
    }

    if (todoKind === "due" && !newDueAt) {
      setCreateState({ success: false, message: "期限日時を入力してください。" });
      return;
    }

    startCreateTransition(async () => {
      let ensuredPostId = activePostId;

      if (!ensuredPostId) {
        if (!onEnsurePostId) {
          setCreateState({ success: false, message: "下書きメモを作成できませんでした。" });
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
        dueAt: todoKind === "due" ? newDueAt : null,
        postId: ensuredPostId,
        text: newText.trim(),
      });
      const result = await createTodoItem(initialActionState, formData);
      setCreateState(result);
      if (result.success && result.todoItem) {
        replaceTodoItem(result.todoItem);
        setNewText("");
        setNewDueAt("");
      }
    });
  };

  const handleCreateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    if (isComposingEnter(event)) return;
    event.preventDefault();
    if (!newText.trim() || (todoKind === "due" && !newDueAt)) return;
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
          <h2 id={embedded ? "editor-todo-items-title" : "todo-items-title"}>このメモのTodo</h2>
        </div>
        {!canEdit && <span className="memo-badge">閲覧のみ</span>}
      </div>

      {!hideCreateForm && (
        <>
          <p className="todo-items__create-title">Todoを追加</p>
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
          <div
            className={[
              "todo-items__create-form",
              todoKind === "due" ? "todo-items__create-form--due" : "",
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
            {todoKind === "due" && (
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
            )}
            <button
              type="button"
              className="todo-items__button"
              onClick={handleCreate}
              disabled={!canEdit || isCreating || !newText.trim() || (todoKind === "due" && !newDueAt)}
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

      {items.length > 0 ? (
        <ul className="todo-items__list">
          {items.map((todoItem) => (
            <TodoItemRow
              key={todoItem.id}
              canEdit={canEdit}
              nowTime={nowTime}
              onTodoChange={replaceTodoItem}
              postId={activePostId}
              todoItem={todoItem}
            />
          ))}
        </ul>
      ) : (
        <p className="todo-items__empty">このメモのTodoはまだありません。</p>
      )}
    </section>
  );
}
