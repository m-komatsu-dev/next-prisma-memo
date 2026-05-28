import { isTodoOverdue, type FilterableTodoItem } from "@/components/todo-items-utils";

export type SortableTodoItem = FilterableTodoItem & {
  id: number;
  dueAt: string | null;
  position: number;
  postId: number;
};

function getDueTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function compareCrossMemoTodos<T extends SortableTodoItem>(
  a: T,
  b: T,
  nowTime: number,
) {
  if (a.completed !== b.completed) {
    return a.completed ? 1 : -1;
  }

  const aOverdue = isTodoOverdue(a, nowTime);
  const bOverdue = isTodoOverdue(b, nowTime);
  if (aOverdue !== bOverdue) {
    return aOverdue ? -1 : 1;
  }

  const aDueTime = getDueTime(a.dueAt);
  const bDueTime = getDueTime(b.dueAt);
  if (aDueTime !== null && bDueTime !== null && aDueTime !== bDueTime) {
    return aDueTime - bDueTime;
  }

  if (aDueTime !== null || bDueTime !== null) {
    return aDueTime === null ? 1 : -1;
  }

  if (a.postId !== b.postId) {
    return a.postId - b.postId;
  }

  return a.position - b.position || a.id - b.id;
}

