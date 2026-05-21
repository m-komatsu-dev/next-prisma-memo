"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

export type LoginActionState = {
  error: string;
};

type SignInFormProps = {
  action: (
    prevState: LoginActionState,
    formData: FormData
  ) => Promise<LoginActionState>;
  initialState: LoginActionState;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="button button-primary"
      disabled={pending}
      type="submit"
    >
      {pending ? "ログイン中..." : "メールアドレスでログイン"}
    </button>
  );
}

export function SignInForm({ action, initialState }: SignInFormProps) {
  const [error, setError] = useState(initialState.error);

  async function handleAction(
    prevState: LoginActionState,
    formData: FormData
  ) {
    const nextState = await action(prevState, formData);
    setError(nextState.error);
    return nextState;
  }

  const [, formAction] = useActionState(handleAction, initialState);

  function clearError() {
    if (error) {
      setError("");
    }
  }

  return (
    <form action={formAction} className="login-form" noValidate>
      <label>
        <span>メールアドレス</span>
        <input
          aria-describedby={error ? "login-error" : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="email"
          name="email"
          onChange={clearError}
          placeholder="you@example.com"
          required
          type="email"
        />
      </label>

      <label>
        <span>パスワード</span>
        <input
          autoComplete="current-password"
          name="password"
          onChange={clearError}
          placeholder="8文字以上"
          required
          type="password"
        />
      </label>

      {error ? (
        <p className="field-error" id="login-error" role="alert">
          {error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
