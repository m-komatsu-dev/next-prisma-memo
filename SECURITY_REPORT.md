# Security

Web は Auth.js / NextAuth、mobile は Bearer token で認証します。どちらも同じ PostgreSQL のメモ、Todo、共有、通知を扱うため、権限判定はサーバー側に置いています。

## Current Controls

- 入力値は Zod で検証します。
- password は bcrypt でハッシュ化して保存します。
- mobile refresh token は平文保存せず、ハッシュ化して保存します。
- refresh token は rotation し、reuse や競合を検知した場合は同じ token family を失効します。
- 認証、AI 生成、CSP report API には rate limit を入れています。
- Cron は header の `CRON_SECRET` で認証します。
- mobile API の CORS は許可 origin を制御し、不要な credentials 許可は返しません。
- server log では Authorization header、token、secret、password、API key、DB URL を伏せます。
- `Content-Security-Policy-Report-Only` を導入しています。
- 基本 header として `X-Content-Type-Options`、`Referrer-Policy`、`X-Frame-Options`、`Permissions-Policy`、production HSTS を設定しています。

## Authorization

- Web のメモ削除、公開切替は `authorId` 条件付きの `deleteMany` / `updateMany` で処理します。
- Web の詳細 / 編集は `getReadablePostWhere` / `getEditablePostWhere` を使います。
- Todo の作成 / 更新 / 削除は、先に編集可能な Post を確認し、`todoItem.id` と `postId` の両方を条件にします。
- 共有設定は Post owner のみが変更できます。
- mobile API は Bearer token または有効な Web session からユーザーを解決し、Post / Todo / Share 操作でも owner / shared / editor 条件を使います。
- Gemini API key は `lib/ai-content.ts` のサーバー側環境変数からだけ参照します。

## Mobile Tokens

`ApiSession` は `tokenFamilyId`、`refreshTokenId`、`refreshTokenHash`、`previousRefreshTokenHash` を持ちます。

refresh 時は現在の hash、未失効、未期限切れを同時に満たす session だけを更新します。古い refresh token の再利用、失効済み session、期限切れ session、rotation 競合を検知した場合は、同じ token family を失効します。

API の 401 レスポンスでは、reuse / 期限切れ / 失効済みなどの詳細理由を返しません。

## Cron

Todo reminder Cron は query secret を使いません。

```text
Authorization: Bearer <CRON_SECRET>
x-cron-secret: <CRON_SECRET>
```

`CRON_SECRET` が未設定の場合は実行せず 401 を返します。

## Files And Env

- `.env`、`.env.test`、`.env.production`、`mobile/.env`、`mobile/.env.local` は Git に入れません。
- `.env.example`、`.env.test.example`、`mobile/.env.example` はダミー値だけを置きます。
- mobile 側には `EXPO_PUBLIC_` 以外の secret を置きません。

## Related Notes

- [RATE_LIMIT_REPORT.md](RATE_LIMIT_REPORT.md)
- [CSP_REPORT.md](CSP_REPORT.md)
- [NOTIFICATION_REPORT.md](NOTIFICATION_REPORT.md)
- [MOBILE_OAUTH_REPORT.md](MOBILE_OAUTH_REPORT.md)

## Remaining Work

- rate limit を本番向けに Redis などの外部ストアへ移す。
- 重要操作に再認証または確認用 nonce を追加する。
- `Tag` をユーザー所有モデルにするか、タグ API を追加する場合は `userId` scope を徹底する。
- CSP report-only の結果を確認し、問題がなければ enforce に移す。
- mobile API の Web session fallback を残すか、Bearer 専用に分けるかを整理する。
- Expo 依存由来の npm audit warning は、破壊的更新の影響を確認してから対応する。

## Notes

`published` なメモは Web 側でログインユーザーが読める仕様です。完全に private なメモだけを扱う設計にする場合は、公開機能を無効化するか、公開の意味を UI と API の両方で見直します。
