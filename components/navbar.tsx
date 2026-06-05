import { auth, signOut } from "@/auth";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { isRedirectError, logServerError } from "@/lib/server-errors";
import Link from "next/link";

export default async function Navbar() {
  const session = await auth();
  const unreadNotificationCount = session?.user?.id
    ? await getUnreadNotificationCount(session.user.id).catch((error) => {
        logServerError(error, {
          action: "navbarUnreadNotificationCount",
          userId: session.user?.id,
        });
        return 0;
      })
    : 0;

  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="メインナビゲーション">
        <Link href="/" className="brand-link" aria-label="My Memo App ホーム">
          <span className="brand-mark">M</span>
          <span>My Memo</span>
        </Link>

        <div className="nav-links">
          {session ? (
            <>
              <Link href="/posts">メモ一覧</Link>
              <Link href="/todos">Todo一覧</Link>
              <Link href="/todos/calendar">カレンダー</Link>
              <Link href="/posts?filter=shared">共有メモ</Link>
              <Link href="/notifications" className="nav-notification-link">
                <span aria-hidden="true">通知</span>
                <span className="sr-only">通知一覧</span>
                {unreadNotificationCount > 0 ? (
                  <span className="nav-notification-badge">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                ) : null}
              </Link>
              <Link href="/posts/new">新規作成</Link>
              <Link href="/account">アカウント</Link>
              <div className="nav-account">
                <span>{session.user?.name ?? "ユーザー"}</span>
                <form
                  action={async () => {
                    "use server";
                    try {
                      await signOut({ redirectTo: "/" });
                    } catch (error) {
                      if (isRedirectError(error)) {
                        throw error;
                      }

                      logServerError(error, {
                        action: "navbarSignOut",
                        userId: session.user?.id,
                      });
                      throw new Error("ログアウト処理に失敗しました。");
                    }
                  }}
                >
                  <button className="nav-button" type="submit">
                    ログアウト
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              <Link href="/">ログイン</Link>
              <Link className="nav-cta" href="/register">
                新規登録
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
