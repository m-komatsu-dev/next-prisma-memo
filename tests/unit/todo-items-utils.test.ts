import { describe, expect, it } from "vitest";
import { compareCrossMemoTodos, type SortableTodoItem } from "@/components/all-todos-utils";
import {
  filterCalendarTodos,
  getCalendarMonthDays,
  getCalendarDayGroups,
  getMonthRange,
  getOverdueCalendarTodos,
  parseLocalDateKey,
  toLocalDateKey,
  type CalendarTodo,
} from "@/components/todo-calendar-utils";
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

  it("groups calendar todos by local due date in the selected seven-day range", () => {
    const calendarTodos = [
      {
        canEdit: true,
        completed: false,
        dueAt: localIso(2026, 4, 28, 18, 0),
        id: 1,
        position: 0,
        postId: 1,
        postTitle: "学校",
        text: "数学の課題",
      },
      {
        canEdit: true,
        completed: false,
        dueAt: localIso(2026, 4, 29, 9, 0),
        id: 2,
        position: 0,
        postId: 1,
        postTitle: "買い物",
        text: "牛乳",
      },
      {
        canEdit: true,
        completed: false,
        dueAt: localIso(2026, 5, 5, 9, 0),
        id: 3,
        position: 0,
        postId: 1,
        postTitle: "来週",
        text: "対象外",
      },
    ] satisfies CalendarTodo[];

    const groups = getCalendarDayGroups(calendarTodos, new Date(2026, 4, 28), nowTime);

    expect(groups.map((group) => group.dateKey)).toEqual([
      toLocalDateKey(new Date(2026, 4, 28)),
      toLocalDateKey(new Date(2026, 4, 29)),
    ]);
    expect(groups[0]?.label).toContain("今日");
    expect(groups[1]?.label).toContain("明日");
  });

  it("parses local date keys and collects only incomplete overdue calendar todos", () => {
    expect(parseLocalDateKey("2026-05-28")?.getHours()).toBe(0);
    expect(parseLocalDateKey("bad")).toBeNull();

    const calendarTodos = [
      {
        canEdit: true,
        completed: false,
        dueAt: localIso(2026, 4, 28, 8, 0),
        id: 1,
        position: 0,
        postId: 1,
        postTitle: "学校",
        text: "期限切れ",
      },
      {
        canEdit: true,
        completed: true,
        dueAt: localIso(2026, 4, 28, 7, 0),
        id: 2,
        position: 0,
        postId: 1,
        postTitle: "学校",
        text: "完了済み",
      },
    ] satisfies CalendarTodo[];

    expect(getOverdueCalendarTodos(calendarTodos, nowTime).map((todo) => todo.id)).toEqual([1]);
  });

  it("keeps overdue todos out of normal calendar ranges when they are outside the selected range", () => {
    const calendarTodos = [
      {
        canEdit: true,
        completed: false,
        dueAt: localIso(2026, 4, 20, 8, 0),
        id: 1,
        position: 0,
        postId: 1,
        postTitle: "学校",
        text: "期間外の期限切れ",
      },
      {
        canEdit: true,
        completed: false,
        dueAt: localIso(2026, 4, 29, 9, 0),
        id: 2,
        position: 0,
        postId: 1,
        postTitle: "学校",
        text: "期間内",
      },
    ] satisfies CalendarTodo[];

    const groups = getCalendarDayGroups(calendarTodos, new Date(2026, 4, 28), nowTime);

    expect(groups.flatMap((group) => group.todos).map((todo) => todo.id)).toEqual([2]);
    expect(filterCalendarTodos(calendarTodos, "overdue", nowTime).map((todo) => todo.id)).toEqual([
      1,
    ]);
  });

  it("builds a month grid and groups due todos by local due date", () => {
    const calendarTodos = [
      {
        canEdit: true,
        completed: false,
        dueAt: localIso(2026, 4, 1, 9, 0),
        id: 1,
        position: 0,
        postId: 1,
        postTitle: "学校",
        text: "月初",
      },
      {
        canEdit: true,
        completed: true,
        dueAt: localIso(2026, 4, 28, 18, 0),
        id: 2,
        position: 0,
        postId: 1,
        postTitle: "買い物",
        text: "完了済み",
      },
    ] satisfies CalendarTodo[];

    const days = getCalendarMonthDays(calendarTodos, getMonthRange(new Date(2026, 4, 28)).start, nowTime);
    const mayFirst = days.find((day) => day.dateKey === "2026-05-01");
    const mayTwentyEighth = days.find((day) => day.dateKey === "2026-05-28");

    expect(days).toHaveLength(42);
    expect(days[0]?.dateKey).toBe("2026-04-26");
    expect(mayFirst?.todos.map((todo) => todo.id)).toEqual([1]);
    expect(mayTwentyEighth?.todos.map((todo) => todo.id)).toEqual([2]);
  });
});
