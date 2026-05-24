# My Memo App

Next.js App Router + TypeScript、Prisma + PostgreSQL、Auth.js / NextAuth、React Native / Expo で構成したフルスタックのメモアプリです。

Web版とモバイル版の両方で、メモの一覧・詳細・作成・編集・削除、タグ、Todo形式の本文、自動保存、AI支援機能を利用できます。Web版はGoogle/GitHubログインにも対応し、モバイル版は現在メールアドレス + パスワードログインとBearer Token認証で `/api/mobile/*` を利用します。

## Demo

- App URL: https://todo-text-memo.vercel.app
- GitHub: https://github.com/m-komatsu-dev/next-prisma-memo

## 主な機能

- メモのCRUD
- タグの登録・表示
- Todo形式のメモ本文
- 公開/非公開設定
- Web版とモバイル版の両対応
- 入力内容の自動保存
- AIによるタイトル生成、タグ生成、要約、リライト、アイデア生成
- Zodによる入力検証
- Vercelデプロイ

## Web版の機能

- Next.js App RouterによるWeb UI
- Auth.js / NextAuthによる認証
- メールアドレス + パスワードログイン
- Googleログイン
- GitHubログイン
- メモ一覧、詳細、作成、編集、削除
- 検索、絞り込み、並び替え
- 公開/非公開バッジ
- タグ表示
- Todo形式の本文編集・表示
- 自動保存
- AI Assistant
  - タイトル生成
  - タグ生成
  - 要約
  - リライト

## モバイル版の機能

`mobile/` に Expo + React Native + TypeScript のアプリがあります。

- Web版に近い初期概要画面
- メールアドレス + パスワードログイン
- Bearer Token認証
- メモ一覧、詳細、作成、編集、削除
- タグ表示
- Todo形式メモの表示
- 作成/編集画面の自動保存
- AI Assistant
  - 要約
  - リライト
  - アイデア生成
- 生成結果の本文への反映

モバイル版のGoogle/GitHubログインは未対応です。

## 技術スタック

| 領域 | 技術 |
| --- | --- |
| Web | Next.js App Router, React, TypeScript |
| Mobile | Expo, React Native, TypeScript |
| Backend | Next.js Route Handlers, Server Actions |
| Database | PostgreSQL |
| ORM | Prisma ORM |
| Auth | Auth.js / NextAuth, JWT, Bearer Token |
| Validation | Zod |
| AI | Google Gemini API |
| Styling | CSS, React Native StyleSheet |
| Deploy | Vercel |
| Package Manager | npm |

## アーキテクチャ概要

```text
Web Browser
  -> Next.js App Router
  -> Server Actions / Route Handlers
  -> Prisma
  -> PostgreSQL

Expo Mobile App
  -> /api/mobile/auth/login
  -> Bearer Token
  -> /api/mobile/posts
  -> /api/mobile/ai/generate
  -> Prisma / Gemini API
```

Web版はNext.js内でページ、Server Action、Route Handlerを利用します。モバイル版はNext.jsアプリをAPIサーバーとして使い、`/api/mobile/*` をJSON APIとして呼び出します。

Gemini APIキーはサーバー側だけで参照します。モバイルアプリからGemini APIを直接呼び出す実装はありません。

## 認証方式

### Web版

- Auth.js / NextAuthを利用
- Credentialsログイン
- Google OAuth
- GitHub OAuth
- セッションはNextAuthのJWT strategy

### モバイル版

- `/api/mobile/auth/login` でメールアドレス + パスワードを検証
- 成功時にモバイル用アクセストークンを発行
- 以降のAPIは `Authorization: Bearer <accessToken>` を付与
- トークンはExpo SecureStoreに保存

refresh token / ApiSession は未実装です。現在は短期のBearer Tokenのみを使います。

## API設計の概要

### モバイルAPI

| Method | Path | 内容 |
| --- | --- | --- |
| `POST` | `/api/mobile/auth/login` | メールアドレス + パスワードでログイン |
| `GET` | `/api/mobile/posts` | 自分のメモ一覧を取得 |
| `POST` | `/api/mobile/posts` | メモ作成 |
| `GET` | `/api/mobile/posts/[id]` | メモ詳細を取得 |
| `PATCH` | `/api/mobile/posts/[id]` | メモ更新 |
| `DELETE` | `/api/mobile/posts/[id]` | メモ削除 |
| `POST` | `/api/mobile/ai/generate` | AI生成 |

`/api/mobile/ai/generate` は `content` と `mode` を受け取ります。

```json
{
  "content": "メモ本文",
  "mode": "summarize"
}
```

対応mode:

- `summarize`
- `improve`
- `ideas`

成功時:

```json
{
  "result": "AI生成結果"
}
```

## セットアップ

### 1. リポジトリを取得

```bash
git clone https://github.com/m-komatsu-dev/next-prisma-memo.git
cd next-prisma-memo
```

### 2. 依存関係をインストール

```bash
npm install
```

モバイル版も使う場合:

```bash
cd mobile
npm install
cd ..
```

### 3. 環境変数を設定

プロジェクトルートに `.env` を作成します。

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
AUTH_SECRET="your-auth-secret"

# Optional: mobile bearer token secret
MOBILE_AUTH_SECRET="your-mobile-auth-secret"

# Optional: database pool
DATABASE_POOL_MAX="5"

# Optional: Google OAuth for Web
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Optional: GitHub OAuth for Web
GITHUB_ID="your-github-client-id"
GITHUB_SECRET="your-github-client-secret"

# Optional: AI assistant
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"
```

`MOBILE_AUTH_SECRET` が未設定の場合は `AUTH_SECRET` をモバイル用Bearer Tokenの署名にも使います。

モバイル版では `mobile/.env` を作成します。

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

実機からMacやPC上のNext.js開発サーバーへ接続する場合は、`localhost` ではなく開発PCのLAN IPを指定してください。

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000
```

Androidエミュレーターの場合は環境により次のURLを使います。

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
```

### 4. データベースを同期

```bash
npx prisma db push
```

マイグレーションを作成しながら開発する場合:

```bash
npx prisma migrate dev
```

## Web版の起動方法

```bash
npm run dev
```

ブラウザで開きます。

```text
http://localhost:3000
```

主なコマンド:

| Command | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバーを起動 |
| `npm run lint` | ESLintを実行 |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番ビルドを起動 |
| `npm run db:generate` | Prisma Client生成 |
| `npm run db:push` | DBへschema反映 |
| `npm run db:migrate` | migration作成 |

## Expo版の起動方法

Next.js側を先に起動します。

```bash
npm run dev
```

別ターミナルでExpoを起動します。

```bash
cd mobile
npm run start
```

型チェック:

```bash
cd mobile
npm run typecheck
```

補足: 現在のローカル環境でNode.js v24系を使うと、Expo CLIが `ERR_SOCKET_BAD_PORT` で失敗する場合があります。その場合はExpoが対応しているLTS系Node.jsでの起動を確認してください。

## デプロイ

Web/APIはVercelへのデプロイを想定しています。

1. VercelにGitHubリポジトリを接続
2. Root Directoryはプロジェクトルート
3. Build Commandは通常どおり `npm run build`
4. Environment Variablesにルート `.env` と同等の値を設定
5. PostgreSQLはPrisma Postgresなどの接続文字列を `DATABASE_URL` に設定

モバイル版はExpo Goでの確認を前提にしています。ストア配布やEAS Buildは今後の拡張対象です。

## ポートフォリオとしての見どころ

- Next.js App Routerを使ったフルスタック構成
- Web UIとReact Native UIを同一サービス体験に近づけた設計
- WebはNextAuth、mobileはBearer Tokenという用途別の認証設計
- `/api/mobile/*` によるモバイル専用API設計
- Prisma + PostgreSQLによるリレーション管理
- Zodによるサーバー側入力検証
- 自動保存をWeb/mobileの両方で実装
- Gemini APIをサーバー側だけで扱うAI機能
- Vercelに載せやすいRoute Handler構成

## 現在未実装のもの

- モバイル版のGoogle/GitHubログイン
- refresh token / ApiSession
- アカウント削除
- ユーザー間共有機能
- カレンダー表示
- リマインダー
- Expoアプリのストア配布/EAS Build

## 今後追加予定の機能

- アカウント削除
- メモ共有機能
- カレンダー連携
- リマインダー
- モバイル版OAuthログイン
- refresh token / ApiSessionによるモバイル認証の強化
- EAS Buildによる配布フロー
