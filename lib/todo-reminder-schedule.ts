const DEFAULT_TODO_REMINDER_LEAD_MS = 60 * 60 * 1000;

export function getDefaultTodoReminderAt(
  dueAt: Date | null | undefined,
  now = new Date(),
) {
  if (!dueAt) return null;

  if (dueAt.getTime() <= now.getTime()) {
    return null;
  }

  const reminderAt = new Date(dueAt.getTime() - DEFAULT_TODO_REMINDER_LEAD_MS);

  return reminderAt.getTime() > now.getTime() ? reminderAt : now;
}

export function resolveTodoReminderAt(
  dueAt: Date | null | undefined,
  reminderAt: Date | null | undefined,
) {
  return reminderAt === undefined ? getDefaultTodoReminderAt(dueAt) : reminderAt;
}
