# Mobile OAuth Report

作成日: 2026-06-06

## 要約

モバイル版では、メール/パスワードログインに加えてGoogle/GitHubログインを実装しています。OAuth画面はアプリ内WebViewではなくExpo WebBrowserで外部ブラウザとして開き、Auth.jsでプロバイダ認証を完了したあと、Deep LinkでExpoアプリへ戻します。

Web版のAuth.jsセッションをそのままモバイルに流用せず、OAuth完了後に短命のone-time codeを発行し、`/api/mobile/oauth/exchange` でmobile access token / refresh tokenへ交換します。モバイルAPIは以後 `Authorization: Bearer <accessToken>` で利用します。

## 実装済みフロー

1. モバイルアプリが外部ブラウザで `/api/mobile/oauth/start?provider=google|github` を開きます。
2. Auth.js / NextAuthがGoogleまたはGitHubログインを処理します。
3. 認証完了後、Web側の `/mobile/oauth/complete` へ戻ります。
4. `/mobile/oauth/complete` が短命のone-time codeを発行します。
5. Web側が `mymemo://auth/callback?code=...` へリダイレクトし、Expoアプリへ戻します。
6. モバイルアプリがcodeを `/api/mobile/oauth/exchange` にPOSTします。
7. APIがmobile access token / refresh tokenを返し、アプリはSecureStoreへ保存します。
8. 以後のmobile APIはBearer Tokenで認証します。

## セキュリティ設計

- one-time codeの生値はDBに保存せず、SHA-256ハッシュのみ保存します。
- one-time codeは短命で、交換後は再利用できません。
- 無効、期限切れ、使用済みcodeは拒否します。
- mobile refresh tokenは平文保存せず、SHA-256ハッシュで保存します。
- refresh token rotationとtoken family revocationを実装しています。
- OAuth完了後のmobile APIはWeb CookieではなくBearer Tokenで利用します。
- mobile側の環境変数にはserver secret、DB URL、API tokenを置きません。

## 必要な設定

Next.js側:

- `AUTH_URL`
- `AUTH_SECRET`
- `MOBILE_AUTH_SECRET`
- `MOBILE_OAUTH_CALLBACK_URL`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`

Mobile側:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_MOBILE_OAUTH_CALLBACK_URL`

`EXPO_PUBLIC_` で始まる値はアプリに埋め込まれる公開値です。secret、token、DB URL、個人情報は入れないでください。

## Provider Redirect URL

Google/GitHubのOAuth provider consoleには、Auth.jsのWeb callback URLを設定します。

- Google: Web App origin + `/api/auth/callback/google`
- GitHub: Web App origin + `/api/auth/callback/github`

モバイルDeep LinkはAuth.jsのprovider callback後にWeb側で処理するため、provider consoleには直接登録しません。

## 確認済み項目

- `/api/mobile/oauth/start` がproviderを受け取り、Auth.js OAuthへ接続すること。
- `/mobile/oauth/complete` が短命のone-time codeを作成し、Deep Linkへリダイレクトすること。
- `/api/mobile/oauth/exchange` が有効なcodeをmobile access token / refresh tokenへ交換すること。
- one-time codeの再利用、期限切れ、不正値を拒否すること。
- OAuth関連のunit testが `npm run test` に含まれ、今回 22 files / 140 tests passed.
- `npm run build` で `/api/mobile/oauth/start`、`/api/mobile/oauth/exchange`、`/mobile/oauth/complete` がproduction buildに含まれること。
- `cd mobile && npx expo-doctor` で 18/18 checks passed.

## EAS Build無料枠のため実機最終確認待ち

EAS Build無料枠の都合により、production buildの実機最終確認は次回ビルド枠で実施予定です。コードパス、unit test、build、expo-doctorでは確認済みですが、最終署名済みbuildでのネイティブDeep Link挙動は実機で確認します。

確認予定:

- iOS/Android実機でGoogleログインが外部ブラウザから開始できること。
- iOS/Android実機でGitHubログインが外部ブラウザから開始できること。
- provider認証後に `mymemo://auth/callback` でアプリへ戻れること。
- one-time code交換後、メモ一覧へ遷移できること。
- access token / refresh tokenがSecureStoreに保存され、アプリ再起動後もrefreshできること。
- ログアウト時にtokenとPush Tokenのrevoke処理が期待通り動くこと。

## 関連API

- `/api/mobile/oauth/start`
- `/mobile/oauth/complete`
- `/api/mobile/oauth/exchange`
- `/api/mobile/auth/refresh`
- `/api/mobile/auth/logout`
