# My Memo App

Next.js App Router + Prisma + PostgreSQLで構築したメモ/Todo管理アプリです。Web版とExpo / React Nativeのモバイル版を実装し、同じNext.js APIと同じDBを使ってメモ、Todo、共有、通知を扱います。

## デモ

| 項目 | URL / 場所 |
| --- | --- |
| Web App | https://next-prisma-memo.vercel.app |
| Repository | https://github.com/m-komatsu-dev/next-prisma-memo |
| Mobile App | [`mobile/`](mobile/) 配下のExpoアプリ |

## ポートフォリオ向け要約

My Memo Appは、個人メモ、期限付きTodo、共有メモ、通知をWebとモバイルの両方から管理できるアプリです。WebはServer Actions中心、モバイルは `/api/mobile/*` のJSON API中心に分け、同じPostgreSQL上のデータと同じ権限モデルを利用します。

実装では、Web版のAuth.jsセッションとモバイル版のBearer Token認証を併存させ、owner / editor / viewerの認可、refresh token rotation、refresh token family revocation、CSP Report-Only、rate limit、ログのredactionを入れています。

## 実装済み機能

### Web

- メールアドレス + パスワードによる登録・ログイン
- Google / GitHub OAuthログイン
- メモCRUD: 作成、一覧、詳細、編集、削除
- 公開/非公開ステータス管理
- タグ管理、タグ検索、本文検索
- Todo作成・編集・完了切り替え・削除
- 期限付きTodo、全Todo一覧、Todo検索、Todoカレンダー
- Markdown風チェックボックスの表示・編集
- メモ一覧の検索、フィルター、並び替え
- 作成/編集画面での自動保存
- メールアドレス指定による共有
- owner / editor / viewerの共有権限制御
- 通知一覧、未読件数表示、単体既読、全既読
- Gemini APIを使ったタイトル生成、タグ生成、要約、リライト
- アカウント削除

### Mobile

- Expo / React Nativeアプリ
- メールアドレス + パスワードログイン
- モバイルBearer Token認証
- access token + refresh tokenの保存
- Google / GitHubの外部ブラウザOAuth
- Deep Link経由のOAuth callback
- メモ一覧、詳細、作成、編集、削除
- タグ検索、本文検索、Todo検索
- Todo一覧、期限付きTodo、全Todo一覧、カレンダーAPI
- 共有メモの閲覧、共有設定API
- 通知タブ、通知一覧、未読管理、pull-to-refresh
- Expo Push Token登録、ログアウト時revoke
- アカウント削除

### Push通知

- モバイルログイン後にExpo Push Tokenを登録します。
- TodoItemの `reminderAt` が期限到来し、未完了かつ未送信の場合に、Cron APIからExpo Push通知を送信します。
- Push送信後は `reminderSentAt` を更新し、同じTodoへの重複送信を防ぎます。
- 共有通知はアプリ内通知として実装済みです。現時点でPush送信対象はTodoリマインダーです。

## 技術スタック

| 領域 | 技術 |
| --- | --- |
| Web | Next.js App Router, React, TypeScript |
| Mobile | Expo, React Native, TypeScript |
| Backend | Next.js Route Handlers, Server Actions |
| Database | PostgreSQL |
| ORM | Prisma ORM, Prisma PostgreSQL adapter |
| Auth | Auth.js / NextAuth, JWT, mobile access token / refresh token |
| Validation | Zod |
| Password | bcrypt |
| AI | Google Gemini API, `@google/genai` |
| Push | Expo Notifications |
| Mobile Storage | Expo SecureStore |
| Deploy | Vercel, EAS Build |
| Test | Vitest, Playwright |
| CI | GitHub Actions |
| Package Manager | npm |

## アーキテクチャ

```text
Web Browser
  -> Next.js App Router
  -> Auth.js / NextAuth
  -> Server Actions / Route Handlers
  -> Prisma
  -> PostgreSQL

Expo Mobile App
  -> /api/mobile/auth/login
  -> /api/mobile/auth/refresh
  -> Authorization: Bearer <accessToken>
  -> /api/mobile/posts
  -> /api/mobile/todos
  -> /api/mobile/notifications
  -> /api/mobile/push-subscriptions
  -> Prisma / PostgreSQL
```

## セキュリティ対策

- Zodで入力値の形式・長さを検証し、不正な値をPrisma実行前に拒否します。
- bcryptでパスワードをハッシュ化して保存します。
- Web版はAuth.js / NextAuth、モバイル版は短期access token + 長期refresh tokenで認証を分離しています。
- refresh tokenは平文保存せず、SHA-256ハッシュとしてDBへ保存します。
- refresh token rotationにより、古いrefresh tokenの再利用を拒否します。
- refresh token reuse、失効済みsession、期限切れsession、rotation競合を検知した場合、同じtoken familyを全失効します。
- owner / editor / viewerの権限をサーバー側で判定し、UI表示だけに依存しません。
- メモ、Todo、共有、通知の更新は `userId`、`authorId`、`postId` などの条件付きで実行します。
- Credentials login、mobile login、mobile refresh、AI generation、CSP report APIにrate limitを入れています。
- Gemini APIキー、Cron secret、Expo Push API用tokenはサーバー側環境変数からのみ利用します。
- TodoリマインダーCronは `Authorization: Bearer <CRON_SECRET>` または `x-cron-secret` headerで認証します。
- Authorization header、token、secret、DB URLなどをログ出力時にredactionします。
- CORSの許可originを環境変数で制御します。
- `X-Content-Type-Options`、`Referrer-Policy`、`X-Frame-Options`、production HSTSなどの基本ヘッダーを設定しています。
- `Content-Security-Policy-Report-Only` を導入済みです。強制ブロックは本番ログ確認後に切り替える方針です。

詳細は [SECURITY_REPORT.md](./SECURITY_REPORT.md) と [CSP_REPORT.md](./CSP_REPORT.md) を参照してください。

## テスト・CI

| 種別 | 内容 |
| --- | --- |
| Unit test | Vitestで権限判定、Zodスキーマ、Todo変換、AIモード、モバイル認証、通知、CSPなどを確認 |
| E2E | Playwrightで未ログインリダイレクト、ログイン、メモCRUD、Todo作成、ログアウトを確認 |
| Lint | ESLint |
| Build | Next.js production build |
| Audit | ルートは `npm audit --audit-level=high` でhigh以上を確認 |
| Mobile check | `npm install` と `npx expo-doctor` |
| CI | GitHub Actionsでlint、unit test、build、migration deploy、Playwright E2E、mobile typecheckを実行 |

今回の確認結果:

- `npm run test`: 22 files / 140 tests passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:e2e`: sandbox内のlisten制限で初回失敗、権限付き再実行で 5 tests passed.
- `npm audit --audit-level=high`: 初回はネットワーク制限で失敗、権限付き再実行で `found 0 vulnerabilities`.
- `cd mobile && npm install`: up to date.
- `cd mobile && npx expo-doctor`: 初回はネットワーク制限で失敗、権限付き再実行で 18/18 checks passed.
- `cd mobile && npm audit`: Expo依存由来のmoderate warningあり。`npm audit fix --force` はExpoのbreaking changeを伴うため、別ブランチで検証予定です。

Playwright E2Eをローカルで実行する場合は、本番ではないDBと、`e2e-` を含むテストユーザーを `.env.test` に設定してください。E2Eのglobal setupがユーザーを作成し、global teardownがテストデータを削除します。

## モバイルOAuth

モバイルGoogle/GitHubログインはアプリ内WebViewではなく、Expo WebBrowserによる外部ブラウザで行います。

1. モバイルアプリが `/api/mobile/oauth/start?provider=google|github` を開きます。
2. Auth.jsがGoogle/GitHubログインを完了します。
3. `/mobile/oauth/complete` が短命のone-time codeを発行します。
4. `mymemo://auth/callback?code=...` でアプリへ戻ります。
5. アプリが `/api/mobile/oauth/exchange` にcodeを送り、mobile access token / refresh tokenを受け取ります。

one-time codeの生値はDBに保存せず、SHA-256ハッシュのみ保存します。詳細は [MOBILE_OAUTH_REPORT.md](./MOBILE_OAUTH_REPORT.md) を参照してください。

## 未確認事項

- EAS Build無料枠の都合により、production buildの実機最終確認は次回ビルド枠で実施予定です。
- iOS/Android実機でのGoogle/GitHub外部ブラウザOAuth、Deep Link復帰、SecureStore保存の最終確認。
- iOS/Android実機でのPush通知受信、通知タップ後の遷移、既読化、Push Token再登録/revokeの最終確認。
- 本番Vercel上でのCSP violationレポート内容。
- Googleログイン、GitHubログイン、モバイルOAuth、通知、検索、AI生成、mobile API、PushSubscription処理でCSP追加許可が必要かどうか。
- mobile側npm audit moderate warningの修正方針。`npm audit fix --force` はbreaking changeを伴うため別ブランチで検証予定です。

## ローカル起動方法

### 前提

- Node.js LTS
- npm
- PostgreSQL
- Google / GitHubログインを使う場合は各OAuthアプリ
- AI機能を使う場合はGemini APIキー
- モバイル版を確認する場合はExpo GoまたはiOS/Androidシミュレーター

### セットアップ

```bash
git clone https://github.com/m-komatsu-dev/next-prisma-memo.git
cd next-prisma-memo
npm install
npm run db:generate
npm run db:push
```

モバイル版も使う場合:

```bash
cd mobile
npm install
cd ..
```

環境変数は `.env.example`、`.env.test.example`、`mobile/.env.example` を参考に設定します。README、レポート、GitHubには実際のsecret、token、DB URL、個人情報を書かず、ローカルまたはデプロイ先の環境変数として管理してください。

Web版起動:

```bash
npm run dev
```

モバイル版起動:

```bash
cd mobile
npm run start
```

## 主要環境変数

| 変数 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL接続 |
| `AUTH_SECRET` | Auth.js / NextAuthの署名 |
| `AUTH_URL` | Webアプリのorigin |
| `AUTH_TRUST_HOST` | Auth.jsのhost信頼設定 |
| `MOBILE_AUTH_SECRET` | モバイルBearer Tokenの署名 |
| `CRON_SECRET` | TodoリマインダーCronのheader認証 |
| `EXPO_ACCESS_TOKEN` | Expo Push APIのサーバー認証。mobileには置かない |
| `ENABLE_PUSH_TEST_API` | productionでテスト通知APIを有効化する場合のみ使用 |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini API |
| `EXPO_PUBLIC_API_BASE_URL` | Expoアプリの接続先API URL |
| `EXPO_PUBLIC_MOBILE_OAUTH_CALLBACK_URL` | モバイルOAuth Deep Link |
| `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` | Playwright E2E用テストユーザー |

`.env`、`.env.test`、`mobile/.env`、`mobile/.env.local` はコミットしないでください。`EXPO_PUBLIC_` で始まる値はアプリに埋め込まれる公開値なので、APIキーやtokenは入れないでください。

## 関連ドキュメント

- [SECURITY_REPORT.md](./SECURITY_REPORT.md): セキュリティ対策、確認済み項目、残リスク
- [MOBILE_OAUTH_REPORT.md](./MOBILE_OAUTH_REPORT.md): モバイルGoogle/GitHub OAuth
- [CSP_REPORT.md](./CSP_REPORT.md): CSP Report-Only導入状況
- [RATE_LIMIT_REPORT.md](./RATE_LIMIT_REPORT.md): Rate limit実装
- [NOTIFICATION_REPORT.md](./NOTIFICATION_REPORT.md): Push通知、通知一覧、既読管理
- [E2E_REPORT.md](./E2E_REPORT.md): Playwright E2E
- [EAS_BUILD_REPORT.md](./EAS_BUILD_REPORT.md): EAS Build内部配布設定と確認結果
- [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md): パフォーマンス改善
- [REFACTOR_REPORT.md](./REFACTOR_REPORT.md): 責務分割とリファクタリング

## 面接で説明しやすいポイント

Web版とモバイル版で認証方式が異なるため、NextAuth sessionとモバイルBearer tokenの両方で同じユーザー権限を安全に判定する必要がありました。特に共有メモではowner / editor / viewerごとに閲覧・編集・削除・共有設定の可否が変わるため、UIだけでなくサーバー側でも条件を揃えています。

refresh tokenは平文保存せず、rotationとfamily revocationを実装しました。古いrefresh tokenの再利用やrotation競合を検知した場合は、同じtoken familyを全失効し、レスポンスには詳細理由を返さないようにしています。

通知は、TodoリマインダーのPush通知と、共有時のアプリ内通知を分けて実装しています。Push Tokenはログイン中ユーザーにだけ紐づけ、ログアウト時にrevokeします。

CSPは既存のログイン、OAuth、モバイルOAuth、通知、検索、AI生成を壊さないよう、まずReport-Onlyで導入しました。レポートAPIには入力サイズ制限、形式検証、rate limit、ログredactionを入れています。
