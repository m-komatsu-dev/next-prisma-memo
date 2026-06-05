import type { Prisma } from "@/app/generated/prisma";

const MAX_POST_SEARCH_QUERY_LENGTH = 120;

export function resolvePostSearchQuery(value: string | string[] | null | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return (rawValue ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_POST_SEARCH_QUERY_LENGTH);
}

export function buildPostSearchWhere(query: string): Prisma.PostWhereInput | null {
  const normalizedQuery = resolvePostSearchQuery(query);

  if (!normalizedQuery) {
    return null;
  }

  return {
    OR: [
      { title: { contains: normalizedQuery, mode: "insensitive" } },
      { content: { contains: normalizedQuery, mode: "insensitive" } },
      {
        tags: {
          some: { name: { contains: normalizedQuery, mode: "insensitive" } },
        },
      },
      {
        todoItems: {
          some: { text: { contains: normalizedQuery, mode: "insensitive" } },
        },
      },
    ],
  };
}

export function withPostSearchWhere(
  baseWhere: Prisma.PostWhereInput,
  query: string,
): Prisma.PostWhereInput {
  const searchWhere = buildPostSearchWhere(query);

  if (!searchWhere) {
    return baseWhere;
  }

  return {
    AND: [baseWhere, searchWhere],
  };
}
