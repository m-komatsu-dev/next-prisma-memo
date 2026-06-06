# SECURITY_REPORT

作成日: 2026-06-04

## 見つけた問題

- モバイル refresh token のローテーションが、読み取り後に `ApiSession.id` だけで更新されており、同時実行時に古い refresh token の再利用を検出しにくい状態でした。
- モバイル refresh token が盗まれた場合に、ローテーション済み token の再利用を token family 単位で全失効する仕組みがありませんでした。
- `logServerError` が Error message / stack / Prisma meta をそのまま記録しており、例外内容によっては Bearer token、DB URL、API key などがログに混ざる余地がありました。
- Auth のランタイム設定ログが本番環境で自動出力され、秘密値は出ていないものの、DB ホストなどの環境情報が不要に出力される状態でした。
- `/api/mobile/*` の CORS で `Access-Control-Allow-Credentials: true` を返していました。許可 origin は限定されていましたが、Bearer token API には不要な設定でした。
- `.env.production` や `mobile/.env.production` などの env 派生ファイルを明示的に ignore していませんでした。
- 安全な `.env.example` / `mobile/.env.example` がなく、README の手順だけに依存していました。
- `next.config.ts` に基本的なセキュリティヘッダーがありませんでした。
- `/api/cron/send-todo-reminders?secret=...` 形式の Cron 認証が許可されており、secret が URL ログや履歴に残りやすい状態でした。
- テストで無効・期限切れ Bearer token、refresh token replay、ログの秘密情報 redaction の確認が不足していました。

## 修正した問題

- `lib/mobile-auth.ts`
  - refresh token を `refreshTokenId.secret` 形式へ変更し、`refreshTokenId` で `ApiSession` を引いて現在の `refreshTokenHash` と照合するようにしました。
  - `tokenFamilyId` を追加し、reuse、失効済み session、期限切れ session、rotation 競合を検知した場合は同じ `tokenFamilyId` の `ApiSession` をすべて `revokedAt` 付きで失効します。
  - 直前の旧形式 refresh token hash を `previousRefreshTokenHash` として保持し、移行直後に旧形式 token が再利用された場合も family 失効できるようにしました。
  - refresh token 更新を `updateMany` に変更し、`id`、現在の `refreshTokenHash`、未失効、未期限切れを同時に満たす場合だけローテーションするようにしました。
  - reuse detection 時は `mobile_refresh_token_reuse_detected` の監査ログを出します。ログには token、secret、Authorization header、DB URL を出さず、family は SHA-256 の短い fingerprint のみを記録します。
  - 古い refresh token の replay や競合で更新できなかった場合は `null` を返し、API 側で詳細理由を伏せた 401 になります。

- `prisma/schema.prisma` / migrations
  - `ApiSession` に `tokenFamilyId`、`refreshTokenId`、`previousRefreshTokenHash` を追加しました。
  - `tokenFamilyId` と `revokedAt` に index を追加し、family 単位の全失効と active 判定を効率化しました。

- `app/api/mobile/auth/refresh/route.ts`
  - refresh 失敗時の 401 レスポンスを「再ログインしてください」という固定文言にし、reuse / 期限切れ / 失効済みの詳細を返さないようにしました。

- `lib/server-errors.ts`
  - Authorization header、token、secret、password、API key、DB URL などをサーバーログから redaction する処理を追加しました。
  - Error message、stack、Prisma meta、context details の全てに redaction を適用しました。

- `auth.ts`
  - Auth ランタイム設定ログを `AUTH_DEBUG=true` の時だけ出すように変更しました。

- `lib/mobile-cors.ts`
  - モバイル API の CORS から不要な `Access-Control-Allow-Credentials` を削除しました。

- `next.config.ts`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: DENY`
  - `Permissions-Policy`
  - production のみ `Strict-Transport-Security`
  を追加しました。

- `.gitignore` / `mobile/.gitignore`
  - `.env.*` を ignore しつつ、`.env.example` と `.env.test.example` は追跡できるようにしました。
  - `mobile/.env.*` も明示的に ignore しました。

- `.env.example` / `mobile/.env.example`
  - 秘密情報を含まないダミー値だけの env サンプルを追加しました。
  - Todo リマインダー Cron 用の `CRON_SECRET` ダミー値を追加しました。

- `app/api/cron/send-todo-reminders/route.ts`
  - Cron 認証を `Authorization: Bearer <CRON_SECRET>` と `x-cron-secret: <CRON_SECRET>` header のみにしました。
  - URL query の `?secret=...` は認証に使わず、query secret のみのリクエストは 401 になります。
  - `CRON_SECRET` 未設定時は安全側に倒し、Cron 処理を実行せず 401 を返します。

- テスト
  - 無効な Bearer token が `/api/mobile/posts` で 401 になることを追加確認しました。
  - 期限切れ Bearer token が 401 になり、DB セッション検索まで進まないことを追加確認しました。
  - 有効な Bearer token でも active な `ApiSession` が必要なことを追加確認しました。
  - 正常な refresh で新しい access token / refresh token が返ることを確認しました。
  - refresh token replay 時に 401 になり、同じ token family の `ApiSession` が全失効することを追加確認しました。
  - family 全失効後は同じ family の refresh token が使えないことを確認しました。
  - family 全失効後は該当 access token でも mobile API にアクセスできないことを確認しました。
  - logout 済み session と期限切れ refresh token では refresh できないことを確認しました。
  - reuse detection のログ・レスポンスに token / secret が出ないことを確認しました。
  - モバイル用の post readable 条件が owner / shared のみに絞られていることを追加確認しました。
  - サーバーログから token / DB URL が redaction されることを追加確認しました。
  - Cron が正しい `Authorization` header と `x-cron-secret` header でのみ成功し、secret なし、誤った secret、query secret のみ、`CRON_SECRET` 未設定時は 401 になることを確認しました。

## 確認した認可・入力検証の状況

- Web のメモ削除・公開切替は `authorId` 条件付きの `deleteMany` / `updateMany` で保護されています。
- Web の詳細・編集は `getReadablePostWhere` / `getEditablePostWhere` を使い、URL の ID 書き換えで権限外データを取得・編集しない構造です。
- Todo の作成・更新・削除は、先に編集可能な Post を確認し、`todoItem.id` と `postId` の両方で操作しています。
- 共有設定は Post owner のみが変更できるよう、`post.authorId` 条件で `PostShare` を更新・削除しています。
- モバイル API は Bearer token または有効な Web session からユーザーを解決し、Post / Todo / Share 操作でも owner / shared / editor 条件を使っています。
- Zod により、メモ、タグ、Todo、日付、AI 入力、refresh token、push token の形式・長さ検証が Prisma 実行前に行われています。
- Gemini API key は `lib/ai-content.ts` のサーバー側 `process.env.GEMINI_API_KEY` からのみ使用され、クライアント・モバイル側には露出していません。

## 修正しなかったが今後やるべき問題

- Rate limit / brute force 対策
  - Credentials login、mobile login、AI API、refresh API に IP・ユーザー単位の rate limit を追加するとより安全です。

- CSRF の追加防御
  - Server Actions と Auth.js の基本防御に依存しています。高リスク操作には intent token や再認証を追加するとさらに堅くできます。

- Tag の所有者モデル
  - 現在 `Tag` はグローバル unique name です。現状 API は認可済み Post 経由でしかタグを返さないため直接漏洩は見つけていませんが、タグ自体を個人データとして厳密に扱うなら `userId` を持たせる設計変更が望ましいです。

- CSP
  - `Content-Security-Policy-Report-Only` を段階導入しました。強制ブロックはまだ有効化していません。内容と移行手順は `CSP_REPORT.md` にまとめています。

- DB Row Level Security
  - Prisma 側の認可チェックで保護しています。PostgreSQL RLS を導入すると防御層は増えますが、設計・運用変更が大きいため未対応です。

## 実行した確認コマンド

- `git ls-files .env .env.local .env.production .env.test mobile/.env mobile/.env.local .env.example .env.test.example mobile/.env.example README.md mobile/README.md`
  - 実 `.env` / `mobile/.env` は Git 追跡対象ではありませんでした。

- `git grep -l -E "(AIza|postgresql://|DATABASE_URL=|DATABASE_URL\"|AUTH_SECRET=|GEMINI_API_KEY=|AUTH_GOOGLE_SECRET=|AUTH_GITHUB_SECRET=|GOOGLE_CLIENT_SECRET|GITHUB_SECRET|EXPO_ACCESS_TOKEN)"`
  - README、CI、設定コードなどにダミー値・変数名・サンプルのみ検出されました。実秘密情報のコミットは確認されませんでした。

- `git grep -l -E "NEXT_PUBLIC_.*(SECRET|TOKEN|KEY|PASSWORD|DATABASE|GEMINI|AUTH)"`
  - 該当なし。

- `git check-ignore -v .env mobile/.env .env.production mobile/.env.production .env.example mobile/.env.example`
  - 実 env は ignore、example は追跡可能であることを確認しました。

- `npm run test`
  - 14 files / 92 tests passed.

- `npm run lint`
  - passed.

- `npm run build`
  - passed.

- `npm run test:e2e`
  - 5 tests passed.
  - sandbox 内では WebServer の `0.0.0.0:3000` listen が `EPERM` で失敗したため、承認後に再実行して成功しました。

- `npm audit --audit-level=high`
  - 初回はネットワーク制限で失敗。ネットワーク許可後に再実行し、`found 0 vulnerabilities`。

## 残っているリスク

- `published` なメモは Web 側でログインユーザーに読める設計です。ポートフォリオで「完全な個人メモ」を強調するなら、公開機能の意味を明確にするか無効化を検討してください。
- Server Actions の一部はエラーを UI に返しますが、今回の範囲では安全な固定文言または Zod メッセージに留めています。今後も Prisma / stack / env 詳細を返さない方針を維持してください。
- `.env` は Git 追跡されていませんが、ローカルには存在します。GitHub へ push する前に `git status --short` と `git ls-files .env mobile/.env` を再確認してください。
- モバイル API で Web session fallback も許可しています。既存機能を壊さないため残しましたが、Bearer 専用に分離するとさらに明確です。

## 次にやるべき改善案

1. mobile login / credentials login / AI API に rate limit を追加する。
2. refresh token reuse detection の監査ログを本番のログ基盤でアラート化する。
3. タグをユーザー所有モデルにするか、タグ API を追加する場合は必ず `userId` スコープにする。
4. 本番・previewのCSPレポートを確認し、問題がなければ `Content-Security-Policy` へ切り替える。
5. 重要操作に再認証または確認用 nonce を追加する。
