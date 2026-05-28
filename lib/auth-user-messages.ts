export const oauthAccountNotLinkedMessage =
  "このメールアドレスは別のログイン方法で登録されています。先に登録時と同じ方法でログインしてください。";

export function getAuthErrorMessage(error: unknown) {
  const errorCode = Array.isArray(error) ? error[0] : error;

  if (typeof errorCode !== "string") {
    return "";
  }

  if (errorCode === "OAuthAccountNotLinked") {
    return oauthAccountNotLinkedMessage;
  }

  if (errorCode === "CallbackRouteError" || errorCode === "OAuthCallbackError") {
    return "外部アカウントの認証に失敗しました。時間をおいて再度お試しください。";
  }

  if (errorCode === "Configuration") {
    return "認証設定に問題があります。管理者にお問い合わせください。";
  }

  return "";
}

export function getOAuthProviderConfigurationMessage(provider: "github" | "google") {
  const providerName = provider === "google" ? "Google" : "GitHub";

  return `${providerName}ログインの設定が未完了です。管理者にお問い合わせください。`;
}
