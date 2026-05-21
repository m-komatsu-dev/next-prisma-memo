import { signIn } from "@/auth";

export function SignInWithGoogle() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
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
        await signIn("github");
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
