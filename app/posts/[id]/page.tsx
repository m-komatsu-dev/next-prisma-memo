import { auth } from "@/auth";
import {
  getPostDetailSelect,
  type PostDetail,
} from "@/lib/post-selects";// メモ詳細画面で必要な項目だけをデータベースから取るための設定を読み込む
import {
  canDeletePost,
  canEditPost,
  getPostAccessRole,
  getReadablePostWhere,
} from "@/lib/post-permissions";
import { prisma } from "@/lib/prisma";
import { logServerError, throwLoggedActionError } from "@/lib/server-errors";
import { postIdValueSchema } from "@/lib/zod";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PostDetailActions from "./post-detail-actions";// 編集や削除など、メモ詳細画面の操作ボタンをまとめた部品を読み込みます。
import { TodoListContent } from "@/components/todo-list";
import TodoItemsPanel from "@/components/todo-items";
import type { Metadata } from "next";
import PostShareSettings from "./post-share-settings";

export const metadata: Metadata = {
  title: "My Memo App - メモ詳細",
  description: "メモの詳細情報を表示します。タイトル、内容、作成日時、更新日時、作成者、タグなどを確認できます。編集や削除もこのページから行えます。",
};

// 日付と時刻を日本向けの読みやすい表示に変換するための設定を作ります。
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",// 日付は「2026/05/17」のような中くらいの長さで表示します。  
  timeStyle: "short",// 時刻は「14:30」のような短めの表示にします。
});

const todoPreviewDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "2-digit",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
});

function isTodoListPost(post: PostDetail) {
  return (
    post.kind === "dueTodo" ||
    post.todoListDueAt !== null ||
    post.content.trim() === "期限付きTodo"
  );
}

function TodoItemsContentPreview({ post }: { post: PostDetail }) {
  const todoItems = post.todoItems
    .slice()
    .sort((a, b) => a.position - b.position || a.id - b.id);

  if (todoItems.length === 0) {
    return <p className="memo-todo-preview__empty">Todo項目なし</p>;
  }

  return (
    <ul className="memo-todo-preview memo-todo-preview--detail" aria-label="Todo項目">
      {todoItems.slice(0, 6).map((todoItem) => (
        <li
          className={[
            "memo-todo-preview__item",
            todoItem.completed ? "memo-todo-preview__item--completed" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          key={todoItem.id}
        >
          <span className="memo-todo-preview__check" aria-hidden="true">
            {todoItem.completed ? "✓" : ""}
          </span>
          <span className="memo-todo-preview__text">{todoItem.text}</span>
          {todoItem.dueAt && (
            <span className="memo-todo-preview__due">
              期限 {todoPreviewDateFormatter.format(todoItem.dueAt)}
            </span>
          )}
        </li>
      ))}
      {todoItems.length > 6 && (
        <li className="memo-todo-preview__more">他 {todoItems.length - 6} 件</li>
      )}
    </ul>
  );
}

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const validatedPostId = postIdValueSchema.safeParse(id);

  if (!session?.user?.id) {
    redirect("/");
  }

  if (!validatedPostId.success) {
    notFound();
  }

  const postId = validatedPostId.data;  // 検証済みの安全な id を、以降のデータベース検索で使います。
  let post: PostDetail | null = null;

  // 指定された id のメモをデータベースから 1 件探します。
  try {
    post = await prisma.post.findFirst({
      // URL の id と一致し、自分のメモ、公開済みメモ、または自分に共有されたメモだけを対象にします。
      where: getReadablePostWhere(postId, session.user.id),
      select: getPostDetailSelect(session.user.id),// 画面表示に必要な項目だけを取得します。
    });
  } catch (error) {
    logServerError(error, {
      action: "loadPostDetail",
      userId: session.user.id,
      postId,
    });
    throw new Error("メモの取得に失敗しました。");
  }

  // 条件に合うメモが見つからなかった場合の処理です。
  if (!post) {
    notFound();
  }

  const accessRole = getPostAccessRole(post, session.user.id);
  const canManage = accessRole === "owner";  // ログイン中のユーザーが、このメモの作成者かどうかを判定します。
  const canEdit = canEditPost(accessRole);
  const canDelete = canDeletePost(accessRole);
  const isTodoList = isTodoListPost(post);
  const authorDisplayName = canManage ? session.user.name ?? "あなた" : "匿名ユーザー";// 他人の公開メモでは作成者の個人情報を出さず、本人のメモだけ自分の名前を表示します。
  const sharedUsers = canManage
    ? await prisma.postShare.findMany({
        where: {
          postId,
          post: {
            authorId: session.user.id,
          },
        },
        select: {
          id: true,
          role: true,
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  // このメモを削除するためのサーバー側の関数です。
  async function deletePost() {
    "use server";

    const activeSession = await auth();// 削除ボタンを押した時点でもう一度ログイン状態を確認します。
    // ログインしていない、またはユーザー ID が取れない場合の処理です。
    if (!activeSession?.user?.id) {
      logServerError(new Error("Unauthenticated detail deletePost action"), {// 不正な削除操作があったことをサーバーログに残します。
        action: "detailDeletePost",// どの処理で起きたエラーかをログに残します。
        postId,// どのメモを削除しようとしたかをログに残します。
      });
      throw new Error("ログインが必要です。");
    }

    let deletedCount = 0;

    // データベース削除でエラーが起きても扱えるように try/catch で囲みます。
    try {
      const result = await prisma.post.deleteMany({
        where: {
          id: postId,// 今見ているメモだけを対象にします。
          authorId: activeSession.user.id,// ログイン中の本人が作成したメモだけを削除できるようにします。
        },
      });

      deletedCount = result.count;

    } catch (error) {
      // エラーをログに残しつつ、利用者向けのメッセージに変換して投げ直します。
      throwLoggedActionError(
        error,
        // ログに追加する詳しい情報です。
        {
          action: "detailDeletePost",// どの処理で起きたエラーかを示します。          
          userId: activeSession.user.id,// 誰が操作したかを示します。          
          postId,// どのメモで起きたかを示します。
        },
        "削除できませんでした。",
      );
    }

    // エラーは出なかったのに 1 件も削除されなかった場合の処理です。
    if (deletedCount === 0) {
      // メモが存在しない、または権限がない可能性があるのでエラーにします。
      throwLoggedActionError(        
        new Error("Detail post delete affected 0 rows"),// ログに残すためのエラーを作ります。
        // ログに追加する詳しい情報です。
        {          
          action: "detailDeletePost",// どの処理で起きたエラーかを示します。          
          userId: activeSession.user.id,// 誰が操作したかを示します。          
          postId,// どのメモで起きたかを示します。
        },
        "対象のメモが見つからないか、操作する権限がありません。",
      );
    }

    revalidatePath("/posts");
    redirect("/posts");
  }

  return (
    <main className="post-detail-page">
      <div className="post-detail-shell">
        <nav className="post-breadcrumb" aria-label="パンくずリスト">
          <Link href="/">ホーム</Link>
          <span aria-hidden="true">/</span>
          <Link href="/posts">メモ一覧</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{post.title}</span>
        </nav>

        {/* 編集・削除・AI要約などの操作ボタンを表示する部品です。 */}
        <PostDetailActions          
          canDelete={canDelete}
          canEdit={canEdit}
          canManageShares={canManage}
          content={post.content}// 操作部品にメモ本文を渡します。          
          deleteAction={deletePost}// 削除ボタンが押された時に実行する関数を渡します。
          editHref={`/posts/${post.id}/edit`}
          tags={post.tags.map((tag) => tag.name)}// タグの配列から名前だけを取り出して渡します。
          title={post.title}
        />

        <article className="post-article">
          <header className="post-article__header">
            <div className="post-article__title-row">
              <h1>{post.title}</h1>
              <span className={post.published ? "memo-badge memo-badge--public" : "memo-badge"}>
                {post.published ? "公開" : "非公開"}
              </span>
            </div>

            <dl className="post-meta" aria-label="メモのメタ情報">
              <div>
                <dt>作成</dt>               
                <dd>{dateTimeFormatter.format(post.createdAt)}</dd> {/* 作成日時を日本向けの形式に変換して表示します。 */}
              </div>
              <div>
                <dt>更新</dt>
                <dd>{dateTimeFormatter.format(post.updatedAt)}</dd>{/* 更新日時を日本向けの形式に変換して表示します。 */}
              </div>
              <div>
                <dt>作成者</dt>
                <dd>{authorDisplayName}</dd>
              </div>
              <div>
                <dt>カテゴリー</dt>
                <dd>{post.tags.length > 0 ? post.tags.map((tag) => tag.name).join(" / ") : "未分類"}</dd>
              </div>
              {isTodoList && post.todoListDueAt && (
                <div>
                  <dt>リスト期限</dt>
                  <dd>{dateTimeFormatter.format(post.todoListDueAt)}</dd>
                </div>
              )}
            </dl>

            {/* タグが 1 つ以上ある場合だけ、タグ一覧を表示します。 */}
            {post.tags.length > 0 && (
              <div className="post-detail-tags" aria-label="タグ">
                {post.tags.map((tag) => (                 
                  <span key={tag.id}>#{tag.name}</span>
                ))}
              </div>
            )}
          </header>

          <div className="post-content">
            {isTodoList ? <TodoItemsContentPreview post={post} /> : <TodoListContent content={post.content} />}
          </div>
        </article>

        {post.todoItems.length > 0 && (
          <TodoItemsPanel
            canEdit={canEdit}
            forceDueTodo={isTodoList}
            hideCreateForm
            nowIso={new Date().toISOString()}
            postId={post.id}
            todoItems={post.todoItems.map((todoItem) => ({
              completed: todoItem.completed,
              dueAt: todoItem.dueAt?.toISOString() ?? null,
              id: todoItem.id,
              position: todoItem.position,
              reminderAt: todoItem.reminderAt?.toISOString() ?? null,
              reminderSentAt: todoItem.reminderSentAt?.toISOString() ?? null,
              text: todoItem.text,
            }))}
          />
        )}

        {canManage && (
          <PostShareSettings
            postId={post.id}
            shares={sharedUsers.map((share) => ({
              email: share.user.email ?? "メール未設定",
              id: share.id,
              name: share.user.name,
              role: share.role,
            }))}
          />
        )}
      </div>
    </main>
  );
}
