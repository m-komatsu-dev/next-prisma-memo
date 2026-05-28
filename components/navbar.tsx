import { auth, signOut } from "@/auth";
import { isRedirectError, logServerError } from "@/lib/server-errors";
import Link from "next/link";

export default async function Navbar() {
  const session = await auth();

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
              <Link href="/posts?filter=shared">共有メモ</Link>
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
