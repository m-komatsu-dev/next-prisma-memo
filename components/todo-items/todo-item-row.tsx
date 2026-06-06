"use client";

import { useState, useTransition } from "react";
import type { KeyboardEvent } from "react";
import {
  deleteTodoItem,
  toggleTodoItem,
  updateTodoItem,
} from "@/app/posts/[id]/todo-actions";
import type { PostFormTodoItem } from "@/components/post-form/types";
import {
  getTodoDueDisplay,
  getTodoReminderDisplay,
} from "@/components/todo-items-utils";
import {
  buildTodoFormData,
  initialTodoActionState,
  isComposingEnter,
  toDateTimeLocalValue,
  type TodoActionState,
} from "./helpers";

type TodoItemView = PostFormTodoItem;

type TodoItemRowProps = {
  canEdit: boolean;
  forceDueTodo: boolean;
  nowTime: number;
  onTodoChange: (todoItem: TodoItemView) => void;
  postId: number | null;
  todoItem: TodoItemView;
};

export function TodoItemRow({
  canEdit,
  forceDueTodo,
  nowTime,
  postId,
  onTodoChange,
  todoItem,
}: TodoItemRowProps) {
  const [updateState, setUpdateState] = useState<TodoActionState>(
    initialTodoActionState,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todoItem.text);
  const [editDueAt, setEditDueAt] = useState(
    toDateTimeLocalValue(todoItem.dueAt),
  );
  const [editReminderAt, setEditReminderAt] = useState(
    toDateTimeLocalValue(todoItem.reminderAt),
  );
  const [isPending, startTransition] = useTransition();
  const dueDisplay = getTodoDueDisplay(todoItem.dueAt, nowTime);
  const isOverdue = dueDisplay.isOverdue && !todoItem.completed;
  const reminderDisplay = getTodoReminderDisplay(
    todoItem.reminderAt,
    todoItem.reminderSentAt,
    todoItem.completed,
    nowTime,
  );

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

    if (forceDueTodo && !editDueAt) {
      setUpdateState({
        success: false,
        message: "期限付きTodoでは期限日時を入力してください。",
      });
      return;
    }

    const formData = buildTodoFormData({
      dueAt: editDueAt,
      postId,
      reminderAt: editReminderAt,
      text: editText,
      todoItemId: todoItem.id,
    });

    startTransition(async () => {
      const result = await updateTodoItem(initialTodoActionState, formData);
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
        isEditing ? "todo-items__row--editing" : "",
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
            <label>
              <span>通知予定</span>
              <input
                type="datetime-local"
                value={editReminderAt}
                onChange={(event) => setEditReminderAt(event.target.value)}
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
            {todoItem.reminderAt && (
              <span
                className={[
                  "todo-items__due",
                  reminderDisplay.isUnsentOverdue
                    ? "todo-items__due--overdue"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {reminderDisplay.label}
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
