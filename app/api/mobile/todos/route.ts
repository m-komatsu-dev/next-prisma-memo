import { getMobileAuthUser } from "@/lib/mobile-auth";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import {
  canEditPost,
  getMobileAccessiblePostsWhere,
  getPostAccessRole,
} from "@/lib/post-permissions";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import { serializeTodoItem } from "@/lib/todo-item-response";
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
    const todoItems = await prisma.todoItem.findMany({
      where: {
        post: getMobileAccessiblePostsWhere(authUser.id),
      },
      select: {
        completed: true,
        createdAt: true,
        dueAt: true,
        id: true,
        position: true,
        postId: true,
        reminderAt: true,
        reminderSentAt: true,
        text: true,
        updatedAt: true,
        post: {
          select: {
            authorId: true,
            title: true,
            shares: {
              where: { userId: authUser.id },
              select: { role: true },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ completed: "asc" }, { dueAt: "asc" }, { position: "asc" }],
    });

    const todos = todoItems.map((todoItem) => {
      const accessRole = getPostAccessRole(todoItem.post, authUser.id);

      return {
        ...serializeTodoItem(todoItem),
        canEdit: canEditPost(accessRole),
        postTitle: todoItem.post.title,
      };
    });

    return withMobileCors(request, NextResponse.json({ todos }));
  } catch (error) {
    logServerError(error, {
      action: "mobileListCrossMemoTodos",
      userId: authUser.id,
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "Todo一覧の取得に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}
