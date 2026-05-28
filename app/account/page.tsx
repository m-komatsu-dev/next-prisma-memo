import { auth } from "@/auth";
import { DeleteAccountForm } from "@/app/account/delete-account-form";
import {
  deleteAccountAction,
  type DeleteAccountActionState,
} from "@/app/account/actions";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "アカウント設定 - My Memo App",
  description: "My Memo App のアカウント設定",
};

const initialState: DeleteAccountActionState = {
  error: "",
};

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  return (
    <div className="account-page">
      <section className="account-shell" aria-labelledby="account-title">
        <div className="account-heading">
          <p className="eyebrow">Account</p>
          <h1 id="account-title">アカウント設定</h1>
          <p>
            {session.user?.email ?? session.user?.name ?? "現在のユーザー"}
            のアカウントを管理します。
          </p>
        </div>

        <section className="account-panel" aria-labelledby="password-title">
          <div>
            <p className="account-panel__kicker">Security</p>
            <h2 id="password-title">パスワード変更</h2>
            <p>メールアドレスでログインするパスワードを変更します。</p>
          </div>

          <Link className="button button-primary" href="/account/password">
            パスワード変更
          </Link>
        </section>

        <section className="account-delete" aria-labelledby="delete-title">
          <div>
            <p className="account-delete__kicker">Danger zone</p>
            <h2 id="delete-title">アカウント削除</h2>
            <p>
              アカウント、ログイン連携、セッション、作成したメモを削除します。
              この操作は取り消せません。
            </p>
          </div>

          <DeleteAccountForm
            action={deleteAccountAction}
            initialState={initialState}
          />
        </section>

        <Link className="button button-secondary account-back-link" href="/posts">
          メモ一覧へ戻る
        </Link>
      </section>
    </div>
  );
}
