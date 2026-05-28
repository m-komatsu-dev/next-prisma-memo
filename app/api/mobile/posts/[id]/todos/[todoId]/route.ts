import { getMobileAuthUser } from "@/lib/mobile-auth";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import { getEditablePostWhere } from "@/lib/post-permissions";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import { serializeTodoItem } from "@/lib/todo-item-response";
import {
  getFirstZodErrorMessage,
  mobileUpdateTodoItemSchema,
  postIdValueSchema,
  todoItemIdValueSchema,
} from "@/lib/zod";
import { NextResponse } from "next/server";

type MobileTodoItemRouteContext = {
  params: Promise<{
    id: string;
    todoId: string;
  }>;
};

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}

async function validateTodoRouteParams(params: MobileTodoItemRouteContext["params"]) {
  const { id, todoId } = await params;
  const validatedPostId = postIdValueSchema.safeParse(id);
  const validatedTodoId = todoItemIdValueSchema.safeParse(todoId);

  if (!validatedPostId.success || !validatedTodoId.success) {
    return null;
  }

  return {
    postId: validatedPostId.data,
    todoItemId: validatedTodoId.data,
  };
}

export async function PATCH(request: Request, { params }: MobileTodoItemRouteContext) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
    );
  }

  const routeParams = await validateTodoRouteParams(params);

  if (!routeParams) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "Todo IDまたはメモIDの形式が正しくありません。" },
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

  const validatedFields = mobileUpdateTodoItemSchema.safeParse(body);

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
    const post = await prisma.post.findFirst({
      where: getEditablePostWhere(routeParams.postId, authUser.id),
      select: { id: true },
    });

    if (!post) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "このメモを編集する権限がありません。" },
          { status: 403 },
        ),
      );
    }

    const result = await prisma.todoItem.updateMany({
      where: {
        id: routeParams.todoItemId,
        postId: post.id,
      },
      data: payload,
    });

    if (result.count === 0) {
      return withMobileCors(
        request,
        NextResponse.json({ error: "Todoが見つかりません。" }, { status: 404 }),
      );
    }

    const todoItem = await prisma.todoItem.findFirstOrThrow({
      where: {
        id: routeParams.todoItemId,
        postId: post.id,
      },
    });

    return withMobileCors(
      request,
      NextResponse.json({ todoItem: serializeTodoItem(todoItem) }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileUpdateTodoItem",
      userId: authUser.id,
      postId: routeParams.postId,
      details: { todoItemId: routeParams.todoItemId },
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "Todoの更新に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}

export async function DELETE(request: Request, { params }: MobileTodoItemRouteContext) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
    );
  }

  const routeParams = await validateTodoRouteParams(params);

  if (!routeParams) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "Todo IDまたはメモIDの形式が正しくありません。" },
        { status: 400 },
      ),
    );
  }

  try {
    const post = await prisma.post.findFirst({
      where: getEditablePostWhere(routeParams.postId, authUser.id),
      select: { id: true },
    });

    if (!post) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "このメモを編集する権限がありません。" },
          { status: 403 },
        ),
      );
    }

    const result = await prisma.todoItem.deleteMany({
      where: {
        id: routeParams.todoItemId,
        postId: post.id,
      },
    });

    if (result.count === 0) {
      return withMobileCors(
        request,
        NextResponse.json({ error: "Todoが見つかりません。" }, { status: 404 }),
      );
    }

    return withMobileCors(request, NextResponse.json({ success: true }));
  } catch (error) {
    logServerError(error, {
      action: "mobileDeleteTodoItem",
      userId: authUser.id,
      postId: routeParams.postId,
      details: { todoItemId: routeParams.todoItemId },
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "Todoの削除に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}
