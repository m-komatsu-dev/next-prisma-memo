import { auth } from "@/auth";
import { buildTagsConnectOrCreate } from "@/lib/post-tags";
import { postDetailSelect } from "@/lib/post-selects";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import {
  getFirstZodErrorMessage,
  postIdValueSchema,
  postSavePayloadSchema,
} from "@/lib/zod";
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

export async function PATCH(
  request: Request,
  { params }: MobilePostDetailRouteContext,
) {
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエスト本文の形式が正しくありません。" },
      { status: 400 },
    );
  }

  const postId = validatedPostId.data;
  const rawPayload =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const validatedFields = postSavePayloadSchema.safeParse({
    id: postId,
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
    const existingPost = await prisma.post.findFirst({
      where: {
        id: postId,
        authorId: session.user.id,
      },
      select: { id: true },
    });

    if (!existingPost) {
      return NextResponse.json(
        { error: "メモが見つかりません。" },
        { status: 404 },
      );
    }

    const post = await prisma.post.update({
      where: {
        id: postId,
        authorId: session.user.id,
      },
      data: {
        title: payload.title.trim(),
        content: payload.content.trim(),
        published: payload.published,
        tags: {
          set: [],
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
      action: "mobileUpdatePost",
      userId: session.user.id,
      postId,
    });

    return NextResponse.json(
      { error: "メモの更新に失敗しました。" },
      { status: 500 },
    );
  }
}
