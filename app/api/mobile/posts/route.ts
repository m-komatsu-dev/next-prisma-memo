import { auth } from "@/auth";
import { memoListPostSelect } from "@/lib/post-selects";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  try {
    const posts = await prisma.post.findMany({
      where: { authorId: session.user.id },
      select: memoListPostSelect,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        // TodoはDBモデルではなく、既存どおりcontentからパースする設計です。
        published: post.published,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        tags: post.tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
        })),
      })),
    });
  } catch (error) {
    logServerError(error, {
      action: "mobileListPosts",
      userId: session.user.id,
    });

    return NextResponse.json(
      { error: "メモの取得に失敗しました。" },
      { status: 500 },
    );
  }
}
