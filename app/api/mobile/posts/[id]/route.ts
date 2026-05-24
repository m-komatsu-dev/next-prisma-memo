import { getMobileAuthUser } from "@/lib/mobile-auth";
import { buildTagsConnectOrCreate } from "@/lib/post-tags";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
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

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}

export async function GET(request: Request, { params }: MobilePostDetailRouteContext) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
    );
  }

  const { id } = await params;
  const validatedPostId = postIdValueSchema.safeParse(id);

  if (!validatedPostId.success) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "メモIDの形式が正しくありません。" },
        { status: 400 },
      ),
    );
  }

  const postId = validatedPostId.data;

  try {
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        authorId: authUser.id,
      },
      select: postDetailSelect,
    });

    if (!post) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "メモが見つかりません。" },
          { status: 404 },
        ),
      );
    }

    return withMobileCors(
      request,
      NextResponse.json({
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
      }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileGetPostDetail",
      userId: authUser.id,
      postId,
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "メモの取得に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: MobilePostDetailRouteContext,
) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
    );
  }

  const { id } = await params;
  const validatedPostId = postIdValueSchema.safeParse(id);

  if (!validatedPostId.success) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "メモIDの形式が正しくありません。" },
        { status: 400 },
      ),
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "リクエスト本文の形式が正しくありません。" },
        { status: 400 },
      ),
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
    return withMobileCors(
      request,
      NextResponse.json(
        { error: getFirstZodErrorMessage(validatedFields.error) },
        { status: 400 },
      ),
    );
  }

  const payload = validatedFields.data;

  try {
    const existingPost = await prisma.post.findFirst({
      where: {
        id: postId,
        authorId: authUser.id,
      },
      select: { id: true },
    });

    if (!existingPost) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "メモが見つかりません。" },
          { status: 404 },
        ),
      );
    }

    const post = await prisma.post.update({
      where: {
        id: postId,
        authorId: authUser.id,
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

    return withMobileCors(
      request,
      NextResponse.json({
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
      }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileUpdatePost",
      userId: authUser.id,
      postId,
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "メモの更新に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: MobilePostDetailRouteContext,
) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
    );
  }

  const { id } = await params;
  const validatedPostId = postIdValueSchema.safeParse(id);

  if (!validatedPostId.success) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "メモIDの形式が正しくありません。" },
        { status: 400 },
      ),
    );
  }

  const postId = validatedPostId.data;

  try {
    const result = await prisma.post.deleteMany({
      where: {
        id: postId,
        authorId: authUser.id,
      },
    });

    if (result.count === 0) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "メモが見つかりません。" },
          { status: 404 },
        ),
      );
    }

    return withMobileCors(request, NextResponse.json({ success: true }));
  } catch (error) {
    logServerError(error, {
      action: "mobileDeletePost",
      userId: authUser.id,
      postId,
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "メモの削除に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}
