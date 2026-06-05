# My Memo App

Next.js App Router + Prisma + PostgreSQLで構築したメモ/Todo管理アプリです。Web版に加えて、同じNext.js APIと同じPostgreSQLを利用するExpo / React Nativeのモバイル版も実装しています。

## デモ

| 項目 | URL / 場所 |
| --- | --- |
| Web App | https://next-prisma-memo.vercel.app |
| Repository | https://github.com/m-komatsu-dev/next-prisma-memo |
| Mobile App | [`mobile/`](mobile/) 配下のExpoアプリ |

## アプリ概要

My Memo Appは、日々のアイデア、学習メモ、TodoをWebとモバイルの両方から管理できるアプリです。ユーザーはメモの作成・編集・削除、タグ付け、公開/非公開切り替え、Todo管理、共有権限の設定を行えます。

AI機能ではGoogle Gemini APIをサーバー側から呼び出し、タイトル生成、タグ生成、要約、リライトなどを補助します。Gemini APIキーはクライアントやモバイルアプリに渡さず、Next.js API側でのみ利用します。

## 主な機能

- メールアドレス + パスワードによる登録・ログイン
- Google / GitHub OAuthログイン
- メモの作成、一覧表示、詳細表示、編集、削除
- 公開/非公開ステータス管理
- タグ管理
- Markdown風チェックボックスからのTodo表示・編集
- 期限付きTodo、Todo横断一覧、カレンダー表示
- メモ一覧の検索、フィルター、並び替え
- 作成/編集画面での自動保存
- メールアドレス指定によるメモ共有
- owner / editor / viewerの権限制御
- Gemini APIを使ったAI補助
- Web版・モバイル版のアカウント削除
- Expo Push Token登録とTodoリマインダー送信API
- Vitest、Playwright、ESLint、Next.js buildによる品質確認

## Web版とモバイル版の違い

| 項目 | Web版 | モバイル版 |
| --- | --- | --- |
| UI | Next.js / React | Expo / React Native |
| 認証 | Auth.js / NextAuth | access token + refresh token |
| OAuth | Google / GitHub対応 | 未対応 |
| API利用 | Server Actions中心 | `/api/mobile/*` のJSON API |
| 対象データ | 自分のメモ、共有メモ、公開メモ | 自分のメモ、共有メモ |
| AI機能 | 編集画面・詳細画面から利用 | AI Assistantパネルから利用 |
| Token保存 | Auth.js Cookie | Expo SecureStore |
| 配布 | Vercel | Expo Go / EAS Build内部配布 |

モバイル版はNext.js側の `/api/mobile/*` をJSON APIとして利用します。Web版とモバイル版で同じPostgreSQLのUser / Post / TodoItem / PostShareを扱うため、Webで作成したメモをモバイルから確認できます。

## 使用技術

| 領域 | 技術 |
| --- | --- |
| Web | Next.js App Router, React, TypeScript |
| Mobile | Expo, React Native, TypeScript |
| Backend | Next.js Route Handlers, Server Actions |
| Database | PostgreSQL |
| ORM | Prisma ORM, Prisma PostgreSQL adapter |
| Auth | Auth.js / NextAuth, JWT, refresh token |
| Validation | Zod |
| Password | bcrypt |
| AI | Google Gemini API, `@google/genai` |
| Mobile Storage | Expo SecureStore |
| Deploy | Vercel |
| Test | Vitest, Playwright |
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
  -> /api/mobile/posts/[id]
  -> /api/mobile/posts/[id]/todos
  -> /api/mobile/posts/[id]/shares
  -> /api/mobile/ai/generate
  -> Prisma / Gemini API
```

## セキュリティ対策

- Zodで入力値の形式・長さを検証し、不正な値をPrisma実行前に弾く
- bcryptでパスワードをハッシュ化して保存する
- Web版はAuth.js / NextAuth、モバイル版は短期access token + 長期refresh tokenで認証を分離する
- refresh tokenは平文保存せず、SHA-256ハッシュとしてDBへ保存する
- refresh token rotationにより、古いrefresh tokenの再利用を401にする
- owner / editor / viewerの権限をサーバー側で判定し、UI表示だけに依存しない
- メモ削除・公開切り替え・Todo操作は `authorId` や `postId` 条件付きで実行する
- Gemini APIキーはサーバー側環境変数からのみ利用する
- TodoリマインダーCronは `Authorization: Bearer <CRON_SECRET>` または `x-cron-secret` headerで認証する
- Authorization header、token、secret、DB URLなどをログ出力時にredactionする
- CORSの許可originを環境変数で制御する
- `X-Content-Type-Options`、`Referrer-Policy`、`X-Frame-Options`、production HSTSなどの基本ヘッダーを設定する

詳細は [SECURITY_REPORT.md](SECURITY_REPORT.md) を参照してください。

## パフォーマンス改善

- メモ一覧とTodo一覧に `take` とURL limitを追加し、初期表示で全件取得しない
- 一覧用Prisma `select` を詳細/編集用と分離し、必要なフィールドだけ取得する
- 長文本文は一覧ではプレビューに切り詰め、詳細画面で全文を取得する
- Todoプレビューや共有ロール取得件数を制限する
- Web一覧に「もっと見る」を追加し、必要な場合だけ取得上限を増やす
- モバイルAPIにもlimitを渡し、アプリ状態に保持する初期データ量を抑える
- 検索・集計処理を小さな配列とmemoized/deferredな計算に寄せる
- Prisma schemaに `authorId`、`updatedAt`、`dueAt`、`reminderAt` などの検索・並び替え用indexを設定する

詳細は [PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md) を参照してください。

## テスト

| コマンド | 内容 |
| --- | --- |
| `npm run test` | Vitest単体テスト |
| `npm run lint` | ESLint |
| `npm run build` | Next.js本番ビルド |
| `npm run test:e2e` | Playwright E2Eテスト |
| `npm run test:e2e:ui` | Playwright UIモード |
| `npm run test:e2e:headed` | ブラウザ表示ありのPlaywright E2Eテスト |
| `npm audit --audit-level=high` | high以上の脆弱性チェック |

Vitestでは、権限判定、Zodスキーマ、Todo変換、AIモード、モバイル認証、サーバーエラー処理などを確認しています。Playwrightでは、未ログイン時の保護ページリダイレクト、ログイン、メモ一覧、通常メモ作成、Todo作成、詳細表示、編集、削除、ログアウトのWebユーザーフローを検証します。

Playwright E2Eをローカルで実行する場合は、本番ではないPostgreSQLを `DATABASE_URL` に設定し、`.env.test` にテスト用ユーザーを指定します。`E2E_TEST_EMAIL` は誤削除防止のため `e2e-` を含めてください。E2Eのglobal setupがユーザーを作成し、global teardownがユーザーと `e2e-` prefixのテストデータを削除します。

```env
E2E_TEST_EMAIL="e2e-user@example.invalid"
E2E_TEST_PASSWORD="replace-with-a-local-test-password"
```

初回またはブラウザ未インストール環境では、先にPlaywrightのChromiumを入れてください。

```bash
npx playwright install chromium
npm run test:e2e
```

詳細は [E2E_REPORT.md](E2E_REPORT.md) を参照してください。

## スクリーンショット

実画像は [`docs/screenshots/`](docs/screenshots/) に配置する想定です。まだ画像がない場合でも、提出前に撮影すべき画面は [docs/screenshots/README.md](docs/screenshots/README.md) に整理しています。

推奨スクリーンショット:

- トップページ / ログイン画面
- メモ一覧
- メモ詳細
- メモ作成・編集
- Todo作成
- Todo詳細 / Todo一覧
- カレンダー
- 共有設定
- AI Assistant
- モバイル版一覧
- モバイル版詳細

## ローカル起動方法

### 1. 前提

- Node.js LTS
- npm
- PostgreSQL
- Google / GitHubログインを使う場合は各OAuthアプリ
- AI機能を使う場合はGemini APIキー
- モバイル版を確認する場合はExpo GoまたはiOS/Androidシミュレーター

### 2. リポジトリ取得

```bash
git clone https://github.com/m-komatsu-dev/next-prisma-memo.git
cd next-prisma-memo
```

### 3. 依存関係のインストール

```bash
npm install
```

モバイル版も使う場合:

```bash
cd mobile
npm install
cd ..
```

### 4. 環境変数の設定

ルートの `.env.example` を参考に、プロジェクトルートへ `.env` を作成します。実際の値はREADME、レポート、GitHubには書かず、ローカルまたはデプロイ先の環境変数として管理してください。

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"

MOBILE_AUTH_SECRET="replace-with-a-long-random-mobile-secret"
DATABASE_POOL_MAX="5"
CRON_SECRET="replace-with-a-long-random-cron-secret"
EXPO_ACCESS_TOKEN="optional-expo-server-access-token"
ENABLE_PUSH_TEST_API="false"

AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"

GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"

E2E_TEST_EMAIL="e2e-user@example.invalid"
E2E_TEST_PASSWORD="replace-with-a-local-test-password"
```

モバイル版をローカルAPIへ接続する場合は、`mobile/.env.example` を参考に `mobile/.env` を作成します。

```env
EXPO_PUBLIC_API_BASE_URL="http://localhost:3000"
```

実機でExpo Goから接続する場合、`localhost` ではなくPCのLAN IPを指定してください。EAS Buildの内部配布では `mobile/eas.json` の `EXPO_PUBLIC_API_BASE_URL` を使います。詳しくは [mobile/README.md](mobile/README.md) と [ENVIRONMENT.md](ENVIRONMENT.md) を参照してください。

### 5. Prisma Client生成とDB同期

```bash
npm run db:generate
npm run db:push
```

マイグレーションを作成しながら開発する場合:

```bash
npm run db:migrate
```

### 6. Web版起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

### 7. モバイル版起動

```bash
cd mobile
npm run start
```

Expo Goまたはシミュレーターで確認します。

## 環境変数

| 変数 | 必須 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | 必須 | PostgreSQL接続文字列 |
| `AUTH_SECRET` | 必須 | Auth.js / NextAuthの署名 |
| `AUTH_URL` | 必須 | ローカルは `http://localhost:3000`。本番はoriginのみ |
| `AUTH_TRUST_HOST` | 必須 | Auth.jsのhostを信頼 |
| `MOBILE_AUTH_SECRET` | 推奨 | モバイルBearer Tokenの署名 |
| `DATABASE_POOL_MAX` | 任意 | PostgreSQL接続プール上限 |
| `CRON_SECRET` | TodoリマインダーCron利用時 | `/api/cron/*` のheader認証用secret |
| `EXPO_ACCESS_TOKEN` | 任意 | Expo Push APIのサーバー認証。mobileには置かない |
| `ENABLE_PUSH_TEST_API` | 任意 | productionで `/api/mobile/push-subscriptions/test` を有効化する場合のみ `true` |
| `AUTH_GOOGLE_ID` | OAuth利用時 | Google OAuth |
| `AUTH_GOOGLE_SECRET` | OAuth利用時 | Google OAuth |
| `AUTH_GITHUB_ID` | OAuth利用時 | GitHub OAuth |
| `AUTH_GITHUB_SECRET` | OAuth利用時 | GitHub OAuth |
| `GEMINI_API_KEY` | AI利用時 | Gemini API |
| `GEMINI_MODEL` | 任意 | 利用するGeminiモデル |
| `EXPO_PUBLIC_API_BASE_URL` | Mobile利用時 | Expoアプリの接続先API URL |
| `E2E_TEST_EMAIL` | E2E実行時 | Playwrightが作成・削除するテストユーザー。`e2e-` を含める |
| `E2E_TEST_PASSWORD` | E2E実行時 | Playwrightテストユーザーのパスワード |

`.env`、`.env.test`、`mobile/.env`、`mobile/.env.local` は秘密情報やローカル環境の接続先を含むためコミットしないでください。`EXPO_PUBLIC_` で始まる値はアプリに埋め込まれる公開値なので、APIキーやトークンは入れないでください。

## TodoリマインダーCron

Todoリマインダー送信は `GET /api/cron/send-todo-reminders` で実行します。TodoItemの `reminderAt` が期限到来し、`completed=false` かつ `reminderSentAt=null` のものをExpo Push Token登録済み端末へ送信します。`reminderAt` 未指定で `dueAt` が未来の場合は、作成/更新時に原則として期限1時間前が設定されます。送信後は `reminderSentAt` を更新するため、同じTodoへ重複送信しません。

`CRON_SECRET` が未設定の場合、Cron処理は実行されず401になります。

認証はheaderのみ許可します。

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://your-production-origin.example/api/cron/send-todo-reminders
```

または:

```bash
curl -H "x-cron-secret: <CRON_SECRET>" \
  https://your-production-origin.example/api/cron/send-todo-reminders
```

`/api/cron/send-todo-reminders?secret=...` のようなquery secret方式は使わないでください。query secretのみのリクエストは401になります。

Vercel Cronは `vercel.json` にqueryなしのpathだけを設定します。

```json
{
  "crons": [
    {
      "path": "/api/cron/send-todo-reminders",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Vercelで `CRON_SECRET` 環境変数を設定すると、Cron実行時に `Authorization: Bearer <CRON_SECRET>` headerとして送られます。

## 通知と共有通知

モバイルアプリはログイン後に通知許可を求め、Expo Push Tokenを `/api/mobile/push-subscriptions` へBearer token付きで登録します。Push Tokenはログイン中ユーザーにだけ紐づき、レスポンスやログにはtoken本体を出しません。ログアウト時は端末で保持しているPush Tokenを同APIのDELETEでrevokeします。

メモ共有時は `PostShare` 作成/更新に合わせて `Notification` レコードを作成します。共有されたユーザーは `/api/mobile/notifications` で自分宛ての通知一覧を取得できます。現時点の共有通知はアプリ内通知の土台で、Push送信はTodoリマインダー側に限定しています。

## 関連ドキュメント

- [ENVIRONMENT.md](ENVIRONMENT.md): ローカル/本番の環境変数設定
- [mobile/README.md](mobile/README.md): Expoアプリの起動方法、EAS Build、モバイルAPI
- [EAS_BUILD_REPORT.md](EAS_BUILD_REPORT.md): EAS Build内部配布設定と確認結果
- [docs/screenshots/README.md](docs/screenshots/README.md): スクリーンショット撮影リスト
- [SECURITY_REPORT.md](SECURITY_REPORT.md): セキュリティ確認と残課題
- [PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md): パフォーマンス改善内容
- [REFACTOR_REPORT.md](REFACTOR_REPORT.md): 責務分割とリファクタリング内容

## 面接で説明しやすいポイント

### 工夫した点

Web版はServer Actions中心、モバイル版はRoute HandlersによるJSON API中心に分け、同じDBと同じ権限モデルを利用できるようにしました。WebとモバイルでUIは違っても、Post / TodoItem / PostShareの扱いは共通化し、実サービスに近い構成にしています。

### 苦労した点

認証方式がWebとモバイルで異なるため、NextAuthのセッションとモバイルBearer tokenの両方で同じユーザー権限を安全に判定する必要がありました。特に共有メモでは、owner / editor / viewerごとに閲覧・編集・削除・共有設定の可否が変わるため、UIだけでなくサーバー側でも条件を揃えるよう意識しました。

### セキュリティで意識した点

秘密情報をクライアントへ渡さないこと、refresh tokenを平文保存しないこと、入力検証をZodで行うこと、権限チェックをDB操作条件に含めることを重視しました。また、ログにtokenやDB URLが混ざらないようredaction処理も入れています。

### Web版とモバイル版を同じDBで使えるようにした点

モバイルアプリは独立したDBを持たず、Next.jsの `/api/mobile/*` を通してWeb版と同じPostgreSQLへアクセスします。そのため、Webで作成したメモやTodoをモバイルで確認でき、共有権限も同じルールで扱えます。

### AI機能とTodo機能

AI機能はGemini APIをNext.jsサーバー側から呼び出し、タイトル生成、タグ生成、要約、リライトを支援します。Todo機能はメモ本文のチェックボックス表現に加え、`TodoItem` テーブルで期限、完了状態、リマインダー情報を管理できるようにしています。

## 今後の改善予定

- Playwright E2EテストのCI組み込み
- モバイル版Google / GitHubログイン
- mobile login、credentials login、AI APIへのrate limit追加
- refresh token reuse detectionとtoken family全失効
- 本番ドメイン確定後のCSP段階導入
- iOS内部配布とストア提出フローの整備
- 画像添付、共有通知、検索インデックス強化
