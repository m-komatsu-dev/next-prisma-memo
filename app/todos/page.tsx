import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AllTodosClient, { type CrossMemoTodo } from "@/app/todos/all-todos-client";
import { compareCrossMemoTodos } from "@/components/all-todos-utils";
import { canEditPost, getPostAccessRole } from "@/lib/post-permissions";
import { prisma } from "@/lib/prisma";
import {
  getNextListLimit,
  resolveListLimit,
  TODO_LIST_MAX_LIMIT,
  TODO_LIST_PAGE_SIZE,
} from "@/lib/list-query";
import { logServerError } from "@/lib/server-errors";

export const metadata: Metadata = {
  title: "My Memo App - Todo一覧",
  description: "ログイン中ユーザーがアクセスできるメモのTodoを横断して確認できます。",
};

type TodosPageProps = {
  searchParams?: Promise<{
    limit?: string | string[];
  }>;
};

export default async function TodosPage({ searchParams }: TodosPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const userId = session.user.id;
  const nowIso = new Date().toISOString();
  const nowTime = new Date(nowIso).getTime();
  const resolvedSearchParams = await searchParams;
  const selectedLimit = resolveListLimit(
    resolvedSearchParams?.limit,
    TODO_LIST_PAGE_SIZE,
    TODO_LIST_MAX_LIMIT,
  );
  let todos: CrossMemoTodo[] = [];
  let hasMoreTodos = false;

  try {
    const todoItems = await prisma.todoItem.findMany({
      where: {
        post: {
          OR: [{ authorId: userId }, { shares: { some: { userId } } }],
        },
      },
      select: {
        id: true,
        text: true,
        completed: true,
        dueAt: true,
        position: true,
        postId: true,
        reminderAt: true,
        reminderSentAt: true,
        post: {
          select: {
            authorId: true,
            title: true,
            shares: {
              where: { userId },
              select: { role: true },
            },
          },
        },
      },
      orderBy: [
        { completed: "asc" },
        { dueAt: { sort: "asc", nulls: "last" } },
        { postId: "asc" },
        { position: "asc" },
        { id: "asc" },
      ],
      take: selectedLimit + 1,
    });

    hasMoreTodos = todoItems.length > selectedLimit;
    todos = todoItems
      .slice(0, selectedLimit)
      .map((todoItem) => {
        const accessRole = getPostAccessRole(todoItem.post, userId);

        return {
          canEdit: canEditPost(accessRole),
          completed: todoItem.completed,
          dueAt: todoItem.dueAt?.toISOString() ?? null,
          id: todoItem.id,
          position: todoItem.position,
          postId: todoItem.postId,
          postTitle: todoItem.post.title,
          reminderAt: todoItem.reminderAt?.toISOString() ?? null,
          reminderSentAt: todoItem.reminderSentAt?.toISOString() ?? null,
          text: todoItem.text,
        };
      })
      .sort((a, b) => compareCrossMemoTodos(a, b, nowTime));
  } catch (error) {
    logServerError(error, {
      action: "loadTodosPage",
      userId,
      details: { limit: selectedLimit },
    });
    throw new Error("Todo一覧の取得に失敗しました。");
  }

  return (
    <main className="todos-page">
      <div className="todos-shell">
        <nav className="post-breadcrumb" aria-label="パンくずリスト">
          <Link href="/">ホーム</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Todo一覧</span>
        </nav>

        <header className="todos-page__header">
          <div>
            <p className="todo-items__eyebrow">Todos</p>
            <h1>全メモTodo一覧</h1>
          </div>
          <div className="todos-page__actions">
            <Link className="todo-items__button todo-items__button--ghost" href="/todos/calendar">
              カレンダー
            </Link>
            <Link className="todo-items__button todo-items__button--ghost" href="/posts">
              メモ一覧へ
            </Link>
          </div>
        </header>

        <AllTodosClient
          hasMoreTodos={hasMoreTodos}
          nextLimit={getNextListLimit(selectedLimit, TODO_LIST_PAGE_SIZE, TODO_LIST_MAX_LIMIT)}
          nowIso={nowIso}
          todos={todos}
        />
      </div>
    </main>
  );
}
