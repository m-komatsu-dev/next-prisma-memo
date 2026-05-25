"use client";

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

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="account-delete__submit"
      disabled={pending}
      type="submit"
    >
      {pending ? "削除中..." : "本当に削除する"}
    </button>
  );
}

export function DeleteAccountForm({
  action,
  initialState,
}: DeleteAccountFormProps) {
  const [error, setError] = useState(initialState.error);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [finalStep, setFinalStep] = useState(false);

  async function handleAction(
    prevState: DeleteAccountActionState,
    formData: FormData,
  ) {
    const nextState = await action(prevState, formData);
    setError(nextState.error);
    if (nextState.error) {
      setDialogOpen(false);
      setFinalStep(false);
    }
    return nextState;
  }

  const [, formAction] = useActionState(handleAction, initialState);

  return (
    <>
      {error ? (
        <p className="field-error" id="account-delete-error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        aria-describedby={error ? "account-delete-error" : undefined}
        className="account-delete__open"
        onClick={() => {
          setError("");
          setDialogOpen(true);
          setFinalStep(false);
        }}
        type="button"
      >
        アカウントを削除
      </button>

      {dialogOpen ? (
        <div className="account-delete-dialog-backdrop">
          <div
            aria-labelledby="account-delete-dialog-title"
            aria-modal="true"
            className="account-delete-dialog"
            role="dialog"
          >
            <div className="account-delete-dialog__header">
              <p className="account-delete__kicker">Danger zone</p>
              <h2 id="account-delete-dialog-title">
                {finalStep
                  ? "本当に削除しますか？"
                  : "アカウントを削除しますか？"}
              </h2>
            </div>

            <p>
              この操作は取り消せません。アカウント、ログイン連携、
              セッション、作成したメモが削除されます。
            </p>
            {finalStep ? (
              <p className="account-delete-dialog__warning">
                削除を実行するとログアウトされ、トップページへ戻ります。
              </p>
            ) : null}

            {finalStep ? (
              <form action={formAction} className="account-delete__form">
                <input name="confirmed" type="hidden" value="true" />
                <div className="account-delete-dialog__actions">
                  <button
                    className="account-delete-dialog__cancel"
                    onClick={() => setFinalStep(false)}
                    type="button"
                  >
                    戻る
                  </button>
                  <SubmitButton />
                </div>
              </form>
            ) : (
              <div className="account-delete-dialog__actions">
                <button
                  className="account-delete-dialog__cancel"
                  onClick={() => {
                    setDialogOpen(false);
                    setFinalStep(false);
                  }}
                  type="button"
                >
                  キャンセル
                </button>
                <button
                  className="account-delete__submit"
                  onClick={() => setFinalStep(true)}
                  type="button"
                >
                  アカウントを削除
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
