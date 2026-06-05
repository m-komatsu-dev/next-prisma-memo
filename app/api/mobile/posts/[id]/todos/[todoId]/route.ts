import { getMobileAuthUser } from "@/lib/mobile-auth";
import { mobileError, mobileJson } from "@/lib/mobile-api-response";
import { mobileCorsOptions } from "@/lib/mobile-cors";
import { getEditablePostWhere } from "@/lib/post-permissions";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import { resolveTodoReminderAt } from "@/lib/todo-reminder-schedule";
import { serializeTodoItem } from "@/lib/todo-item-response";
import {
  getFirstZodErrorMessage,
  mobileUpdateTodoItemSchema,
  postIdValueSchema,
  todoItemIdValueSchema,
} from "@/lib/zod";

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
    return mobileError(request, "ログインが必要です。", 401);
  }

  const routeParams = await validateTodoRouteParams(params);

  if (!routeParams) {
    return mobileError(
      request,
      "Todo IDまたはメモIDの形式が正しくありません。",
      400,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return mobileError(request, "リクエスト本文の形式が正しくありません。", 400);
  }

  const validatedFields = mobileUpdateTodoItemSchema.safeParse(body);

  if (!validatedFields.success) {
    return mobileError(request, getFirstZodErrorMessage(validatedFields.error), 400);
  }

  const payload = validatedFields.data;
  const reminderAt =
    payload.dueAt !== undefined
      ? resolveTodoReminderAt(payload.dueAt, payload.reminderAt)
      : payload.reminderAt;
  const updateData = {
    ...payload,
    ...(reminderAt !== undefined ? { reminderAt } : {}),
    ...(payload.dueAt !== undefined || payload.reminderAt !== undefined
      ? { reminderSentAt: null }
      : {}),
  };

  try {
    const post = await prisma.post.findFirst({
      where: getEditablePostWhere(routeParams.postId, authUser.id),
      select: { id: true },
    });

    if (!post) {
      return mobileError(request, "このメモを編集する権限がありません。", 403);
    }

    const result = await prisma.todoItem.updateMany({
      where: {
        id: routeParams.todoItemId,
        postId: post.id,
      },
      data: updateData,
    });

    if (result.count === 0) {
      return mobileError(request, "Todoが見つかりません。", 404);
    }

    const todoItem = await prisma.todoItem.findFirstOrThrow({
      where: {
        id: routeParams.todoItemId,
        postId: post.id,
      },
    });

    return mobileJson(request, { todo: serializeTodoItem(todoItem) });
  } catch (error) {
    logServerError(error, {
      action: "mobileUpdateTodoItem",
      userId: authUser.id,
      postId: routeParams.postId,
      details: { todoItemId: routeParams.todoItemId },
    });

    return mobileError(request, "Todoの更新に失敗しました。", 500);
  }
}

export async function DELETE(request: Request, { params }: MobileTodoItemRouteContext) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return mobileError(request, "ログインが必要です。", 401);
  }

  const routeParams = await validateTodoRouteParams(params);

  if (!routeParams) {
    return mobileError(
      request,
      "Todo IDまたはメモIDの形式が正しくありません。",
      400,
    );
  }

  try {
    const post = await prisma.post.findFirst({
      where: getEditablePostWhere(routeParams.postId, authUser.id),
      select: { id: true },
    });

    if (!post) {
      return mobileError(request, "このメモを編集する権限がありません。", 403);
    }

    const result = await prisma.todoItem.deleteMany({
      where: {
        id: routeParams.todoItemId,
        postId: post.id,
      },
    });

    if (result.count === 0) {
      return mobileError(request, "Todoが見つかりません。", 404);
    }

    return mobileJson(request, { success: true });
  } catch (error) {
    logServerError(error, {
      action: "mobileDeleteTodoItem",
      userId: authUser.id,
      postId: routeParams.postId,
      details: { todoItemId: routeParams.todoItemId },
    });

    return mobileError(request, "Todoの削除に失敗しました。", 500);
  }
}
