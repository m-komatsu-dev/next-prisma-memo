import { auth } from "@/auth";
import type { Prisma } from "@/app/generated/prisma";
import { memoListPostSelect, type MemoListPost } from "@/lib/post-selects";
import { prisma } from "@/lib/prisma";
import { logServerError, throwLoggedActionError } from "@/lib/server-errors";
import {
  getFirstZodErrorMessage,
  postIdFormSchema,
  togglePublishedFormSchema,
} from "@/lib/zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import PostsListClient, { type MemoCardPost } from "./posts-list-client";

type PostsFilter = "all" | "published" | "private" | "mine";

type PostsPageProps = {
  searchParams?: Promise<{
    filter?: string | string[];
  }>;
};

const postFilters = new Set<PostsFilter>(["all", "published", "private", "mine"]);

function resolvePostsFilter(filter: string | string[] | undefined): PostsFilter {
  const value = Array.isArray(filter) ? filter[0] : filter;
  return value && postFilters.has(value as PostsFilter) ? (value as PostsFilter) : "all";
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

  return {
    OR: [{ authorId: userId }, { published: true }],
  };
}

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

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

  let posts: MemoListPost[] = [];
  let accessiblePostsCount = 0;

  try {
    posts = await prisma.post.findMany({
      where: getPostsWhere(selectedFilter, session.user.id),
      select: memoListPostSelect,
      orderBy: { updatedAt: "desc" },
    });
    accessiblePostsCount =
      selectedFilter === "all"
        ? posts.length
        : await prisma.post.count({
            where: getPostsWhere("all", session.user.id),
          });
  } catch (error) {
    logServerError(error, {
      action: "loadPostsPage",
      userId: session.user.id,
      details: { filter: selectedFilter },
    });
    throw new Error("メモの取得に失敗しました。");
  }

  const memoPosts: MemoCardPost[] = posts.map((post) => ({
    id: post.id,
    title: post.title,
    content: post.content,
    published: post.published,
    authorId: post.authorId,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    tags: post.tags.map((tag) => ({ id: tag.id, name: tag.name })),
  }));

  return (
    <main className="posts-page">
      <PostsListClient
        accessiblePostsCount={accessiblePostsCount}
        currentUserId={session.user.id}
        deletePostAction={deletePost}
        posts={memoPosts}
        selectedFilter={selectedFilter}
        togglePublishedAction={togglePublished}
        userName={session.user.name ?? "あなた"}
      />
    </main>
  );
}
