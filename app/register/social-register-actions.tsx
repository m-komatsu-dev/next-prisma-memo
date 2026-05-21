"use client";

import { TermsModal } from "@/components/terms-modal";
import { LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

export type SocialRegisterActionState = {
  formError: string;
};

type SocialRegisterActionsProps = {
  githubAction: (
    prevState: SocialRegisterActionState,
    formData: FormData
  ) => Promise<SocialRegisterActionState>;
  googleAction: (
    prevState: SocialRegisterActionState,
    formData: FormData
  ) => Promise<SocialRegisterActionState>;
  initialState: SocialRegisterActionState;
};

export function SocialRegisterActions({
  githubAction,
  googleAction,
  initialState,
}: SocialRegisterActionsProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [googleState, googleFormAction] = useActionState(
    googleAction,
    initialState,
  );
  const [githubState, githubFormAction] = useActionState(
    githubAction,
    initialState,
  );
  const formError = googleState.formError || githubState.formError;

  return (
    <div className="social-register">
      {formError ? (
        <p className="form-alert" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="terms-consent social-terms-consent">
        <div className="terms-checkbox">
          <input
            checked={termsAccepted}
            id="socialTermsAccepted"
            onChange={(event) => setTermsAccepted(event.target.checked)}
            required
            type="checkbox"
          />
          <span>
            <TermsModal />
            <label htmlFor="socialTermsAccepted">に同意します</label>
          </span>
        </div>
        <span className="field-hint">
          外部アカウントで登録する場合も同意が必要です。
        </span>
      </div>

      <div className="social-actions">
        <form action={googleFormAction}>
          <input
            name="termsAccepted"
            type="hidden"
            value={termsAccepted ? "on" : ""}
          />
          <SocialButton
            disabled={!termsAccepted}
            icon="G"
            label="Googleでログイン"
          />
        </form>

        <form action={githubFormAction}>
          <input
            name="termsAccepted"
            type="hidden"
            value={termsAccepted ? "on" : ""}
          />
          <SocialButton
            dark
            disabled={!termsAccepted}
            icon="GH"
            label="GitHubでログイン"
          />
        </form>
      </div>
    </div>
  );
}

function SocialButton({
  dark = false,
  disabled,
  icon,
  label,
}: {
  dark?: boolean;
  disabled: boolean;
  icon: string;
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={`button button-social${dark ? " button-social-dark" : ""}`}
      disabled={disabled || pending}
      type="submit"
    >
      <span className="provider-icon" aria-hidden="true">
        {pending ? <LoaderCircle className="spinner" size={16} /> : icon}
      </span>
      {pending ? "接続中" : label}
    </button>
  );
}
