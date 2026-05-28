import type { CrossMemoTodo } from "@/app/todos/all-todos-client";
import { isTodoOverdue } from "@/components/todo-items-utils";

export type CalendarTodo = CrossMemoTodo & {
  dueAt: string;
};

export type CalendarDayGroup = {
  dateKey: string;
  label: string;
  todos: CalendarTodo[];
};

export type CalendarViewMode = "week" | "month";

export type CalendarFilter = "today" | "tomorrow" | "week" | "overdue" | "active";

export type CalendarMonthDay = {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  label: string;
  todos: CalendarTodo[];
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const monthFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
});

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
});

export function getLocalDayStart(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

export function addLocalDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function addLocalMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months, 1);
  return getLocalDayStart(nextDate);
}

export function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDateKey(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : getLocalDayStart(date);
}

export function getWeekRange(baseDate: Date) {
  const start = getLocalDayStart(baseDate);
  const end = addLocalDays(start, 7);
  return { start, end };
}

export function getMonthRange(baseDate: Date) {
  const start = getLocalDayStart(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
  const end = getLocalDayStart(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1));
  return { start, end };
}

export function getCalendarGridRange(monthDate: Date) {
  const { start: monthStart, end: monthEnd } = getMonthRange(monthDate);
  const gridStart = addLocalDays(monthStart, -monthStart.getDay());
  const daysAfterMonth = (7 - monthEnd.getDay()) % 7;
  const gridEnd = addLocalDays(monthEnd, daysAfterMonth);
  return { start: gridStart, end: gridEnd };
}

export function getTodayRange(nowTime: number) {
  const start = getLocalDayStart(new Date(nowTime));
  const end = addLocalDays(start, 1);
  return { start, end };
}

export function getTomorrowRange(nowTime: number) {
  const start = addLocalDays(getLocalDayStart(new Date(nowTime)), 1);
  const end = addLocalDays(start, 1);
  return { start, end };
}

export function getThisWeekRange(nowTime: number) {
  return getWeekRange(new Date(nowTime));
}

export function isDateInRange(date: Date, start: Date, end: Date) {
  const time = date.getTime();
  return time >= start.getTime() && time < end.getTime();
}

export function isCalendarTodoInRange(todo: CalendarTodo, start: Date, end: Date) {
  const dueDate = new Date(todo.dueAt);
  return !Number.isNaN(dueDate.getTime()) && isDateInRange(dueDate, start, end);
}

export function filterCalendarTodosByRange(
  todos: CalendarTodo[],
  start: Date,
  end: Date,
  nowTime: number,
) {
  return todos
    .filter((todo) => isCalendarTodoInRange(todo, start, end))
    .sort((a, b) => compareCalendarTodos(a, b, nowTime));
}

export function filterCalendarTodos(
  todos: CalendarTodo[],
  filter: CalendarFilter | null,
  nowTime: number,
) {
  if (!filter) {
    return todos;
  }

  if (filter === "active") {
    return todos.filter((todo) => !todo.completed);
  }

  if (filter === "overdue") {
    return getOverdueCalendarTodos(todos, nowTime);
  }

  const range =
    filter === "today"
      ? getTodayRange(nowTime)
      : filter === "tomorrow"
        ? getTomorrowRange(nowTime)
        : getThisWeekRange(nowTime);

  return filterCalendarTodosByRange(todos, range.start, range.end, nowTime);
}

export function getCalendarMonthLabel(date: Date) {
  return monthFormatter.format(date);
}

export function getCalendarDayLabel(dayStart: Date, nowTime: number) {
  const today = getLocalDayStart(new Date(nowTime));
  const tomorrow = addLocalDays(today, 1);
  const dateText = dateFormatter.format(dayStart);

  if (toLocalDateKey(dayStart) === toLocalDateKey(today)) {
    return `今日 ${dateText}`;
  }

  if (toLocalDateKey(dayStart) === toLocalDateKey(tomorrow)) {
    return `明日 ${dateText}`;
  }

  return dateText;
}

export function getCalendarDueTimeLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : timeFormatter.format(date);
}

export function compareCalendarTodos(a: CalendarTodo, b: CalendarTodo, nowTime: number) {
  if (a.completed !== b.completed) {
    return a.completed ? 1 : -1;
  }

  const aOverdue = isTodoOverdue(a, nowTime);
  const bOverdue = isTodoOverdue(b, nowTime);
  if (aOverdue !== bOverdue) {
    return aOverdue ? -1 : 1;
  }

  const aDueTime = new Date(a.dueAt).getTime();
  const bDueTime = new Date(b.dueAt).getTime();
  if (aDueTime !== bDueTime) {
    return aDueTime - bDueTime;
  }

  return a.position - b.position || a.id - b.id;
}

export function getCalendarDayGroups(
  todos: CalendarTodo[],
  weekStart: Date,
  nowTime: number,
) {
  const { start, end } = getWeekRange(weekStart);
  const weekTodos = filterCalendarTodosByRange(todos, start, end, nowTime);

  const groups = new Map<string, CalendarTodo[]>();
  for (const todo of weekTodos) {
    const dateKey = toLocalDateKey(new Date(todo.dueAt));
    groups.set(dateKey, [...(groups.get(dateKey) ?? []), todo]);
  }

  return Array.from(groups.entries()).map(([dateKey, groupTodos]) => {
    const dayStart = parseLocalDateKey(dateKey) ?? new Date(dateKey);
    return {
      dateKey,
      label: getCalendarDayLabel(dayStart, nowTime),
      todos: groupTodos,
    };
  });
}

export function getCalendarMonthDays(
  todos: CalendarTodo[],
  monthDate: Date,
  nowTime: number,
) {
  const { start: monthStart } = getMonthRange(monthDate);
  const { start: gridStart, end: gridEnd } = getCalendarGridRange(monthDate);
  const gridTodos = filterCalendarTodosByRange(todos, gridStart, gridEnd, nowTime);
  const groupedTodos = new Map<string, CalendarTodo[]>();

  for (const todo of gridTodos) {
    const dateKey = toLocalDateKey(new Date(todo.dueAt));
    groupedTodos.set(dateKey, [...(groupedTodos.get(dateKey) ?? []), todo]);
  }

  const days: CalendarMonthDay[] = [];
  for (let date = gridStart; date.getTime() < gridEnd.getTime(); date = addLocalDays(date, 1)) {
    const dayStart = getLocalDayStart(date);
    const dateKey = toLocalDateKey(dayStart);
    days.push({
      date: dayStart,
      dateKey,
      isCurrentMonth: dayStart.getMonth() === monthStart.getMonth(),
      isToday: dateKey === toLocalDateKey(new Date(nowTime)),
      label: String(dayStart.getDate()),
      todos: groupedTodos.get(dateKey) ?? [],
    });
  }

  return days;
}

export function getOverdueCalendarTodos(todos: CalendarTodo[], nowTime: number) {
  return todos
    .filter((todo) => isTodoOverdue(todo, nowTime))
    .sort((a, b) => compareCalendarTodos(a, b, nowTime));
}
