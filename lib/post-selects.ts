import type { Prisma } from "@/app/generated/prisma";
import { TODO_ITEM_PREVIEW_LIMIT } from "@/lib/list-query";

const postTagsSelect = {
  select: {
    id: true,
    name: true,
  },
} satisfies Prisma.PostSelect["tags"];

const todoItemsSelect = {
  select: {
    id: true,
    postId: true,
    text: true,
    completed: true,
    dueAt: true,
    reminderAt: true,
    reminderSentAt: true,
    position: true,
    createdAt: true,
    updatedAt: true,
  },
  orderBy: [{ position: "asc" }, { createdAt: "asc" }],
} satisfies Prisma.PostSelect["todoItems"];

const todoItemsPreviewSelect = {
  select: {
    id: true,
    postId: true,
    text: true,
    completed: true,
    dueAt: true,
    reminderAt: true,
    reminderSentAt: true,
    position: true,
    createdAt: true,
    updatedAt: true,
  },
  orderBy: [{ position: "asc" }, { id: "asc" }],
  take: TODO_ITEM_PREVIEW_LIMIT,
} satisfies Prisma.PostSelect["todoItems"];

export function getMemoListPostSelect(userId: string) {
  return {
    id: true,
    title: true,
    content: true,
    published: true,
    kind: true,
    todoListDueAt: true,
    authorId: true,
    createdAt: true,
    updatedAt: true,
    tags: postTagsSelect,
    todoItems: todoItemsPreviewSelect,
    _count: {
      select: {
        todoItems: true,
      },
    },
    shares: {
      where: { userId },
      take: 1,
      select: {
        role: true,
      },
    },
  } satisfies Prisma.PostSelect;
}

export function getPostDetailSelect(userId: string) {
  return {
    id: true,
    title: true,
    content: true,
    published: true,
    kind: true,
    todoListDueAt: true,
    authorId: true,
    createdAt: true,
    updatedAt: true,
    tags: postTagsSelect,
    todoItems: todoItemsSelect,
    shares: {
      where: { userId },
      take: 1,
      select: {
        role: true,
      },
    },
  } satisfies Prisma.PostSelect;
}

export function getPostEditorSelect(userId: string) {
  return {
    id: true,
    title: true,
    content: true,
    published: true,
    kind: true,
    todoListDueAt: true,
    authorId: true,
    tags: {
      select: {
        name: true,
      },
    },
    todoItems: todoItemsSelect,
    shares: {
      where: { userId, role: "editor" },
      take: 1,
      select: {
        role: true,
      },
    },
  } satisfies Prisma.PostSelect;
}

export const memoListPostSelect = {
  id: true,
  title: true,
  content: true,
  published: true,
  kind: true,
  todoListDueAt: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  tags: postTagsSelect,
} satisfies Prisma.PostSelect;//satisfiesは型チェックだけで、肩を壊さず安全に確認する。

export const postDetailSelect = {
  id: true,
  title: true,
  content: true,
  published: true,
  kind: true,
  todoListDueAt: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  tags: postTagsSelect,
} satisfies Prisma.PostSelect;

export const postEditorSelect = {
  id: true,
  title: true,
  content: true,
  published: true,
  kind: true,
  todoListDueAt: true,
  authorId: true,
  tags: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.PostSelect;

export type MemoListPost = Prisma.PostGetPayload<{
  select: ReturnType<typeof getMemoListPostSelect>;
}>;

export type PostDetail = Prisma.PostGetPayload<{
  select: ReturnType<typeof getPostDetailSelect>;
}>;

export type PostEditorPost = Prisma.PostGetPayload<{
  select: ReturnType<typeof getPostEditorSelect>;
}>;
