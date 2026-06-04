import { getMobileAuthUser } from "@/lib/mobile-auth";
import { mobileError, mobileJson } from "@/lib/mobile-api-response";
import { mobileCorsOptions } from "@/lib/mobile-cors";
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
    return mobileError(request, "ログインが必要です。", 401);
  }

  const { id } = await params;
  const validatedPostId = postIdValueSchema.safeParse(id);

  if (!validatedPostId.success) {
    return mobileError(request, "メモIDの形式が正しくありません。", 400);
  }

  const postId = validatedPostId.data;

  try {
    const post = await prisma.post.findFirst({
      where: getMobileReadablePostWhere(postId, authUser.id),
      select: { id: true },
    });

    if (!post) {
      return mobileError(request, "メモが見つかりません。", 404);
    }

    const todoItems = await prisma.todoItem.findMany({
      where: { postId: post.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    return mobileJson(request, { todos: todoItems.map(serializeTodoItem) });
  } catch (error) {
    logServerError(error, {
      action: "mobileListTodoItems",
      userId: authUser.id,
      postId,
    });

    return mobileError(request, "Todoの取得に失敗しました。", 500);
  }
}

export async function POST(request: Request, { params }: MobileTodoItemsRouteContext) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return mobileError(request, "ログインが必要です。", 401);
  }

  const { id } = await params;
  const validatedPostId = postIdValueSchema.safeParse(id);

  if (!validatedPostId.success) {
    return mobileError(request, "メモIDの形式が正しくありません。", 400);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return mobileError(request, "リクエスト本文の形式が正しくありません。", 400);
  }

  const validatedFields = mobileCreateTodoItemSchema.safeParse(body);

  if (!validatedFields.success) {
    return mobileError(request, getFirstZodErrorMessage(validatedFields.error), 400);
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
      return mobileError(request, "このメモを編集する権限がありません。", 403);
    }

    return mobileJson(request, { todo: serializeTodoItem(todoItem) });
  } catch (error) {
    logServerError(error, {
      action: "mobileCreateTodoItem",
      userId: authUser.id,
      postId,
    });

    return mobileError(request, "Todoの追加に失敗しました。", 500);
  }
}
