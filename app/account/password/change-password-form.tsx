"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ChangePasswordActionState } from "./actions";

type ChangePasswordFormProps = {
  action: (
    prevState: ChangePasswordActionState,
    formData: FormData,
  ) => Promise<ChangePasswordActionState>;
  initialState: ChangePasswordActionState;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button button-primary" disabled={pending} type="submit">
      {pending ? "変更中..." : "パスワードを変更"}
    </button>
  );
}

export function ChangePasswordForm({
  action,
  initialState,
}: ChangePasswordFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState(initialState);

  async function handleAction(
    prevState: ChangePasswordActionState,
    formData: FormData,
  ) {
    const nextState = await action(prevState, formData);
    setState(nextState);

    if (nextState.success) {
      formRef.current?.reset();
    }

    return nextState;
  }

  const [, formAction] = useActionState(handleAction, initialState);
  const currentPasswordError = state.fieldErrors?.currentPassword;
  const newPasswordError = state.fieldErrors?.newPassword;
  const confirmPasswordError = state.fieldErrors?.confirmPassword;

  function clearMessage() {
    if (state.error || state.success || state.fieldErrors) {
      setState(initialState);
    }
  }

  return (
    <form
      action={formAction}
      className="account-password-form"
      noValidate
      ref={formRef}
    >
      <label>
        <span>現在のパスワード</span>
        <input
          aria-describedby={
            currentPasswordError ? "current-password-error" : undefined
          }
          aria-invalid={Boolean(currentPasswordError)}
          autoComplete="current-password"
          name="currentPassword"
          onChange={clearMessage}
          required
          type="password"
        />
      </label>
      {currentPasswordError ? (
        <p className="field-error" id="current-password-error" role="alert">
          {currentPasswordError}
        </p>
      ) : null}

      <label>
        <span>新しいパスワード</span>
        <input
          aria-describedby={
            newPasswordError ? "new-password-error" : undefined
          }
          aria-invalid={Boolean(newPasswordError)}
          autoComplete="new-password"
          name="newPassword"
          onChange={clearMessage}
          required
          type="password"
        />
      </label>
      {newPasswordError ? (
        <p className="field-error" id="new-password-error" role="alert">
          {newPasswordError}
        </p>
      ) : null}

      <label>
        <span>新しいパスワード確認</span>
        <input
          aria-describedby={
            confirmPasswordError ? "confirm-password-error" : undefined
          }
          aria-invalid={Boolean(confirmPasswordError)}
          autoComplete="new-password"
          name="confirmPassword"
          onChange={clearMessage}
          required
          type="password"
        />
      </label>
      {confirmPasswordError ? (
        <p className="field-error" id="confirm-password-error" role="alert">
          {confirmPasswordError}
        </p>
      ) : null}

      {state.error ? (
        <p className="field-error" id="change-password-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="field-success" id="change-password-success" role="status">
          {state.success}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
