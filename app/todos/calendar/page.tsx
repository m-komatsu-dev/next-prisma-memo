import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import TodoCalendarClient from "@/app/todos/calendar/todo-calendar-client";
import {
  type CalendarViewMode,
  getLocalDayStart,
  getMonthRange,
  parseLocalDateKey,
  type CalendarTodo,
} from "@/components/todo-calendar-utils";
import { canEditPost, getPostAccessRole } from "@/lib/post-permissions";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";

export const metadata: Metadata = {
  title: "My Memo App - Todoカレンダー",
  description: "期限付きTodoを日付ごとに確認できます。",
};

type TodoCalendarPageProps = {
  searchParams?: Promise<{
    start?: string | string[];
    view?: string | string[];
  }>;
};

function resolveStartDate(value: string | string[] | undefined, now: Date) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return parseLocalDateKey(rawValue) ?? getLocalDayStart(now);
}

function resolveViewMode(value: string | string[] | undefined): CalendarViewMode {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "month" ? "month" : "week";
}

export default async function TodoCalendarPage({ searchParams }: TodoCalendarPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const userId = session.user.id;
  const now = new Date();
  const nowIso = now.toISOString();
  const resolvedSearchParams = await searchParams;
  const viewMode = resolveViewMode(resolvedSearchParams?.view);
  const periodStart = resolveStartDate(resolvedSearchParams?.start, now);
  const normalizedPeriodStart =
    viewMode === "month" ? getMonthRange(periodStart).start : periodStart;
  let todos: CalendarTodo[] = [];

  try {
    const todoItems = await prisma.todoItem.findMany({
      where: {
        dueAt: { not: null },
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
      orderBy: [{ dueAt: "asc" }, { position: "asc" }],
    });

    todos = todoItems.flatMap((todoItem) => {
      if (!todoItem.dueAt) {
        return [];
      }

      const accessRole = getPostAccessRole(todoItem.post, userId);
      return {
        canEdit: canEditPost(accessRole),
        completed: todoItem.completed,
        dueAt: todoItem.dueAt.toISOString(),
        id: todoItem.id,
        position: todoItem.position,
        postId: todoItem.postId,
        postTitle: todoItem.post.title,
        text: todoItem.text,
      };
    });
  } catch (error) {
    logServerError(error, {
      action: "loadTodoCalendarPage",
      userId,
    });
    throw new Error("Todoカレンダーの取得に失敗しました。");
  }

  return (
    <main className="todos-page">
      <div className="todos-shell">
        <nav className="post-breadcrumb" aria-label="パンくずリスト">
          <Link href="/">ホーム</Link>
          <span aria-hidden="true">/</span>
          <Link href="/todos">Todo一覧</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">カレンダー</span>
        </nav>

        <header className="todos-page__header">
          <div>
            <p className="todo-items__eyebrow">Calendar</p>
            <h1>Todoカレンダー</h1>
          </div>
          <div className="todos-page__actions">
            <Link className="todo-items__button todo-items__button--ghost" href="/todos">
              Todo一覧へ
            </Link>
          </div>
        </header>

        <TodoCalendarClient
          initialViewMode={viewMode}
          nowIso={nowIso}
          periodStartIso={normalizedPeriodStart.toISOString()}
          todos={todos}
        />
      </div>
    </main>
  );
}
