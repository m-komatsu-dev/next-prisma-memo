import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AllTodosClient, { type CrossMemoTodo } from "@/app/todos/all-todos-client";
import { compareCrossMemoTodos } from "@/components/all-todos-utils";
import { canEditPost, getPostAccessRole } from "@/lib/post-permissions";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";

export const metadata: Metadata = {
  title: "My Memo App - Todo一覧",
  description: "ログイン中ユーザーがアクセスできるメモのTodoを横断して確認できます。",
};

export default async function TodosPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const userId = session.user.id;
  const nowIso = new Date().toISOString();
  const nowTime = new Date(nowIso).getTime();
  let todos: CrossMemoTodo[] = [];

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
    });

    todos = todoItems
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
          text: todoItem.text,
        };
      })
      .sort((a, b) => compareCrossMemoTodos(a, b, nowTime));
  } catch (error) {
    logServerError(error, {
      action: "loadTodosPage",
      userId,
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
          <Link className="todo-items__button todo-items__button--ghost" href="/posts">
            メモ一覧へ
          </Link>
        </header>

        <AllTodosClient nowIso={nowIso} todos={todos} />
      </div>
    </main>
  );
}

