import type { Prisma } from "@/app/generated/prisma";

export const memoListPostSelect = {
  id: true,
  title: true,
  content: true,
  published: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  tags: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.PostSelect;//satisfiesは型チェックだけで、肩を壊さず安全に確認する。

export const postDetailSelect = {
  id: true,
  title: true,
  content: true,
  published: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  tags: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.PostSelect;

export const postEditorSelect = {
  id: true,
  title: true,
  content: true,
  published: true,
  tags: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.PostSelect;

export type MemoListPost = Prisma.PostGetPayload<{
  select: typeof memoListPostSelect;
}>;

export type PostDetail = Prisma.PostGetPayload<{
  select: typeof postDetailSelect;
}>;

export type PostEditorPost = Prisma.PostGetPayload<{
  select: typeof postEditorSelect;
}>;
