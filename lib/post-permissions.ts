import type { PostShareRole, Prisma } from "@/app/generated/prisma";

export type PostAccessRole = "owner" | "editor" | "viewer" | "public";

type PostAccessInput = {
  authorId: string;
  published?: boolean;
  shares?: { role: PostShareRole }[];
};

export function getAccessiblePostsWhere(userId: string): Prisma.PostWhereInput {
  return {
    OR: [
      { authorId: userId },
      { published: true },
      { shares: { some: { userId } } },
    ],
  };
}

export function getSharedPostsWhere(userId: string): Prisma.PostWhereInput {
  return {
    shares: {
      some: { userId },
    },
  };
}

export function getReadablePostWhere(
  postId: number,
  userId: string,
): Prisma.PostWhereInput {
  return {
    id: postId,
    OR: [
      { authorId: userId },
      { published: true },
      { shares: { some: { userId } } },
    ],
  };
}

export function getEditablePostWhere(
  postId: number,
  userId: string,
): Prisma.PostWhereInput {
  return {
    id: postId,
    OR: [
      { authorId: userId },
      { shares: { some: { userId, role: "editor" } } },
    ],
  };
}

export function getMobileReadablePostWhere(
  postId: number,
  userId: string,
): Prisma.PostWhereInput {
  return {
    id: postId,
    OR: [{ authorId: userId }, { shares: { some: { userId } } }],
  };
}

export function getMobileAccessiblePostsWhere(userId: string): Prisma.PostWhereInput {
  return {
    OR: [{ authorId: userId }, { shares: { some: { userId } } }],
  };
}

export function getPostAccessRole(
  post: PostAccessInput,
  userId: string,
): PostAccessRole {
  if (post.authorId === userId) {
    return "owner";
  }

  const sharedRole = post.shares?.[0]?.role;
  if (sharedRole === "editor") {
    return "editor";
  }

  if (sharedRole === "viewer") {
    return "viewer";
  }

  return "public";
}

export function canEditPost(accessRole: PostAccessRole) {
  return accessRole === "owner" || accessRole === "editor";
}

export function canDeletePost(accessRole: PostAccessRole) {
  return accessRole === "owner";
}

export function canReadPost(accessRole: PostAccessRole | null | undefined) {
  return (
    accessRole === "owner" ||
    accessRole === "editor" ||
    accessRole === "viewer" ||
    accessRole === "public"
  );
}

export function canManagePostShares(accessRole: PostAccessRole | null | undefined) {
  return accessRole === "owner";
}
