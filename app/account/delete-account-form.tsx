"use client";

import { ACCOUNT_DELETE_CONFIRMATION } from "@/lib/account-delete-confirmation";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { DeleteAccountActionState } from "./actions";

type DeleteAccountFormProps = {
  action: (
    prevState: DeleteAccountActionState,
    formData: FormData,
  ) => Promise<DeleteAccountActionState>;
  initialState: DeleteAccountActionState;
};

function SubmitButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="account-delete__submit"
      disabled={!enabled || pending}
      type="submit"
    >
      {pending ? "削除中..." : "アカウントを完全に削除"}
    </button>
  );
}

export function DeleteAccountForm({
  action,
  initialState,
}: DeleteAccountFormProps) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(initialState.error);

  async function handleAction(
    prevState: DeleteAccountActionState,
    formData: FormData,
  ) {
    const nextState = await action(prevState, formData);
    setError(nextState.error);
    return nextState;
  }

  const [, formAction] = useActionState(handleAction, initialState);
  const canDelete = confirmation === ACCOUNT_DELETE_CONFIRMATION;

  return (
    <form action={formAction} className="account-delete__form" noValidate>
      <label>
        <span>確認テキスト</span>
        <input
          aria-describedby={error ? "account-delete-error" : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          name="confirmation"
          onChange={(event) => {
            setConfirmation(event.target.value);
            if (error) {
              setError("");
            }
          }}
          placeholder={ACCOUNT_DELETE_CONFIRMATION}
          required
          value={confirmation}
        />
      </label>

      {error ? (
        <p className="field-error" id="account-delete-error" role="alert">
          {error}
        </p>
      ) : null}

      <SubmitButton enabled={canDelete} />
    </form>
  );
}
