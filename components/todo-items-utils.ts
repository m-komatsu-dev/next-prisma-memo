export type TodoItemFilter =
  | "all"
  | "active"
  | "completed"
  | "today"
  | "tomorrow"
  | "nextSevenDays"
  | "overdue"
  | "noDue";

export type TodoItemFilterOption = {
  label: string;
  value: TodoItemFilter;
};

export type FilterableTodoItem = {
  completed: boolean;
  dueAt: string | null;
};

export const todoItemFilterOptions: TodoItemFilterOption[] = [
  { label: "すべて", value: "all" },
  { label: "未完了", value: "active" },
  { label: "完了済み", value: "completed" },
  { label: "今日", value: "today" },
  { label: "明日", value: "tomorrow" },
  { label: "今週", value: "nextSevenDays" },
  { label: "期限切れ", value: "overdue" },
  { label: "期限なし", value: "noDue" },
];

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function parseDueAt(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLocalDayStart(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addLocalDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function isDueInLocalDay(dueAt: string | null, targetDate: Date) {
  const dueDate = parseDueAt(dueAt);
  if (!dueDate) {
    return false;
  }

  const dayStart = getLocalDayStart(targetDate);
  const nextDayStart = addLocalDays(dayStart, 1);
  const dueTime = dueDate.getTime();
  return dueTime >= dayStart.getTime() && dueTime < nextDayStart.getTime();
}

export function isTodoOverdue(todoItem: FilterableTodoItem, nowTime: number) {
  const dueDate = parseDueAt(todoItem.dueAt);
  return Boolean(dueDate && !todoItem.completed && dueDate.getTime() < nowTime);
}

export function isTodoDueInNextSevenDays(todoItem: FilterableTodoItem, nowTime: number) {
  const dueDate = parseDueAt(todoItem.dueAt);
  if (!dueDate) {
    return false;
  }

  const todayStart = getLocalDayStart(new Date(nowTime));
  const sevenDaysLaterStart = addLocalDays(todayStart, 7);
  const dueTime = dueDate.getTime();
  return dueTime >= todayStart.getTime() && dueTime < sevenDaysLaterStart.getTime();
}

export function matchesTodoItemFilter(
  todoItem: FilterableTodoItem,
  filter: TodoItemFilter,
  nowTime: number,
) {
  switch (filter) {
    case "active":
      return !todoItem.completed;
    case "completed":
      return todoItem.completed;
    case "today":
      return isDueInLocalDay(todoItem.dueAt, new Date(nowTime));
    case "tomorrow":
      return isDueInLocalDay(todoItem.dueAt, addLocalDays(new Date(nowTime), 1));
    case "nextSevenDays":
      return isTodoDueInNextSevenDays(todoItem, nowTime);
    case "overdue":
      return isTodoOverdue(todoItem, nowTime);
    case "noDue":
      return todoItem.dueAt === null;
    case "all":
    default:
      return true;
  }
}

export function getTodoDueDisplay(value: string | null, nowTime: number) {
  const date = parseDueAt(value);
  if (!date) {
    return { isOverdue: false, label: "" };
  }

  const isOverdue = date.getTime() < nowTime;
  if (isOverdue) {
    return { isOverdue: true, label: `期限切れ: ${dateTimeFormatter.format(date)}` };
  }

  const now = new Date(nowTime);
  const tomorrow = addLocalDays(now, 1);

  if (isDueInLocalDay(value, now)) {
    return { isOverdue: false, label: `期限: 今日 ${dateTimeFormatter.format(date).split(" ")[1] ?? ""}` };
  }

  if (isDueInLocalDay(value, tomorrow)) {
    return { isOverdue: false, label: `期限: 明日 ${dateTimeFormatter.format(date).split(" ")[1] ?? ""}` };
  }

  return { isOverdue: false, label: `期限: ${dateTimeFormatter.format(date)}` };
}

export function getTodoReminderDisplay(
  reminderAt: string | null,
  reminderSentAt: string | null,
  completed: boolean,
  nowTime: number,
) {
  const date = parseDueAt(reminderAt);
  if (!date) {
    return { isPending: false, isUnsentOverdue: false, label: "" };
  }

  const isUnsentOverdue =
    !completed && reminderSentAt === null && date.getTime() <= nowTime;

  if (reminderSentAt) {
    return {
      isPending: false,
      isUnsentOverdue: false,
      label: `通知済み: ${dateTimeFormatter.format(date)}`,
    };
  }

  if (isUnsentOverdue) {
    return {
      isPending: false,
      isUnsentOverdue: true,
      label: `未送信リマインダー: ${dateTimeFormatter.format(date)}`,
    };
  }

  return {
    isPending: true,
    isUnsentOverdue: false,
    label: `通知予定: ${dateTimeFormatter.format(date)}`,
  };
}
