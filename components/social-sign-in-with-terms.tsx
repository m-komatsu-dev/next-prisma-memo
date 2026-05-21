"use client";

import { TermsModal } from "@/components/terms-modal";
import { LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

export type SocialSignInActionState = {
  formError: string;
};

type SocialSignInWithTermsProps = {
  githubAction: (
    prevState: SocialSignInActionState,
    formData: FormData
  ) => Promise<SocialSignInActionState>;
  googleAction: (
    prevState: SocialSignInActionState,
    formData: FormData
  ) => Promise<SocialSignInActionState>;
  initialState: SocialSignInActionState;
};

export function SocialSignInWithTerms({
  githubAction,
  googleAction,
  initialState,
}: SocialSignInWithTermsProps) {
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
    <div className="social-sign-in-with-terms">
      {formError ? (
        <p className="form-alert" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="terms-consent social-terms-consent">
        <div className="terms-checkbox">
          <input
            checked={termsAccepted}
            id="homeSocialTermsAccepted"
            onChange={(event) => setTermsAccepted(event.target.checked)}
            required
            type="checkbox"
          />
          <span>
            <TermsModal />
            <label htmlFor="homeSocialTermsAccepted">
              およびAI利用に関する特約に同意する
            </label>
          </span>
        </div>
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
