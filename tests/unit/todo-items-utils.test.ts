import { describe, expect, it } from "vitest";
import { compareCrossMemoTodos, type SortableTodoItem } from "@/components/all-todos-utils";
import {
  getTodoDueDisplay,
  isTodoOverdue,
  matchesTodoItemFilter,
  type FilterableTodoItem,
  type TodoItemFilter,
} from "@/components/todo-items-utils";

function localIso(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute = 0,
) {
  return new Date(year, monthIndex, day, hour, minute).toISOString();
}

function filterTodos(todos: FilterableTodoItem[], filter: TodoItemFilter, nowTime: number) {
  return todos.filter((todo) => matchesTodoItemFilter(todo, filter, nowTime));
}

describe("todo item filter utils", () => {
  const nowTime = new Date(2026, 4, 28, 12, 0).getTime();
  const todos = {
    activeNoDue: { completed: false, dueAt: null },
    completedNoDue: { completed: true, dueAt: null },
    todayOpen: { completed: false, dueAt: localIso(2026, 4, 28, 18, 0) },
    tomorrowOpen: { completed: false, dueAt: localIso(2026, 4, 29, 9, 0) },
    nextWeekOpen: { completed: false, dueAt: localIso(2026, 5, 3, 23, 59) },
    outsideSevenDays: { completed: false, dueAt: localIso(2026, 5, 4, 0, 0) },
    overdueOpen: { completed: false, dueAt: localIso(2026, 4, 28, 8, 0) },
    overdueCompleted: { completed: true, dueAt: localIso(2026, 4, 27, 8, 0) },
  } satisfies Record<string, FilterableTodoItem>;

  const todoList = Object.values(todos);

  it("matches all todos", () => {
    expect(filterTodos(todoList, "all", nowTime)).toHaveLength(todoList.length);
  });

  it("matches active todos", () => {
    expect(filterTodos(todoList, "active", nowTime)).toEqual([
      todos.activeNoDue,
      todos.todayOpen,
      todos.tomorrowOpen,
      todos.nextWeekOpen,
      todos.outsideSevenDays,
      todos.overdueOpen,
    ]);
  });

  it("matches completed todos", () => {
    expect(filterTodos(todoList, "completed", nowTime)).toEqual([
      todos.completedNoDue,
      todos.overdueCompleted,
    ]);
  });

  it("matches today's todos by local 00:00 through 23:59", () => {
    expect(filterTodos(todoList, "today", nowTime)).toEqual([
      todos.todayOpen,
      todos.overdueOpen,
    ]);
  });

  it("matches tomorrow's todos by local 00:00 through 23:59", () => {
    expect(filterTodos(todoList, "tomorrow", nowTime)).toEqual([todos.tomorrowOpen]);
  });

  it("matches todos due in the seven local days starting today", () => {
    expect(filterTodos(todoList, "nextSevenDays", nowTime)).toEqual([
      todos.todayOpen,
      todos.tomorrowOpen,
      todos.nextWeekOpen,
      todos.overdueOpen,
    ]);
  });

  it("matches only incomplete overdue todos", () => {
    expect(filterTodos(todoList, "overdue", nowTime)).toEqual([todos.overdueOpen]);
    expect(isTodoOverdue(todos.overdueCompleted, nowTime)).toBe(false);
  });

  it("matches todos without due dates", () => {
    expect(filterTodos(todoList, "noDue", nowTime)).toEqual([
      todos.activeNoDue,
      todos.completedNoDue,
    ]);
  });

  it("marks completed past-due display data as overdue without forcing row emphasis", () => {
    expect(getTodoDueDisplay(todos.overdueCompleted.dueAt, nowTime)).toMatchObject({
      isOverdue: true,
    });
  });

  it("sorts cross-memo todos by active state, overdue and due date with no-due last", () => {
    const sortableTodos = [
      {
        id: 1,
        postId: 2,
        position: 0,
        completed: false,
        dueAt: null,
      },
      {
        id: 2,
        postId: 1,
        position: 0,
        completed: true,
        dueAt: localIso(2026, 4, 28, 8, 0),
      },
      {
        id: 3,
        postId: 1,
        position: 1,
        completed: false,
        dueAt: localIso(2026, 4, 29, 9, 0),
      },
      {
        id: 4,
        postId: 1,
        position: 2,
        completed: false,
        dueAt: localIso(2026, 4, 28, 8, 0),
      },
    ] satisfies SortableTodoItem[];

    expect(sortableTodos.sort((a, b) => compareCrossMemoTodos(a, b, nowTime)).map((todo) => todo.id)).toEqual([
      4,
      3,
      1,
      2,
    ]);
  });
});
