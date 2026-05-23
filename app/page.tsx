import { auth, signIn } from "@/auth";
import { SignInForm, type LoginActionState } from "@/components/sign-in";
import { SignOut } from "@/components/sign-out";
import {
  SocialSignInWithTerms,
  type SocialSignInActionState,
} from "@/components/social-sign-in-with-terms";
import { isRedirectError, logServerError } from "@/lib/server-errors";
import { loginSchema, termsAcceptedFormSchema } from "@/lib/zod";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Memo App - 思考を逃さず、すっきり整理するメモ空間",
  description: "日々のアイデア、タスク、学びを軽やかに残せるプライベートなメモアプリです。ログインして、あなたのメモ一覧へすぐに進めます。",
};

const features = [
  {
    title: "すぐに書ける",
    description: "思いついた瞬間にメモを残し、あとから迷わず見返せます。",
  },
  {
    title: "自分だけの一覧",
    description: "ログインしたユーザーごとに、必要なメモへ素早くアクセスできます。",
  },
  {
    title: "全世界へ共有",
    description: "メモの設定を切り替えるだけで、全世界に公開できます。",
  },
];

const invalidCredentialsMessage =
  "メールアドレスまたはパスワードが正しくありません";

const initialLoginState: LoginActionState = {
  error: "",
};

const initialSocialSignInState: SocialSignInActionState = {
  formError: "",
};

export default async function Home() {
  const session = await auth();

  async function loginAction(
    _prevState: LoginActionState,
    formData: FormData
  ): Promise<LoginActionState> {
    "use server";

    const validatedFields = loginSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );

    if (!validatedFields.success) {
      return { error: invalidCredentialsMessage };
    }

    const { email, password } = validatedFields.data;

    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: "/posts",
      });
      return { error: "" };
    } catch (error: unknown) {
      if (isRedirectError(error)) {
        throw error;
      }

      logServerError(error, {
        action: "loginAction",
        details: { provider: "credentials" },
      });
      return { error: invalidCredentialsMessage };
    }
  }

  async function loginWithGoogle(
    _prevState: SocialSignInActionState,
    formData: FormData
  ): Promise<SocialSignInActionState> {
    "use server";

    const validatedFields = termsAcceptedFormSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );

    if (!validatedFields.success) {
      return { formError: "利用規約への同意が必要です。" };
    }

    try {
      await signIn("google");
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }

      logServerError(error, {
        action: "loginWithGoogle",
        details: { provider: "google" },
      });
      return { formError: "ログイン処理に失敗しました。" };
    }

    return initialSocialSignInState;
  }

  async function loginWithGithub(
    _prevState: SocialSignInActionState,
    formData: FormData
  ): Promise<SocialSignInActionState> {
    "use server";

    const validatedFields = termsAcceptedFormSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );

    if (!validatedFields.success) {
      return { formError: "利用規約への同意が必要です。" };
    }

    try {
      await signIn("github");
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }

      logServerError(error, {
        action: "loginWithGithub",
        details: { provider: "github" },
      });
      return { formError: "ログイン処理に失敗しました。" };
    }

    return initialSocialSignInState;
  }

  return (
    <div className="home-page">
      <section className="hero-section" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="eyebrow">My Memo App</p>
          <h1 id="home-title">思考を逃さず、すっきり整理するメモ空間。</h1>
          <p className="hero-lede">
            日々のアイデア、タスク、学びを軽やかに残せるプライベートなメモアプリです。
            ログインして、あなたのメモ一覧へすぐに進めます。
          </p>

          <div className="hero-actions" aria-label="主要な操作">
            {session ? (
              <>
                <Link className="button button-primary" href="/posts">
                  メモを見る
                </Link>
                <Link className="button button-secondary" href="/posts/new">
                  新規作成
                </Link>
              </>
            ) : (
              <>
                <a className="button button-primary" href="#login">
                  ログインする
                </a>
                <Link className="button button-secondary" href="/register">
                  新規登録
                </Link>
              </>
            )}
          </div>

          <div className="hero-stats" aria-label="アプリの特徴">
            <div>
              <strong>Fast</strong>
              <span>すぐ書ける導線</span>
            </div>
            <div>
              <strong>Private</strong>
              <span>自分のメモを管理</span>
            </div>
            <div>
              <strong>Clean</strong>
              <span>読み返しやすいUI</span>
            </div>
          </div>
        </div>

        <aside className="auth-panel" id="login" aria-label="ログイン">
          {session ? (
            <div className="signed-in-card">
              <span className="status-pill">ログイン済み</span>
              <div>
                <p className="panel-kicker">ようこそ</p>
                <h2>{session.user?.name ?? "ユーザー"} さん</h2>
                <p>
                  前回の続きからメモを確認するか、新しいメモを作成しましょう。
                </p>
              </div>
              <div className="panel-actions">
                <Link className="button button-primary" href="/posts">
                  メモ一覧へ
                </Link>
                <SignOut />
              </div>
            </div>
          ) : (
            <div className="login-card">
              <div className="panel-heading">
                <p className="panel-kicker">Welcome back</p>
                <h2>ログイン</h2>
                <p>メールアドレス、または外部アカウントで続行できます。</p>
              </div>

              <SignInForm
                action={loginAction}
                initialState={initialLoginState}
              />

              <div className="divider">
                <span>または</span>
              </div>

              <SocialSignInWithTerms
                githubAction={loginWithGithub}
                googleAction={loginWithGoogle}
                initialState={initialSocialSignInState}
              />

              <p className="register-note">
                アカウントをお持ちでない場合は
                <Link href="/register">新規登録</Link>
              </p>
            </div>
          )}
        </aside>
      </section>

      <section className="feature-grid" aria-label="機能">
        {features.map((feature) => (
          <article className="feature-card" key={feature.title}>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
