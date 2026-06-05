import { auth } from "@/auth";
import type { Prisma } from "@/app/generated/prisma";
import { getMemoListPostSelect, type MemoListPost } from "@/lib/post-selects";
import {
  getAccessiblePostsWhere,
  getPostAccessRole,
  getSharedPostsWhere,
} from "@/lib/post-permissions";
import { resolvePostSearchQuery, withPostSearchWhere } from "@/lib/post-search";
import { prisma } from "@/lib/prisma";
import {
  createMemoPreview,
  getNextListLimit,
  MEMO_LIST_MAX_LIMIT,
  MEMO_LIST_PAGE_SIZE,
  resolveListLimit,
} from "@/lib/list-query";
import { logServerError, throwLoggedActionError } from "@/lib/server-errors";
import {
  getFirstZodErrorMessage,
  postIdFormSchema,
  togglePublishedFormSchema,
} from "@/lib/zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import PostsListClient, { type MemoCardPost } from "./posts-list-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Memo App - メモ一覧",
  description: "あなたのメモ一覧を表示します。ここから新しいメモを作成したり、既存のメモを編集・削除できます。公開設定もこのページで管理できます。",
};

type PostsFilter = "all" | "published" | "private" | "mine" | "shared";
type PostsSort = "updated-desc" | "created-desc" | "title-asc";

type PostsPageProps = {
  searchParams?: Promise<{
    filter?: string | string[];
    limit?: string | string[];
    q?: string | string[];
    sort?: string | string[];
  }>;
};

const postFilters = new Set<PostsFilter>([
  "all",
  "published",
  "private",
  "mine",
  "shared",
]);
const postSorts = new Set<PostsSort>(["updated-desc", "created-desc", "title-asc"]);

function resolvePostsFilter(filter: string | string[] | undefined): PostsFilter {
  const value = Array.isArray(filter) ? filter[0] : filter;
  return value && postFilters.has(value as PostsFilter) ? (value as PostsFilter) : "all";
}

function resolvePostsSort(sort: string | string[] | undefined): PostsSort {
  const value = Array.isArray(sort) ? sort[0] : sort;
  return value && postSorts.has(value as PostsSort) ? (value as PostsSort) : "updated-desc";
}

function getPostsOrderBy(sort: PostsSort): Prisma.PostOrderByWithRelationInput {
  if (sort === "created-desc") {
    return { createdAt: "desc" };
  }

  if (sort === "title-asc") {
    return { title: "asc" };
  }

  return { updatedAt: "desc" };
}

function getPostsWhere(filter: PostsFilter, userId: string): Prisma.PostWhereInput {
  if (filter === "mine") {
    return { authorId: userId };
  }

  if (filter === "published") {
    return { published: true };
  }

  if (filter === "private") {
    return { authorId: userId, published: false };
  }

  if (filter === "shared") {
    return getSharedPostsWhere(userId);
  }

  return getAccessiblePostsWhere(userId);
}

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const userId = session.user.id;

  async function deletePost(formData: FormData) {
    "use server";

    const activeSession = await auth();

    if (!activeSession?.user?.id) {
      logServerError(new Error("Unauthenticated deletePost action"), {
        action: "deletePost",
      });
      throw new Error("ログインが必要です。");
    }

    const validatedFields = postIdFormSchema.safeParse(
      Object.fromEntries(formData.entries()),//FormData を「普通のオブジェクト」に変換している。
    );

    if (!validatedFields.success) {
      throw new Error(getFirstZodErrorMessage(validatedFields.error));
    }

    const { id } = validatedFields.data;
    let deletedCount = 0;

    try {
      const result = await prisma.post.deleteMany({
        where: {
          id,
          authorId: activeSession.user.id,
        },
      });
      deletedCount = result.count;
    } catch (error) {
      throwLoggedActionError(
        error,
        {
          action: "deletePost",
          userId: activeSession.user.id,
          postId: id,
        },
        "削除できませんでした。",
      );
    }

    if (deletedCount === 0) {
      throwLoggedActionError(
        new Error("Post delete affected 0 rows"),
        {
          action: "deletePost",
          userId: activeSession.user.id,
          postId: id,
        },
        "対象のメモが見つからないか、操作する権限がありません。",
      );
    }

    revalidatePath("/posts");
  }

  async function togglePublished(formData: FormData) {
    "use server";

    const activeSession = await auth();

    if (!activeSession?.user?.id) {
      logServerError(new Error("Unauthenticated togglePublished action"), {
        action: "togglePublished",
      });
      throw new Error("ログインが必要です。");
    }

    const validatedFields = togglePublishedFormSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );

    if (!validatedFields.success) {
      throw new Error(getFirstZodErrorMessage(validatedFields.error));
    }

    const { id, published } = validatedFields.data;
    const currentPublished = published === "true";
    let updatedCount = 0;

    try {
      const result = await prisma.post.updateMany({
        where: {
          id,
          authorId: activeSession.user.id,
        },
        data: {
          published: !currentPublished,
        },
      });
      updatedCount = result.count;
    } catch (error) {
      throwLoggedActionError(
        error,
        {
          action: "togglePublished",
          userId: activeSession.user.id,
          postId: id,
        },
        "公開設定を変更できませんでした。",
      );
    }

    if (updatedCount === 0) {
      throwLoggedActionError(
        new Error("Post publish toggle affected 0 rows"),
        {
          action: "togglePublished",
          userId: activeSession.user.id,
          postId: id,
        },
        "対象のメモが見つからないか、操作する権限がありません。",
      );
    }

    revalidatePath("/posts");
  }

  const resolvedSearchParams = await searchParams;
  const selectedFilter = resolvePostsFilter(resolvedSearchParams?.filter);
  const selectedSort = resolvePostsSort(resolvedSearchParams?.sort);
  const selectedQuery = resolvePostSearchQuery(resolvedSearchParams?.q);
  const selectedLimit = resolveListLimit(
    resolvedSearchParams?.limit,
    MEMO_LIST_PAGE_SIZE,
    MEMO_LIST_MAX_LIMIT,
  );

  let posts: MemoListPost[] = [];
  let accessiblePostsCount = 0;
  let filteredPostsCount = 0;
  let hasMorePosts = false;

  try {
    const selectedWhere = withPostSearchWhere(
      getPostsWhere(selectedFilter, userId),
      selectedQuery,
    );
    const nextPosts = await prisma.post.findMany({
      where: selectedWhere,
      select: getMemoListPostSelect(userId),
      orderBy: getPostsOrderBy(selectedSort),
      take: selectedLimit + 1,
    });
    const nextFilteredPostsCount = await prisma.post.count({
      where: selectedWhere,
    });
    const nextAccessiblePostsCount =
      selectedFilter === "all"
        ? nextFilteredPostsCount
        : await prisma.post.count({
            where: getPostsWhere("all", userId),
          });

    hasMorePosts = nextPosts.length > selectedLimit;
    posts = nextPosts.slice(0, selectedLimit);
    filteredPostsCount = nextFilteredPostsCount;
    accessiblePostsCount = nextAccessiblePostsCount;
  } catch (error) {
    logServerError(error, {
      action: "loadPostsPage",
      userId,
      details: {
        filter: selectedFilter,
        limit: selectedLimit,
        query: selectedQuery,
        sort: selectedSort,
      },
    });
    throw new Error("メモの取得に失敗しました。");
  }

  const memoPosts: MemoCardPost[] = posts.map((post) => {
    const accessRole = getPostAccessRole(post, userId);
    const preview = createMemoPreview(post.content);

    return {
      id: post.id,
      title: post.title,
      content: preview.content,
      contentTruncated: preview.isTruncated,
      published: post.published,
      kind: post.kind,
      todoListDueAt: post.todoListDueAt?.toISOString() ?? null,
      accessRole,
      authorId: post.authorId,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      tags: post.tags.map((tag) => ({ id: tag.id, name: tag.name })),
      todoItems: post.todoItems.map((todoItem) => ({
        completed: todoItem.completed,
        dueAt: todoItem.dueAt?.toISOString() ?? null,
        id: todoItem.id,
        position: todoItem.position,
        text: todoItem.text,
      })),
      todoItemsCount: post._count.todoItems,
    };
  });

  return (
    <main className="posts-page">
      <PostsListClient
        accessiblePostsCount={accessiblePostsCount}
        currentUserId={userId}
        deletePostAction={deletePost}
        filteredPostsCount={filteredPostsCount}
        hasMorePosts={hasMorePosts}
        key={`${selectedFilter}:${selectedSort}:${selectedQuery}`}
        nextLimit={getNextListLimit(selectedLimit, MEMO_LIST_PAGE_SIZE, MEMO_LIST_MAX_LIMIT)}
        posts={memoPosts}
        selectedQuery={selectedQuery}
        selectedFilter={selectedFilter}
        selectedLimit={selectedLimit}
        selectedSort={selectedSort}
        togglePublishedAction={togglePublished}
        userName={session.user.name ?? "あなた"}
      />
    </main>
  );
}
