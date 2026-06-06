"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toggleTodoItem } from "@/app/posts/[id]/todo-actions";
import { compareCrossMemoTodos } from "@/components/all-todos-utils";
import {
  getTodoDueDisplay,
  getTodoReminderDisplay,
  matchesTodoItemFilter,
  todoItemFilterOptions,
  type TodoItemFilter,
} from "@/components/todo-items-utils";

export type CrossMemoTodo = {
  canEdit: boolean;
  completed: boolean;
  dueAt: string | null;
  id: number;
  position: number;
  postId: number;
  postTitle: string;
  reminderAt: string | null;
  reminderSentAt: string | null;
  text: string;
};

type AllTodosClientProps = {
  hasMoreTodos: boolean;
  nextLimit: number;
  nowIso: string;
  todos: CrossMemoTodo[];
};

type ToggleState = {
  message?: string;
  success: boolean;
};

const allTodosFilterOptions = todoItemFilterOptions.filter(
  (option) => option.value !== "noDue",
);

function buildToggleFormData(todo: CrossMemoTodo) {
  const formData = new FormData();
  formData.set("completed", todo.completed ? "false" : "true");
  formData.set("postId", String(todo.postId));
  formData.set("todoItemId", String(todo.id));
  return formData;
}

export default function AllTodosClient({
  hasMoreTodos,
  nextLimit,
  nowIso,
  todos,
}: AllTodosClientProps) {
  const [items, setItems] = useState(todos);
  const [activeFilter, setActiveFilter] = useState<TodoItemFilter>("all");
  const [state, setState] = useState<ToggleState>({ success: true });
  const [pendingTodoId, setPendingTodoId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const nowTime = new Date(nowIso).getTime();

  const visibleItems = useMemo(
    () =>
      items
        .filter((todo) => matchesTodoItemFilter(todo, activeFilter, nowTime))
        .sort((a, b) => compareCrossMemoTodos(a, b, nowTime)),
    [activeFilter, items, nowTime],
  );

  const counts = useMemo(
    () => ({
      active: items.filter((todo) => !todo.completed).length,
      completed: items.filter((todo) => todo.completed).length,
      overdue: items.filter((todo) => matchesTodoItemFilter(todo, "overdue", nowTime)).length,
    }),
    [items, nowTime],
  );

  const handleToggle = (todo: CrossMemoTodo) => {
    if (!todo.canEdit) return;

    setPendingTodoId(todo.id);
    startTransition(async () => {
      const result = await toggleTodoItem(buildToggleFormData(todo));
      setState(result);
      setPendingTodoId(null);

      if (result.success && result.todoItem) {
        const updatedTodoItem = result.todoItem;
        setItems((currentItems) =>
          currentItems.map((item) =>
            item.id === updatedTodoItem.id
              ? {
                  ...item,
                  completed: updatedTodoItem.completed,
                  dueAt: updatedTodoItem.dueAt,
                  position: updatedTodoItem.position,
                  reminderAt: updatedTodoItem.reminderAt,
                  reminderSentAt: updatedTodoItem.reminderSentAt,
                  text: updatedTodoItem.text,
                }
              : item,
          ),
        );
      }
    });
  };

  return (
    <section className="all-todos" aria-label="全メモTodo一覧">
      <div className="all-todos__summary" aria-label="Todo集計">
        <div>
          <span>未完了</span>
          <strong>{counts.active}</strong>
        </div>
        <div>
          <span>期限切れ</span>
          <strong>{counts.overdue}</strong>
        </div>
        <div>
          <span>完了済み</span>
          <strong>{counts.completed}</strong>
        </div>
      </div>

      <div className="todo-items__filters all-todos__filters" aria-label="Todoの絞り込み">
        {allTodosFilterOptions.map((option) => (
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

      {!state.success && state.message && (
        <p className="todo-items__message" role="alert">
          {state.message}
        </p>
      )}

      {visibleItems.length > 0 ? (
        <ul className="all-todos__list">
          {visibleItems.map((todo) => {
            const dueDisplay = getTodoDueDisplay(todo.dueAt, nowTime);
            const isOverdue = dueDisplay.isOverdue && !todo.completed;
            const reminderDisplay = getTodoReminderDisplay(
              todo.reminderAt,
              todo.reminderSentAt,
              todo.completed,
              nowTime,
            );
            const href = todo.canEdit ? `/posts/${todo.postId}/edit` : `/posts/${todo.postId}`;

            return (
              <li
                key={todo.id}
                className={[
                  "all-todos__row",
                  todo.completed ? "all-todos__row--completed" : "",
                  isOverdue ? "all-todos__row--overdue" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  type="button"
                  className="todo-items__check"
                  onClick={() => handleToggle(todo)}
                  aria-label={todo.completed ? "未完了にする" : "完了にする"}
                  aria-pressed={todo.completed}
                  disabled={!todo.canEdit || isPending || pendingTodoId === todo.id}
                  title={todo.canEdit ? undefined : "閲覧権限のため編集できません"}
                >
                  {todo.completed ? "✓" : ""}
                </button>

                <Link className="all-todos__link" href={href}>
                  <span className="all-todos__text">{todo.text}</span>
                  <span className="all-todos__meta">
                    <span>{todo.postTitle}</span>
                    {todo.dueAt ? (
                      <span className={isOverdue ? "todo-items__due todo-items__due--overdue" : "todo-items__due"}>
                        {dueDisplay.label}
                      </span>
                    ) : (
                      <span className="todo-items__due todo-items__due--empty">期限なし</span>
                    )}
                    {!todo.canEdit && <span className="memo-badge">閲覧のみ</span>}
                    {todo.reminderAt && (
                      <span
                        className={
                          reminderDisplay.isUnsentOverdue
                            ? "todo-items__due todo-items__due--overdue"
                            : "todo-items__due"
                        }
                      >
                        {reminderDisplay.label}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : items.length > 0 ? (
        <p className="all-todos__empty">該当するTodoはありません。</p>
      ) : (
        <p className="all-todos__empty">表示できるTodoはまだありません。</p>
      )}

      {hasMoreTodos && visibleItems.length > 0 && (
        <div className="all-todos__pagination">
          <Link className="posts-secondary-action" href={`/todos?limit=${nextLimit}`}>
            もっと見る
          </Link>
        </div>
      )}
    </section>
  );
}
