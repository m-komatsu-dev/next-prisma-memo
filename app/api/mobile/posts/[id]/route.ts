import { auth } from "@/auth";
import { postDetailSelect } from "@/lib/post-selects";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import { postIdValueSchema } from "@/lib/zod";
import { NextResponse } from "next/server";

type MobilePostDetailRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: MobilePostDetailRouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { id } = await params;
  const validatedPostId = postIdValueSchema.safeParse(id);

  if (!validatedPostId.success) {
    return NextResponse.json(
      { error: "メモIDの形式が正しくありません。" },
      { status: 400 },
    );
  }

  const postId = validatedPostId.data;

  try {
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        authorId: session.user.id,
      },
      select: postDetailSelect,
    });

    if (!post) {
      return NextResponse.json(
        { error: "メモが見つかりません。" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      post: {
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
      },
    });
  } catch (error) {
    logServerError(error, {
      action: "mobileGetPostDetail",
      userId: session.user.id,
      postId,
    });

    return NextResponse.json(
      { error: "メモの取得に失敗しました。" },
      { status: 500 },
    );
  }
}
