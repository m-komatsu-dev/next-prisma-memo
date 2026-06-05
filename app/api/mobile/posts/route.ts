import { getMobileAuthUser } from "@/lib/mobile-auth";
import { serializeMobilePost } from "@/lib/mobile-post-response";
import { buildTagsConnectOrCreate } from "@/lib/post-tags";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import {
  createMemoPreview,
  MOBILE_MEMO_LIST_LIMIT,
  MEMO_LIST_MAX_LIMIT,
  resolveListLimit,
} from "@/lib/list-query";
import { getMemoListPostSelect, getPostDetailSelect } from "@/lib/post-selects";
import { getMobileAccessiblePostsWhere } from "@/lib/post-permissions";
import { resolvePostSearchQuery, withPostSearchWhere } from "@/lib/post-search";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import {
  getFirstZodErrorMessage,
  postSavePayloadSchema,
} from "@/lib/zod";
import { NextResponse } from "next/server";

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}

export async function GET(request: Request) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = resolveListLimit(
      searchParams.get("limit"),
      MOBILE_MEMO_LIST_LIMIT,
      MEMO_LIST_MAX_LIMIT,
    );
    const query = resolvePostSearchQuery(searchParams.get("q"));
    const posts = await prisma.post.findMany({
      where: withPostSearchWhere(getMobileAccessiblePostsWhere(authUser.id), query),
      select: getMemoListPostSelect(authUser.id),
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return withMobileCors(
      request,
      NextResponse.json({
        posts: posts.map((post) =>
          serializeMobilePost(
            {
              ...post,
              content: createMemoPreview(post.content).content,
            },
            authUser.id,
          ),
        ),
      }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileListPosts",
      userId: authUser.id,
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

export async function POST(request: Request) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
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

  const rawPayload =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const validatedFields = postSavePayloadSchema.safeParse({
    id: null,
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
    const post = await prisma.post.create({
      data: {
        title: payload.title.trim(),
        content: payload.content.trim(),
        kind: payload.kind,
        todoListDueAt: payload.kind === "dueTodo" ? payload.todoListDueAt : null,
        published: payload.published,
        authorId: authUser.id,
        tags: {
          connectOrCreate: buildTagsConnectOrCreate(payload.tags),
        },
      },
      select: getPostDetailSelect(authUser.id),
    });

    return withMobileCors(
      request,
      NextResponse.json({
        post: serializeMobilePost(post, authUser.id),
      }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileCreatePost",
      userId: authUser.id,
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "メモの作成に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}
