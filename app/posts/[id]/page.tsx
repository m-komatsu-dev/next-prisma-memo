// ログイン中のユーザー情報を取得するための関数を読み込みます。
import { auth } from "@/auth";
// メモ詳細画面で必要な項目だけをデータベースから取るための設定を読み込みます。
import { postDetailSelect } from "@/lib/post-selects";
// Prisma というデータベース操作用の道具を読み込みます。
import { prisma } from "@/lib/prisma";
// サーバー側で起きたエラーを記録したり、画面に返すエラーを作ったりする関数を読み込みます。
import { logServerError, throwLoggedActionError } from "@/lib/server-errors";
// URL の id が正しい形かどうかを確認するためのルールを読み込みます。
import { postIdValueSchema } from "@/lib/zod";
// Next.js のキャッシュを更新するための関数を読み込みます。
import { revalidatePath } from "next/cache";
// ページ遷移用のリンク部品を読み込みます。
import Link from "next/link";
// 404 ページを表示する関数と、別ページへ移動させる関数を読み込みます。
import { notFound, redirect } from "next/navigation";
// 編集や削除など、メモ詳細画面の操作ボタンをまとめた部品を読み込みます。
import PostDetailActions from "./post-detail-actions";
// メモ本文の中にある Todo リスト表現をきれいに表示する部品を読み込みます。
import { TodoListContent } from "@/components/todo-list";

// 日付と時刻を日本向けの読みやすい表示に変換するための設定を作ります。
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  // 日付は「2026/05/17」のような中くらいの長さで表示します。
  dateStyle: "medium",
  // 時刻は「14:30」のような短めの表示にします。
  timeStyle: "short",
});

// メモ詳細ページ本体です。async が付いているので、データベース取得などの待ち時間がある処理を書けます。
export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // 現在ログインしているユーザーの情報を取得します。
  const session = await auth();
  // URL から渡された params を待って、その中の id を取り出します。
  const { id } = await params;
  // 取り出した id が、このアプリで使える正しい形式かどうかを確認します。
  const validatedPostId = postIdValueSchema.safeParse(id);

  // ログインしていない、またはユーザー ID が取れない場合の処理です。
  if (!session?.user?.id) {
    // トップページへ移動させ、メモ詳細を見せないようにします。
    redirect("/");
  }

  // URL の id が不正な形式だった場合の処理です。
  if (!validatedPostId.success) {
    // 存在しないページとして 404 を表示します。
    notFound();
  }

  // 検証済みの安全な id を、以降のデータベース検索で使います。
  const postId = validatedPostId.data;
  // 指定された id のメモをデータベースから 1 件探します。
  const post = await prisma.post.findFirst({
    // どのメモを探すかという条件を書きます。
    where: {
      // URL の id と一致するメモだけを対象にします。
      id: postId,
      // 自分のメモ、または公開済みのメモだけを表示できるようにします。
      OR: [{ authorId: session.user.id }, { published: true }],
    },
    // 画面表示に必要な項目だけを取得します。
    select: postDetailSelect,
  });

  // 条件に合うメモが見つからなかった場合の処理です。
  if (!post) {
    // 存在しないページとして 404 を表示します。
    notFound();
  }

  // ログイン中のユーザーが、このメモの作成者かどうかを判定します。
  const canManage = post.authorId === session.user.id;
  // 他人の公開メモでは作成者の個人情報を出さず、本人のメモだけ自分の名前を表示します。
  const authorDisplayName = canManage ? session.user.name ?? "あなた" : "匿名ユーザー";

  // このメモを削除するためのサーバー側の関数です。
  async function deletePost() {
    // この関数がブラウザではなくサーバーで実行されることを Next.js に伝えます。
    "use server";

    // 削除ボタンを押した時点でもう一度ログイン状態を確認します。
    const activeSession = await auth();
    // ログインしていない、またはユーザー ID が取れない場合の処理です。
    if (!activeSession?.user?.id) {
      // 不正な削除操作があったことをサーバーログに残します。
      logServerError(new Error("Unauthenticated detail deletePost action"), {
        // どの処理で起きたエラーかをログに残します。
        action: "detailDeletePost",
        // どのメモを削除しようとしたかをログに残します。
        postId,
      });
      // 画面側に「ログインが必要」と分かるエラーを返します。
      throw new Error("ログインが必要です。");
    }

    // 実際に削除できた件数を入れる変数です。最初は 0 件にしておきます。
    let deletedCount = 0;

    // データベース削除でエラーが起きても扱えるように try/catch で囲みます。
    try {
      // 条件に合うメモを削除します。
      const result = await prisma.post.deleteMany({
        // 削除してよいメモの条件を書きます。
        where: {
          // 今見ているメモだけを対象にします。
          id: postId,
          // ログイン中の本人が作成したメモだけを削除できるようにします。
          authorId: activeSession.user.id,
        },
      });
      // Prisma が返した削除件数を保存します。
      deletedCount = result.count;
      // データベース削除中に例外が起きた場合は、ここで受け取ります。
    } catch (error) {
      // エラーをログに残しつつ、利用者向けのメッセージに変換して投げ直します。
      throwLoggedActionError(
        // 実際に起きたエラー情報です。
        error,
        // ログに追加する詳しい情報です。
        {
          // どの処理で起きたエラーかを示します。
          action: "detailDeletePost",
          // 誰が操作したかを示します。
          userId: activeSession.user.id,
          // どのメモで起きたかを示します。
          postId,
        },
        // 利用者に見せるエラーメッセージです。
        "削除できませんでした。",
      );
    }

    // エラーは出なかったのに 1 件も削除されなかった場合の処理です。
    if (deletedCount === 0) {
      // メモが存在しない、または権限がない可能性があるのでエラーにします。
      throwLoggedActionError(
        // ログに残すためのエラーを作ります。
        new Error("Detail post delete affected 0 rows"),
        // ログに追加する詳しい情報です。
        {
          // どの処理で起きたエラーかを示します。
          action: "detailDeletePost",
          // 誰が操作したかを示します。
          userId: activeSession.user.id,
          // どのメモで起きたかを示します。
          postId,
        },
        // 利用者に見せるエラーメッセージです。
        "対象のメモが見つからないか、操作する権限がありません。",
      );
    }

    // メモ一覧ページのキャッシュを更新し、削除後の状態が反映されるようにします。
    revalidatePath("/posts");
    // 削除が終わったらメモ一覧ページへ移動します。
    redirect("/posts");
  }

  // ここから、このページに表示する HTML のような見た目を返します。
  return (
    // ページの中心となる内容を表す main 要素です。
    <main className="post-detail-page">
      {/* 詳細画面全体の幅や余白を整えるための入れ物です。 */}
      <div className="post-detail-shell">
        {/* 現在位置を示すパンくずリストです。aria-label は読み上げソフト向けの説明です。 */}
        <nav className="post-breadcrumb" aria-label="パンくずリスト">
          {/* ホームページへ移動するリンクです。 */}
          <Link href="/">ホーム</Link>
          {/* 区切り記号です。aria-hidden により読み上げの邪魔をしないようにします。 */}
          <span aria-hidden="true">/</span>
          {/* メモ一覧ページへ移動するリンクです。 */}
          <Link href="/posts">メモ一覧</Link>
          {/* 区切り記号です。aria-hidden により読み上げの邪魔をしないようにします。 */}
          <span aria-hidden="true">/</span>
          {/* 今見ているページ名として、メモのタイトルを表示します。 */}
          <span aria-current="page">{post.title}</span>
        </nav>

        {/* 編集・削除・AI要約などの操作ボタンを表示する部品です。 */}
        <PostDetailActions
          // 作成者本人なら編集や削除ができるようにします。
          canManage={canManage}
          // 操作部品にメモ本文を渡します。
          content={post.content}
          // 削除ボタンが押された時に実行する関数を渡します。
          deleteAction={deletePost}
          // 編集ページへのリンク先を作って渡します。
          editHref={`/posts/${post.id}/edit`}
          // タグの配列から名前だけを取り出して渡します。
          tags={post.tags.map((tag) => tag.name)}
          // 操作部品にメモのタイトルを渡します。
          title={post.title}
        />

        {/* 1 つの記事、つまりメモ本文全体を表す article 要素です。 */}
        <article className="post-article">
          {/* メモのタイトルや作成日時など、本文の前に出す情報です。 */}
          <header className="post-article__header">
            {/* タイトルと公開状態バッジを横に並べるための行です。 */}
            <div className="post-article__title-row">
              {/* メモのタイトルを、このページの一番大きな見出しとして表示します。 */}
              <h1>{post.title}</h1>
              {/* 公開中なら公開用の見た目、非公開なら通常の見た目のバッジにします。 */}
              <span className={post.published ? "memo-badge memo-badge--public" : "memo-badge"}>
                {/* published が true なら「公開」、false なら「非公開」と表示します。 */}
                {post.published ? "公開" : "非公開"}
              </span>
            </div>

            {/* メモの補足情報を、用語と説明のセットで表示します。 */}
            <dl className="post-meta" aria-label="メモのメタ情報">
              {/* 作成日時の表示ブロックです。 */}
              <div>
                {/* 表示する項目名です。 */}
                <dt>作成</dt>
                {/* 作成日時を日本向けの形式に変換して表示します。 */}
                <dd>{dateTimeFormatter.format(post.createdAt)}</dd>
              </div>
              {/* 更新日時の表示ブロックです。 */}
              <div>
                {/* 表示する項目名です。 */}
                <dt>更新</dt>
                {/* 更新日時を日本向けの形式に変換して表示します。 */}
                <dd>{dateTimeFormatter.format(post.updatedAt)}</dd>
              </div>
              {/* 作成者の表示ブロックです。 */}
              <div>
                {/* 表示する項目名です。 */}
                <dt>作成者</dt>
                {/* 他人の公開メモでは、作成者の個人情報を表示しないようにします。 */}
                <dd>{authorDisplayName}</dd>
              </div>
              {/* カテゴリーの表示ブロックです。 */}
              <div>
                {/* 表示する項目名です。 */}
                <dt>カテゴリー</dt>
                {/* タグがあれば「 / 」区切りで表示し、なければ「未分類」と表示します。 */}
                <dd>{post.tags.length > 0 ? post.tags.map((tag) => tag.name).join(" / ") : "未分類"}</dd>
              </div>
            </dl>

            {/* タグが 1 つ以上ある場合だけ、タグ一覧を表示します。 */}
            {post.tags.length > 0 && (
              // タグ全体をまとめる入れ物です。aria-label は読み上げソフト向けの説明です。
              <div className="post-detail-tags" aria-label="タグ">
                {/* タグの数だけ span 要素を作って表示します。 */}
                {post.tags.map((tag) => (
                  // key は React が一覧の各要素を見分けるために必要な目印です。
                  <span key={tag.id}>#{tag.name}</span>
                ))}
              </div>
            )}
          </header>

          {/* メモ本文を表示する入れ物です。 */}
          <div className="post-content">
            {/* Todo リスト表現を含む本文を、表示用の部品に渡して描画します。 */}
            <TodoListContent content={post.content} />
          </div>
        </article>
      </div>
    </main>
  );
}
