# Mobile OAuth

モバイル版では、メール / password ログインに加えて Google / GitHub ログインを扱います。OAuth 画面は Expo WebBrowser で外部ブラウザとして開きます。

Web の Auth.js session を mobile API にそのまま使わず、OAuth 完了後に短命の code を発行し、`/api/mobile/oauth/exchange` で mobile access token / refresh token に交換します。

## Flow

1. アプリが `/api/mobile/oauth/start?provider=google|github` を開く。
2. Auth.js が Google / GitHub ログインを処理する。
3. 認証後に `/mobile/oauth/complete` へ戻る。
4. `/mobile/oauth/complete` が短命の code を発行する。
5. `mymemo://auth/callback?code=...` でアプリへ戻る。
6. アプリが code を `/api/mobile/oauth/exchange` に送る。
7. API が access token / refresh token を返す。
8. アプリは token を SecureStore に保存し、以後の mobile API で Bearer token を使う。

## Security

- code の生値は DB に保存せず、ハッシュ化して保存します。
- code は短命で、交換後は再利用できません。
- 無効、期限切れ、使用済み code は拒否します。
- mobile refresh token は平文保存せず、ハッシュ化して保存します。
- refresh token rotation と token family revocation を使います。
- mobile 側に server secret、DB URL、API token は置きません。

## Required Config

Next.js 側:

- `AUTH_URL`
- `AUTH_SECRET`
- `MOBILE_AUTH_SECRET`
- `MOBILE_OAUTH_CALLBACK_URL`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`

Mobile 側:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_MOBILE_OAUTH_CALLBACK_URL`

`EXPO_PUBLIC_` で始まる値はアプリに埋め込まれます。secret、token、DB URL、個人情報は入れません。

## Provider Callback

OAuth provider console には Auth.js の callback URL を登録します。

```text
https://<web-origin>/api/auth/callback/google
https://<web-origin>/api/auth/callback/github
```

Deep Link は provider callback の後に Web 側で処理するため、provider console には直接登録しません。

## Related API

- `/api/mobile/oauth/start`
- `/mobile/oauth/complete`
- `/api/mobile/oauth/exchange`
- `/api/mobile/auth/refresh`
- `/api/mobile/auth/logout`
