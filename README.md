# next-prisma-memo

Next.js と Prisma ORM、PostgreSQL を使用したモダンなフルスタック・メモ管理アプリケーションです。  
ユーザー認証、メモの作成・編集・削除、タグ管理、公開設定、検索・絞り込みなど、実用的なメモ管理体験をフルスタックで実装しています。

## Tech Stack

| Category | Technology |
| --- | --- |
| **Frontend** | Next.js (App Router), React, TypeScript |
| **Styling** | Tailwind CSS, CSS |
| **Backend** | Next.js Server Actions, Route Handlers |
| **ORM** | Prisma ORM |
| **Database** | PostgreSQL (Prisma Postgres) |
| **Authentication** | NextAuth.js, Prisma Adapter (Credentials / Google / GitHub) |
| **Validation** | Zod |
| **Package Manager** | npm |
| **Deployment** | Vercel |

## Features

### Implemented

- メモの CRUD 機能
- ユーザーごとのメモ管理
- メールアドレス・パスワードによる認証
- Google / GitHub OAuth ログイン
- メモの公開・非公開切り替え
- 公開メモの閲覧
- タグの登録・表示
- タイトル、本文、タグを対象にしたメモ検索
- 公開状態によるフィルタリング
- 更新日・作成日・タイトル順の並び替え
- チェックリスト形式に対応したメモエディタ
- 入力内容の自動下書き保存
- AI によるタイトル生成、タグ生成、要約、リライト補助
- レスポンシブ対応の UI
- Zod によるフォーム入力バリデーション
- Prisma のリレーション・インデックスを利用したデータ設計

## Getting Started

### 1. Clone Repository

```bash
git clone https://github.com/m-komatsu-dev/next-prisma-memo.git
cd next-prisma-memo
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Environment File

プロジェクトルートに `.env` を作成し、データベース接続文字列を設定します。

```env
DATABASE_URL="your-connection-string"
AUTH_SECRET="your-auth-secret"

# Optional: OAuth login
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"

# Optional: AI assistant
GEMINI_API_KEY="your-gemini-api-key"
```

### 4. Setup Database

Prisma schema をもとにデータベースを同期します。

```bash
npx prisma db push
```

マイグレーション履歴を作成しながら開発する場合は、以下を使用します。

```bash
npx prisma migrate dev
```

### 5. Start Development Server

```bash
npm run dev
```

ブラウザで以下にアクセスします。
http://localhost:3000

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 本番用ビルドを作成 |
| `npm run start` | 本番ビルドを起動 |

## About

このアプリケーションは、Next.js App Router と Prisma ORM を中心に、認証・認可・データベース設計・サーバーアクション・バリデーション・レスポンシブ UI を含むフルスタック開発の実践として制作しています。
