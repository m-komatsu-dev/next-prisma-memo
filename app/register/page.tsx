import { Prisma } from "@/app/generated/prisma";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import { registerSchema } from "@/lib/zod";
import bcrypt from "bcrypt";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm, type RegisterActionState } from "./register-form";
import {
  SocialRegisterActions,
  type SocialRegisterActionState,
} from "./social-register-actions";

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

    const { name, email, password } = validatedFields.data;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
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

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return {
          formError: "このメールアドレスは既に登録されています。",
          fieldErrors: {
            email: "別のメールアドレスをお試しください。",
          },
        };
      }

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

    if (formData.get("termsAccepted") !== "on") {
      return { formError: "利用規約への同意が必要です。" };
    }

    await signIn("google");
    return initialSocialState;
  }

  async function registerWithGithub(
    _prevState: SocialRegisterActionState,
    formData: FormData
  ): Promise<SocialRegisterActionState> {
    "use server";

    if (formData.get("termsAccepted") !== "on") {
      return { formError: "利用規約への同意が必要です。" };
    }

    await signIn("github");
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
