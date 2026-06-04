import { getMobileAuthUser } from "@/lib/mobile-auth";
import { serializeMobilePost } from "@/lib/mobile-post-response";
import { buildTagsConnectOrCreate } from "@/lib/post-tags";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import { getPostDetailSelect } from "@/lib/post-selects";
import { getMobileReadablePostWhere } from "@/lib/post-permissions";
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
      where: getMobileReadablePostWhere(postId, authUser.id),
      select: getPostDetailSelect(authUser.id),
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
        post: serializeMobilePost(post, authUser.id),
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
    kind: rawPayload.kind,
    todoListDueAt: rawPayload.todoListDueAt,
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
    const accessiblePost = await prisma.post.findFirst({
      where: getMobileReadablePostWhere(postId, authUser.id),
      select: {
        authorId: true,
        id: true,
        shares: {
          where: { userId: authUser.id },
          select: { role: true },
          take: 1,
        },
      },
    });

    if (!accessiblePost) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "メモが見つかりません。" },
          { status: 404 },
        ),
      );
    }

    const canEdit =
      accessiblePost.authorId === authUser.id ||
      accessiblePost.shares[0]?.role === "editor";

    if (!canEdit) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "このメモを編集する権限がありません。" },
          { status: 403 },
        ),
      );
    }

    const post = await prisma.$transaction(async (tx) => {
      const updatedPost = await tx.post.update({
        where: { id: accessiblePost.id },
        data: {
          title: payload.title.trim(),
          content: payload.content.trim(),
          kind: payload.kind,
          todoListDueAt: payload.kind === "dueTodo" ? payload.todoListDueAt : null,
          ...(accessiblePost.authorId === authUser.id
            ? { published: payload.published }
            : {}),
          tags: {
            set: [],
            connectOrCreate: buildTagsConnectOrCreate(payload.tags),
          },
        },
        select: getPostDetailSelect(authUser.id),
      });

      return updatedPost;
    });

    return withMobileCors(
      request,
      NextResponse.json({
        post: serializeMobilePost(post, authUser.id),
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
    const post = await prisma.post.findFirst({
      where: getMobileReadablePostWhere(postId, authUser.id),
      select: { authorId: true, id: true },
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

    if (post.authorId !== authUser.id) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "このメモを削除する権限がありません。" },
          { status: 403 },
        ),
      );
    }

    await prisma.post.delete({
      where: { id: post.id },
    });

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
