import type {
  MobileCrossMemoTodoItem,
  MobilePost,
  MobilePostShare,
  MobileTodoItem,
} from "../../types/posts";
import { isRecord } from "./client";

function isMobilePostAccessRole(
  value: unknown,
): value is MobilePost["accessRole"] {
  return (
    value === "owner" ||
    value === "editor" ||
    value === "viewer" ||
    value === "public"
  );
}

function normalizeMobilePostKind(value: unknown): MobilePost["kind"] {
  return value === "dueTodo" ? "dueTodo" : "text";
}

function normalizeDateString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeNullableDateString(value: unknown) {
  return typeof value === "string" || value === null ? value : null;
}

function normalizeMobilePostTags(value: unknown): MobilePost["tags"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((tag, index) => {
    if (typeof tag === "string") {
      return [{ id: index, name: tag }];
    }

    if (
      isRecord(tag) &&
      typeof tag.id === "number" &&
      typeof tag.name === "string"
    ) {
      return [{ id: tag.id, name: tag.name }];
    }

    return [];
  });
}

export function normalizeMobileTodoItem(value: unknown): MobileTodoItem | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    typeof value.text !== "string"
  ) {
    return null;
  }

  return {
    completed: typeof value.completed === "boolean" ? value.completed : false,
    createdAt: normalizeDateString(value.createdAt),
    dueAt: normalizeNullableDateString(value.dueAt),
    id: value.id,
    position: typeof value.position === "number" ? value.position : 0,
    postId: typeof value.postId === "number" ? value.postId : 0,
    reminderAt: normalizeNullableDateString(value.reminderAt),
    reminderSentAt: normalizeNullableDateString(value.reminderSentAt),
    text: value.text,
    updatedAt: normalizeDateString(value.updatedAt),
  };
}

export function normalizeMobilePost(value: unknown): MobilePost | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    typeof value.title !== "string" ||
    typeof value.content !== "string"
  ) {
    return null;
  }

  return {
    accessRole: isMobilePostAccessRole(value.accessRole)
      ? value.accessRole
      : "owner",
    authorId: typeof value.authorId === "string" ? value.authorId : "",
    content: value.content,
    createdAt: normalizeDateString(value.createdAt),
    id: value.id,
    kind: normalizeMobilePostKind(value.kind),
    published: typeof value.published === "boolean" ? value.published : false,
    tags: normalizeMobilePostTags(value.tags),
    title: value.title,
    todoListDueAt: normalizeNullableDateString(value.todoListDueAt),
    todoItems: Array.isArray(value.todoItems)
      ? value.todoItems.flatMap((todoItem) => {
          const normalizedTodoItem = normalizeMobileTodoItem(todoItem);
          return normalizedTodoItem ? [normalizedTodoItem] : [];
        })
      : [],
    todoItemsCount:
      typeof value.todoItemsCount === "number" ? value.todoItemsCount : undefined,
    updatedAt: normalizeDateString(value.updatedAt),
  };
}

export function normalizeMobileCrossMemoTodoItem(
  value: unknown,
): MobileCrossMemoTodoItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const todoItem = normalizeMobileTodoItem(value);

  if (!todoItem) {
    return null;
  }

  return {
    ...todoItem,
    canEdit: typeof value.canEdit === "boolean" ? value.canEdit : true,
    postTitle: typeof value.postTitle === "string" ? value.postTitle : "",
  };
}

export function normalizePostTodoItem(
  todoItem: MobileTodoItem,
  post: MobilePost,
): MobileCrossMemoTodoItem {
  return {
    ...todoItem,
    canEdit: post.accessRole === "owner" || post.accessRole === "editor",
    postId: todoItem.postId || post.id,
    postTitle: post.title,
  };
}

export function isMobilePostShare(value: unknown): value is MobilePostShare {
  return (
    isRecord(value) &&
    "email" in value &&
    typeof value.email === "string" &&
    "id" in value &&
    typeof value.id === "number" &&
    "name" in value &&
    (typeof value.name === "string" || value.name === null) &&
    "role" in value &&
    (value.role === "viewer" || value.role === "editor") &&
    "userId" in value &&
    typeof value.userId === "string"
  );
}
