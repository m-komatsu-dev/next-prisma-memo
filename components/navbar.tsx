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

  async function signOutAction() {
    "use server";
    try {
      await signOut({ redirectTo: "/" });
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }

      logServerError(error, {
        action: "navbarSignOut",
        userId: session?.user?.id,
      });
      throw new Error("ログアウト処理に失敗しました。");
    }
  }

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
                <form action={signOutAction}>
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

        <details className="mobile-menu">
          <summary className="mobile-menu__button" aria-label="メニューを開く">
            <span className="mobile-menu__bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>メニュー</span>
          </summary>

          <div className="mobile-menu__panel">
            {session ? (
              <>
                <div className="mobile-menu__user">{session.user?.name ?? "ユーザー"}</div>
                <Link href="/posts">メモ一覧</Link>
                <Link href="/todos">Todo一覧</Link>
                <Link href="/todos/calendar">カレンダー</Link>
                <Link href="/posts?filter=shared">共有メモ</Link>
                <Link href="/notifications" className="mobile-menu__notification-link">
                  <span>通知</span>
                  {unreadNotificationCount > 0 ? (
                    <span className="nav-notification-badge">
                      {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                    </span>
                  ) : null}
                </Link>
                <Link href="/posts/new">新規作成</Link>
                <Link href="/account">アカウント</Link>
                <form action={signOutAction}>
                  <button className="mobile-menu__logout" type="submit">
                    ログアウト
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/">ログイン</Link>
                <Link href="/register">新規登録</Link>
              </>
            )}
          </div>
        </details>
      </nav>
    </header>
  );
}
