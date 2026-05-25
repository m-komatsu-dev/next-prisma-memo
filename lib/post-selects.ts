import type { Prisma } from "@/app/generated/prisma";

const postTagsSelect = {
  select: {
    id: true,
    name: true,
  },
} satisfies Prisma.PostSelect["tags"];

export function getMemoListPostSelect(userId: string) {
  return {
    id: true,
    title: true,
    content: true,
    published: true,
    authorId: true,
    createdAt: true,
    updatedAt: true,
    tags: postTagsSelect,
    shares: {
      where: { userId },
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
    authorId: true,
    createdAt: true,
    updatedAt: true,
    tags: postTagsSelect,
    shares: {
      where: { userId },
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
    authorId: true,
    tags: {
      select: {
        name: true,
      },
    },
    shares: {
      where: { userId, role: "editor" },
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
