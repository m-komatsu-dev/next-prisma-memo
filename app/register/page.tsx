import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isRedirectError, logServerError } from "@/lib/server-errors";
import { registerSchema, termsAcceptedFormSchema } from "@/lib/zod";
import bcrypt from "bcrypt";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm, type RegisterActionState } from "./register-form";
import {
  SocialRegisterActions,
  type SocialRegisterActionState,
} from "./social-register-actions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Memo App - 新規登録",
  description: "My Memo Appの新規登録ページです。必要な情報を入力して、すぐにメモを始めましょう。GoogleやGitHubアカウントでも簡単に登録できます。",
};

const initialState: RegisterActionState = {
  formError: "",
};

const initialSocialState: SocialRegisterActionState = {
  formError: "",
};

export default function RegisterPage() {
  async function registerUser(
    _prevState: RegisterActionState,
    formData: FormData
  ): Promise<RegisterActionState> {
    "use server";

    const data = Object.fromEntries(formData.entries());
    const validatedFields = registerSchema.safeParse(data);

    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;

      return {
        formError: "入力内容を確認してください。",
        fieldErrors: {
          name: errors.name?.[0],
          email: errors.email?.[0],
          password: errors.password?.[0],
          termsAccepted: errors.termsAccepted?.[0],
        },
      };
    }

    try {
      const { name, email, password } = validatedFields.data;
      const hashedPassword = await bcrypt.hash(password, 10);

      await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
        select: { id: true },
      });
    } catch (error) {
      logServerError(error, {
        action: "registerUser",
        details: { provider: "credentials" },
      });

      return {
        formError: "登録処理に失敗しました。時間をおいて再度お試しください。",
      };
    }

    redirect("/");
  }

  async function registerWithGoogle(
    _prevState: SocialRegisterActionState,
    formData: FormData
  ): Promise<SocialRegisterActionState> {
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
        action: "registerWithGoogle",
        details: { provider: "google" },
      });
      return { formError: "登録処理に失敗しました。" };
    }

    return initialSocialState;
  }

  async function registerWithGithub(
    _prevState: SocialRegisterActionState,
    formData: FormData
  ): Promise<SocialRegisterActionState> {
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
        action: "registerWithGithub",
        details: { provider: "github" },
      });
      return { formError: "登録処理に失敗しました。" };
    }

    return initialSocialState;
  }

  return (
    <main className="register-page">
      <section className="register-card" aria-labelledby="register-title">
        <div className="panel-heading register-heading">
          <p className="panel-kicker">Create account</p>
          <h1 id="register-title">新規登録</h1>
          <p>必要な情報を入力して、すぐにメモを始められます。</p>
        </div>

        <RegisterForm action={registerUser} initialState={initialState} />

        <div className="divider">
          <span>または</span>
        </div>

        <SocialRegisterActions
          githubAction={registerWithGithub}
          googleAction={registerWithGoogle}
          initialState={initialSocialState}
        />

        <p className="register-note">
          既にアカウントをお持ちですか？
          <Link href="/">ログイン</Link>
        </p>
      </section>
    </main>
  );
}
