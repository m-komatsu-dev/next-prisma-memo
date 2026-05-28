import { auth } from "@/auth";
import {
  changePasswordAction,
  type ChangePasswordActionState,
} from "@/app/account/password/actions";
import { ChangePasswordForm } from "@/app/account/password/change-password-form";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "パスワード変更 - My Memo App",
  description: "My Memo App のログインパスワードを変更します",
};

const initialState: ChangePasswordActionState = {
  error: "",
  success: "",
};

export default async function ChangePasswordPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      password: true,
    },
  });

  if (!user) {
    redirect("/");
  }

  const displayName = user.email ?? user.name ?? "現在のユーザー";

  return (
    <div className="account-page">
      <section className="account-shell" aria-labelledby="password-title">
        <div className="account-heading">
          <p className="eyebrow">Security</p>
          <h1 id="password-title">パスワード変更</h1>
          <p>{displayName} のパスワードを変更します。</p>
        </div>

        <section className="account-panel" aria-labelledby="password-form-title">
          <div>
            <p className="account-panel__kicker">Password</p>
            <h2 id="password-form-title">ログインパスワード</h2>
          </div>

          {user.password ? (
            <ChangePasswordForm
              action={changePasswordAction}
              initialState={initialState}
            />
          ) : (
            <p className="account-panel__notice" role="status">
              パスワード変更できません。Google または GitHub ログインのみのアカウントです。
            </p>
          )}
        </section>

        <div className="account-actions">
          <Link className="button button-secondary" href="/account">
            アカウント設定へ戻る
          </Link>
          <Link className="button button-secondary" href="/posts">
            メモ一覧へ戻る
          </Link>
        </div>
      </section>
    </div>
  );
}
