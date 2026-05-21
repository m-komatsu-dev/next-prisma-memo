"use client";

import { TermsModal } from "@/components/terms-modal";
import { Eye, EyeOff, LoaderCircle, Lock, Mail, User } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

export type RegisterActionState = {
  formError: string;
  fieldErrors?: {
    name?: string;
    email?: string;
    password?: string;
    termsAccepted?: string;
  };
};

type RegisterFormProps = {
  action: (
    prevState: RegisterActionState,
    formData: FormData
  ) => Promise<RegisterActionState>;
  initialState: RegisterActionState;
};

type RegisterValues = {
  name: string;
  email: string;
  password: string;
  termsAccepted: boolean;
};

type RegisterTextField = "name" | "email" | "password";
type TouchedFields = Partial<Record<keyof RegisterValues, boolean>>;//このコードは、ユーザー登録フォームの実装です。ユーザーが入力した値を管理し、バリデーションエラーを表示するためのロジックが含まれています。また、パスワードの表示/非表示を切り替える機能も実装されています。

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getFieldErrors(values: RegisterValues) {
  return {
    name: values.name.trim() ? "" : "ユーザー名を入力してください。",
    email:
      values.email.length === 0 || emailPattern.test(values.email)
        ? ""
        : "メールアドレスの形式が正しくありません。",
    password:
      values.password.length === 0 || values.password.length >= 8
        ? ""
        : "パスワードは8文字以上で入力してください。",
  };
}

export function RegisterForm({ action, initialState }: RegisterFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [values, setValues] = useState<RegisterValues>({
    name: "",
    email: "",
    password: "",
    termsAccepted: false,
  });
  const [touched, setTouched] = useState<TouchedFields>({});

  const fieldErrors = useMemo(() => getFieldErrors(values), [values]);

  const visibleErrors = {
    name: touched.name ? fieldErrors.name : state.fieldErrors?.name,
    email: touched.email ? fieldErrors.email : state.fieldErrors?.email,
    password: touched.password
      ? fieldErrors.password
      : state.fieldErrors?.password,
    termsAccepted: touched.termsAccepted
      ? values.termsAccepted
        ? ""
        : "利用規約への同意が必要です。"
      : state.fieldErrors?.termsAccepted,
  };

  function updateValue(field: RegisterTextField, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
    setTouched((current) => ({
      ...current,
      [field]: true,
    }));
  }

  function updateTermsAccepted(value: boolean) {
    setValues((current) => ({
      ...current,
      termsAccepted: value,
    }));
    setTouched((current) => ({
      ...current,
      termsAccepted: true,
    }));
  }

  return (
    <form action={formAction} className="register-form" noValidate>
      {state.formError ? (
        <p className="form-alert" role="alert">
          {state.formError}
        </p>
      ) : null}

      <label className="form-field">
        <span>ユーザー名</span>
        <div className="input-shell">
          <User aria-hidden="true" size={18} />
          <input
            aria-describedby={visibleErrors.name ? "name-error" : undefined}
            aria-invalid={Boolean(visibleErrors.name)}
            autoComplete="name"
            name="name"
            onBlur={() => setTouched((current) => ({ ...current, name: true }))}
            onChange={(event) => updateValue("name", event.target.value)}
            placeholder="山田 太郎"
            required
            value={values.name}
          />
        </div>
        {visibleErrors.name ? (
          <span className="field-error" id="name-error" role="status">
            {visibleErrors.name}
          </span>
        ) : null}
      </label>

      <label className="form-field">
        <span>メールアドレス</span>
        <div className="input-shell">
          <Mail aria-hidden="true" size={18} />
          <input
            aria-describedby={visibleErrors.email ? "email-error" : undefined}
            aria-invalid={Boolean(visibleErrors.email)}
            autoComplete="email"
            inputMode="email"
            name="email"
            onBlur={() =>
              setTouched((current) => ({ ...current, email: true }))
            }
            onChange={(event) => updateValue("email", event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={values.email}
          />
        </div>
        {visibleErrors.email ? (
          <span className="field-error" id="email-error" role="status">
            {visibleErrors.email}
          </span>
        ) : null}
      </label>

      <label className="form-field">
        <span>パスワード</span>
        <div className="input-shell">
          <Lock aria-hidden="true" size={18} />
          <input
            aria-describedby={
              visibleErrors.password ? "password-error" : "password-hint"
            }
            aria-invalid={Boolean(visibleErrors.password)}
            autoComplete="new-password"
            minLength={8}
            name="password"
            onBlur={() =>
              setTouched((current) => ({ ...current, password: true }))
            }
            onChange={(event) => updateValue("password", event.target.value)}
            placeholder="8文字以上"
            required
            type={showPassword ? "text" : "password"}
            value={values.password}
          />
          <button
            aria-label={showPassword ? "パスワードを非表示" : "パスワードを表示"}
            className="password-toggle"
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" size={18} />
            ) : (
              <Eye aria-hidden="true" size={18} />
            )}
          </button>
        </div>
        {visibleErrors.password ? (
          <span className="field-error" id="password-error" role="status">
            {visibleErrors.password}
          </span>
        ) : (
          <span className="field-hint" id="password-hint">
            8文字以上で設定してください。
          </span>
        )}
      </label>

      <div className="terms-consent">
        <div className="terms-checkbox">
          <input
            aria-describedby={
              visibleErrors.termsAccepted ? "terms-error" : "terms-hint"
            }
            aria-invalid={Boolean(visibleErrors.termsAccepted)}
            checked={values.termsAccepted}
            id="termsAccepted"
            name="termsAccepted"
            onBlur={() =>
              setTouched((current) => ({ ...current, termsAccepted: true }))
            }
            onChange={(event) => updateTermsAccepted(event.target.checked)}
            required
            type="checkbox"
          />
          <span>
            <TermsModal />
            <label htmlFor="termsAccepted">に同意します</label>
          </span>
        </div>
        {visibleErrors.termsAccepted ? (
          <span className="field-error" id="terms-error" role="status">
            {visibleErrors.termsAccepted}
          </span>
        ) : (
          <span className="field-hint" id="terms-hint">
            登録には利用規約への同意が必要です。
          </span>
        )}
      </div>

      <RegisterSubmitButton canSubmit={values.termsAccepted} />
    </form>
  );
}

function RegisterSubmitButton({ canSubmit }: { canSubmit: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="button button-primary register-submit"
      disabled={pending || !canSubmit}
      type="submit"
    >
      {pending ? (
        <>
          <LoaderCircle aria-hidden="true" className="spinner" size={18} />
          登録中
        </>
      ) : (
        "アカウントを作成"
      )}
    </button>
  );
}
