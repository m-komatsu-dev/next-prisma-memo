import { signIn } from "@/auth";
import { isRedirectError, logServerError } from "@/lib/server-errors";

export function SignInWithGoogle() {
  return (
    <form
      action={async () => {
        "use server";
        try {
          await signIn("google");
        } catch (error) {
          if (isRedirectError(error)) {
            throw error;
          }

          logServerError(error, {
            action: "signInWithGoogle",
            details: { provider: "google" },
          });
          throw new Error("ログイン処理に失敗しました。");
        }
      }}
    >
      <button type="submit" className="button button-social">
        <span className="provider-icon" aria-hidden="true">
          G
        </span>
        Googleでログイン
      </button>
    </form>
  );
}

export function SignInWithGithub() {
  return (
    <form
      action={async () => {
        "use server";
        try {
          await signIn("github");
        } catch (error) {
          if (isRedirectError(error)) {
            throw error;
          }

          logServerError(error, {
            action: "signInWithGithub",
            details: { provider: "github" },
          });
          throw new Error("ログイン処理に失敗しました。");
        }
      }}
    >
      <button type="submit" className="button button-social button-social-dark">
        <span className="provider-icon" aria-hidden="true">
          GH
        </span>
        GitHubでログイン
      </button>
    </form>
  );
}
