import { signOut } from "@/auth";
import { isRedirectError, logServerError } from "@/lib/server-errors";

export function SignOut() {
  return (
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
            action: "signOut",
          });
          throw new Error("ログアウト処理に失敗しました。");
        }
      }}
    >
      <button type="submit" className="button button-danger">
        ログアウト
      </button>
    </form>
  );
}
