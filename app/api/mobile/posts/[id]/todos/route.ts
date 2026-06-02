import { getMobileAuthUser } from "@/lib/mobile-auth";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import {
  getEditablePostWhere,
  getMobileReadablePostWhere,
} from "@/lib/post-permissions";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import { serializeTodoItem } from "@/lib/todo-item-response";
import {
  getFirstZodErrorMessage,
  mobileCreateTodoItemSchema,
  postIdValueSchema,
} from "@/lib/zod";
import { NextResponse } from "next/server";

type MobileTodoItemsRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}

export async function GET(request: Request, { params }: MobileTodoItemsRouteContext) {
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
      select: { id: true },
    });

    if (!post) {
      return withMobileCors(
        request,
        NextResponse.json({ error: "メモが見つかりません。" }, { status: 404 }),
      );
    }

    const todoItems = await prisma.todoItem.findMany({
      where: { postId: post.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    return withMobileCors(
      request,
      NextResponse.json({ todos: todoItems.map(serializeTodoItem) }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileListTodoItems",
      userId: authUser.id,
      postId,
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "Todoの取得に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}

export async function POST(request: Request, { params }: MobileTodoItemsRouteContext) {
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

  const validatedFields = mobileCreateTodoItemSchema.safeParse(body);

  if (!validatedFields.success) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: getFirstZodErrorMessage(validatedFields.error) },
        { status: 400 },
      ),
    );
  }

  const postId = validatedPostId.data;
  const payload = validatedFields.data;

  try {
    const todoItem = await prisma.$transaction(async (tx) => {
      const post = await tx.post.findFirst({
        where: getEditablePostWhere(postId, authUser.id),
        select: { id: true },
      });

      if (!post) {
        return null;
      }

      const lastTodo = await tx.todoItem.findFirst({
        where: { postId: post.id },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      return tx.todoItem.create({
        data: {
          dueAt: payload.dueAt,
          reminderAt: payload.reminderAt,
          position: (lastTodo?.position ?? -1) + 1,
          postId: post.id,
          text: payload.text,
        },
      });
    });

    if (!todoItem) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "このメモを編集する権限がありません。" },
          { status: 403 },
        ),
      );
    }

    return withMobileCors(
      request,
      NextResponse.json({ todo: serializeTodoItem(todoItem) }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileCreateTodoItem",
      userId: authUser.id,
      postId,
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "Todoの追加に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}
