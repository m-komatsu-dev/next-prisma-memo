import { auth } from "@/auth";
import { buildTagsConnectOrCreate } from "@/lib/post-tags";
import { memoListPostSelect, postDetailSelect } from "@/lib/post-selects";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import {
  getFirstZodErrorMessage,
  postSavePayloadSchema,
} from "@/lib/zod";
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

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエスト本文の形式が正しくありません。" },
      { status: 400 },
    );
  }

  const rawPayload =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const validatedFields = postSavePayloadSchema.safeParse({
    id: null,
    title: rawPayload.title,
    content: rawPayload.content,
    published: rawPayload.published,
    tags: rawPayload.tags ?? "",
  });

  if (!validatedFields.success) {
    return NextResponse.json(
      { error: getFirstZodErrorMessage(validatedFields.error) },
      { status: 400 },
    );
  }

  const payload = validatedFields.data;

  try {
    const post = await prisma.post.create({
      data: {
        title: payload.title.trim(),
        content: payload.content.trim(),
        published: payload.published,
        authorId: session.user.id,
        tags: {
          connectOrCreate: buildTagsConnectOrCreate(payload.tags),
        },
      },
      select: postDetailSelect,
    });

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
      action: "mobileCreatePost",
      userId: session.user.id,
    });

    return NextResponse.json(
      { error: "メモの作成に失敗しました。" },
      { status: 500 },
    );
  }
}
