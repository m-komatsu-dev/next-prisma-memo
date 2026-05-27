# My Memo App

Next.js App Router + Prisma + PostgreSQLで構築したメモアプリです。Web版に加えて、同じバックエンドAPIを利用するExpo / React Nativeのモバイル版も実装しています。

メモの作成・編集だけでなく、タグ管理、検索、共有権限、AI補助、アカウント削除、Web / Mobileの認証方式の分離まで含めた、フルスタック構成のポートフォリオです。

## デモURL

- Web App: https://todo-text-memo.vercel.app
- Repository: https://github.com/m-komatsu-dev/next-prisma-memo
- Mobile App: `mobile/` 配下のExpoアプリとして実装

## アプリ概要

My Memo Appは、日々のメモやTodoをWebとモバイルの両方から扱えるメモ管理アプリです。

ユーザーはメモを作成し、公開/非公開、タグ、Todo形式、共有相手の権限を管理できます。AI機能ではGemini APIをサーバー側から呼び出し、タイトル生成、タグ生成、要約、リライトなどを補助します。

モバイル版はNext.js側の `/api/mobile/*` を利用するクライアントとして実装しており、Web版と同じPostgreSQLのデータを扱います。

## 主な機能

- メールアドレス + パスワードによるユーザー登録・ログイン
- Google / GitHub OAuthログイン
- メモの作成、詳細表示、編集、削除
- 公開/非公開ステータス管理
- タグ管理
- Markdown風のチェックボックスTodoメモ
- メモ一覧の検索、フィルター、並び替え
- 作成/編集画面での自動保存
- 特定ユーザーへのメモ共有
- owner / editor / viewerによる権限制御
- Gemini APIを使ったAI補助
- Web版・モバイル版のアカウント削除
- Vitest、Playwright、GitHub Actionsによる品質チェック

## Web版の機能

- Next.js App RouterによるWeb UI
- Auth.js / NextAuthによる認証
- Credentials、Google、GitHubログイン
- すべて/自分のメモ/共有されたメモ/公開/非公開の表示切り替え
- カード表示/リスト表示の切り替え
- タイトル、本文、タグでの検索
- 更新日順、作成日順、タイトル順の並び替え
- メモ詳細画面でのAI要約表示
- 編集画面でのAIタイトル生成、タグ生成、要約、リライト
- メールアドレス指定による共有相手の追加
- viewer / editorの共有権限変更
- 共有解除
- アカウント設定画面からのアカウント削除

## モバイル版の機能

- Expo + React Native + TypeScript
- メールアドレス + パスワードログイン
- Bearer Token認証
- Expo SecureStoreへのアクセストークン保存
- 自分のメモと共有されたメモの一覧・詳細表示
- メモの作成、編集、削除
- Todo形式メモの表示・編集
- 検索、フィルター、並び替え
- 共有メモのviewer / editorバッジ表示
- 権限に応じた編集・削除・共有設定ボタンの表示制御
- ownerによる共有相手の追加、権限変更、共有解除
- AI Assistantによるタイトル生成、タグ生成、要約、リライト、改善案、次のアイデア生成
- アカウント削除

モバイル版のGoogle / GitHubログイン、refresh token、EAS Build、ストア配布は未実装です。

## 技術スタック

| 領域 | 技術 |
| --- | --- |
| Web | Next.js App Router, React, TypeScript |
| Mobile | Expo, React Native, TypeScript |
| Backend | Next.js Route Handlers, Server Actions |
| Database | PostgreSQL |
| ORM | Prisma ORM, Prisma PostgreSQL adapter |
| Auth | Auth.js / NextAuth, JWT, Bearer Token |
| Validation | Zod |
| Password | bcrypt |
| AI | Google Gemini API, `@google/genai` |
| Mobile Storage | Expo SecureStore |
| Deploy | Vercel |
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
  -> Authorization: Bearer <accessToken>
  -> /api/mobile/posts
  -> /api/mobile/posts/[id]
  -> /api/mobile/posts/[id]/shares
  -> /api/mobile/ai/generate
  -> Prisma / Gemini API
```

Web版は画面表示と更新処理にServer Actionsを利用し、モバイル版はNext.js側のRoute HandlersをJSON APIとして利用します。

メモ、ユーザー、タグ、共有権限はPrismaで管理しています。

## 認証方式

### Web版

- Auth.js / NextAuthを利用
- Credentialsログイン
- Google OAuth
- GitHub OAuth
- Prisma Adapterでユーザー、OAuthアカウント情報をDBに保存
- セッションはJWT strategy
- セッション有効期限は現在7日

### モバイル版

- `/api/mobile/auth/login` にメールアドレスとパスワードを送信
- bcryptでパスワードを検証
- 成功時にHS256署名のモバイル用アクセストークンを発行
- 以降のAPIで `Authorization: Bearer <accessToken>` を付与
- トークンはExpo SecureStoreへ保存
- アクセストークンの有効期限は現在12時間

`MOBILE_AUTH_SECRET` が未設定の場合、モバイル用Bearer Tokenの署名にも `AUTH_SECRET` を使います。refresh token / ApiSessionは未実装です。

## Web版とモバイル版の違い

| 項目 | Web版 | モバイル版 |
| --- | --- | --- |
| UI | Next.js / React | Expo / React Native |
| 認証 | Auth.js / NextAuth | 独自Bearer Token |
| OAuth | Google / GitHub対応 | 未対応 |
| API利用 | Server Actions中心 | `/api/mobile/*` のJSON API |
| 公開メモ | 自分のメモ、共有メモ、公開メモを扱う | 自分のメモと共有メモを扱う |
| AI機能 | 編集画面・詳細画面から利用 | AI Assistantパネルから利用 |
| 配布 | Vercel | 現在はExpo Goでの確認を想定 |

## API設計

モバイル版は次のAPIを利用します。すべてNext.js Route Handlersで実装しています。

| Method | Path | 内容 |
| --- | --- | --- |
| `POST` | `/api/mobile/auth/login` | メールアドレス + パスワードでログイン |
| `GET` | `/api/mobile/posts` | 自分のメモと共有メモの一覧取得 |
| `POST` | `/api/mobile/posts` | メモ作成 |
| `GET` | `/api/mobile/posts/[id]` | メモ詳細取得 |
| `PATCH` | `/api/mobile/posts/[id]` | メモ更新 |
| `DELETE` | `/api/mobile/posts/[id]` | メモ削除 |
| `GET` | `/api/mobile/posts/[id]/shares` | 共有一覧取得 |
| `POST` | `/api/mobile/posts/[id]/shares` | 共有相手追加 |
| `PATCH` | `/api/mobile/posts/[id]/shares/[shareId]` | 共有権限変更 |
| `DELETE` | `/api/mobile/posts/[id]/shares/[shareId]` | 共有解除 |
| `POST` | `/api/mobile/ai/generate` | AI生成 |
| `DELETE` | `/api/mobile/account` | アカウント削除 |

入力値はZodで検証し、メモ閲覧・編集・削除・共有設定の権限はサーバー側で判定します。UI上のボタン表示だけに依存しない設計にしています。

## AI機能

AI機能はGoogle Gemini APIを利用しています。APIキーはサーバー側の環境変数として保持し、Webブラウザやモバイルアプリへは渡しません。

実装済みのAIモード:

- `summarize`: メモ本文の要約
- `title`: タイトル生成
- `tags`: タグ生成
- `rewrite`: 読みやすい文章へのリライト

GeminiのレスポンスはJSON schemaを指定して受け取り、サーバー側で必要な文字列だけを抽出します。

## 共有機能

共有機能は `PostShare` テーブルで実装しています。メモ作成者はメールアドレスで共有相手を指定し、viewer / editorの権限を付与できます。

| Role | 閲覧 | 編集 | 削除 | 共有設定変更 |
| --- | --- | --- | --- | --- |
| owner | 可能 | 可能 | 可能 | 可能 |
| editor | 可能 | 可能 | 不可 | 不可 |
| viewer | 可能 | 不可 | 不可 | 不可 |

存在しないメールアドレス、自分自身への共有、不正な共有IDはエラーになります。非公開メモはownerまたは明示的に共有されたユーザーだけがアクセスできます。

## アカウント削除機能

Web版とモバイル版の両方にアカウント削除機能を実装しています。

- Web版: アカウント設定画面から削除
- モバイル版: アカウント画面の確認ダイアログから削除
- 削除後はログアウト状態に遷移
- ユーザー、ログイン連携、セッション、作成したメモなどの関連データを削除

削除確認はダイアログで行います。`DELETE` 文字列の入力方式は実装していません。

## テスト構成

### Vitest

```bash
npm run test
```

`vitest.config.ts` で `tests/unit/**/*.test.ts` を対象にしています。権限判定、Zodスキーマ、Todo変換、AIモードなど、UIに依存しないロジックをテストしています。

### Playwright

```bash
npm run test:e2e
```

`playwright.config.ts` でWeb版のE2Eテストを定義しています。`webServer` で `npm run dev` を起動し、登録、ログイン、メモ作成、編集、削除、ログアウトなどのユーザーフローをブラウザ上で検証します。

Playwrightの補助コマンド:

```bash
npm run test:e2e:ui
npm run test:e2e:headed
```

### GitHub Actions

`.github/workflows/ci.yml` でpull requestと手動実行のCIを設定しています。

CIで実行しているチェック:

- `npm run lint`
- `npm run test`
- `npm run build`
- `mobile/` で `npm run typecheck`

Playwright E2E用のscriptはありますが、現在のCIにはまだ組み込んでいません。

## セットアップ方法

### 1. 前提

- Node.js LTS
- npm
- PostgreSQL
- Google / GitHubログインを使う場合は各OAuthアプリ
- AI機能を使う場合はGemini APIキー

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

プロジェクトルートに `.env` を作成します。秘密情報はREADMEやGitHubに書かず、ローカルまたはデプロイ先の環境変数として管理します。

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
AUTH_SECRET="long-random-secret"
AUTH_TRUST_HOST="true"

MOBILE_AUTH_SECRET="long-random-mobile-secret"
DATABASE_POOL_MAX="5"

GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_ID="your-github-client-id"
GITHUB_SECRET="your-github-client-secret"

GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"
```

モバイル版をローカルAPIへ接続する場合は `mobile/.env` にAPI URLを設定します。

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

詳しくは [mobile/README.md](mobile/README.md) を参照してください。

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

## 主なコマンド

| Command | 内容 |
| --- | --- |
| `npm run dev` | Web開発サーバー起動 |
| `npm run lint` | ESLint |
| `npm run test` | Vitest単体テスト |
| `npm run test:e2e` | Playwright E2Eテスト |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番ビルド起動 |
| `npm run db:generate` | Prisma Client生成 |
| `npm run db:push` | schemaをDBへ反映 |
| `npm run db:migrate` | migration作成 |
| `npm run db:seed` | seed実行 |

## 環境変数

| 変数 | 必須 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | 必須 | PostgreSQL接続文字列 |
| `AUTH_SECRET` | 必須 | Auth.js / NextAuthの署名 |
| `AUTH_TRUST_HOST` | 本番推奨 | VercelなどでAuth.jsのhostを信頼 |
| `MOBILE_AUTH_SECRET` | 推奨 | モバイルBearer Tokenの署名 |
| `DATABASE_POOL_MAX` | 任意 | PostgreSQL接続プール上限 |
| `GOOGLE_CLIENT_ID` | OAuth利用時 | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | OAuth利用時 | Google OAuth |
| `GITHUB_ID` | OAuth利用時 | GitHub OAuth |
| `GITHUB_SECRET` | OAuth利用時 | GitHub OAuth |
| `GEMINI_API_KEY` | AI利用時 | Gemini API |
| `GEMINI_MODEL` | 任意 | 利用するGeminiモデル |
| `EXPO_PUBLIC_API_BASE_URL` | Mobile利用時 | Expoアプリの接続先API URL |

`.env`、`.env.test`、`mobile/.env` は秘密情報やローカル環境の接続先を含むため、コミットしないでください。

## 本番デプロイ時の注意

Web/APIはVercelへのデプロイを想定しています。

### `DATABASE_URL`

- 本番用PostgreSQLの接続文字列を設定します。
- 開発用DBやE2Eテスト用DBと共有しないでください。
- Prisma migrationを本番DBへ適用する運用を決めてからデプロイします。
- 接続数が増える場合は `DATABASE_POOL_MAX` も確認します。

### `AUTH_SECRET`

- 十分に長いランダムな値を設定します。
- ローカル用の値を本番へ流用しないでください。
- 変更すると既存セッションや署名済みトークンの検証に影響します。
- `MOBILE_AUTH_SECRET` を設定しない場合、モバイル用Bearer Tokenの署名にも使われます。

Vercelでは `.env` ファイルをアップロードするのではなく、DashboardのEnvironment Variablesに値を設定します。Google / GitHub OAuthを使う場合は、本番URLのcallback URLも各OAuthアプリ側に設定します。

## ポートフォリオとしての見どころ

- Next.js App Routerで画面、Server Actions、Route Handlersをまとめたフルスタック構成
- Web版とモバイル版で同じDB・ドメインロジックを共有する設計
- WebはNextAuth、モバイルはBearer Tokenという利用環境に合わせた認証分離
- `/api/mobile/*` によるモバイル専用API設計
- Prisma + PostgreSQLでユーザー、メモ、タグ、共有権限を管理
- owner / editor / viewerの権限モデルとサーバー側権限チェック
- Gemini APIキーをクライアントに出さないAI連携
- Zodによる入力検証とテストしやすいドメインロジック
- Vitest / Playwright / GitHub Actionsを組み合わせた品質チェック
- アカウント削除や共有解除など、実サービスで必要になりやすい退会・権限管理フロー

## 今後の改善予定

- Playwright E2EテストのCI組み込み
- モバイル版Google / GitHubログイン
- refresh token / ApiSessionによるモバイル認証の強化
- EAS Buildによる配布フロー整備
- カレンダー表示
- リマインダー
- メモの画像添付
- 共有通知
