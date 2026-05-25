# My Memo App

Next.js App Router + TypeScript のWebアプリと、Expo + React Native のモバイルアプリで構成したフルスタックのメモアプリです。バックエンドはNext.js Route Handlers / Server Actions、Prisma、PostgreSQLを使い、Web版とモバイル版が同じメモデータを扱います。

- App URL: https://todo-text-memo.vercel.app
- GitHub: https://github.com/m-komatsu-dev/next-prisma-memo

## アプリ概要

メモの作成、整理、検索、特定ユーザーへの共有、AIによる補助をWebとモバイルの両方から利用できるアプリです。

Web版はブラウザ向けのNext.jsアプリとして動作します。モバイル版は `mobile/` 配下のExpoアプリで、Next.js側の `/api/mobile/*` APIを呼び出します。AI機能はサーバー側でGemini APIを呼び出す設計で、モバイルアプリからGemini APIを直接呼び出しません。

## Web版とモバイル版の機能

### 共通機能

- メモ一覧、詳細、作成、編集、削除
- タイトル、本文、タグ、公開/非公開ステータスの管理
- チェックボックス/Todo形式のメモ
- メモ一覧の検索、表示フィルター、並び替え
- 作成/編集画面の自動保存
- 特定ユーザーへのメモ共有
- 共有メモの閲覧・権限に応じた操作
- AIタイトル生成
- AIタグ生成
- AI要約追加
- AIリライト追加
- アカウント削除

### Web版

- Auth.js / NextAuthによる認証
- メールアドレス + パスワードログイン
- Googleログイン
- GitHubログイン
- すべて/自分のメモ/共有/公開のみ/非公開のみの表示フィルター
- カード表示/リスト表示の切り替え
- メモ詳細でのAI要約表示
- メモ詳細/編集画面からの共有設定
- メールアドレス指定による共有相手の追加
- viewer/editorの共有権限変更
- 共有解除
- アカウント設定画面からのアカウント削除

### モバイル版

- Expo + React Nativeアプリ
- メールアドレス + パスワードログイン
- Bearer Token認証
- Expo SecureStoreへのアクセストークン保存
- Todo形式メモの表示・編集
- 自分のメモと共有されたメモの一覧表示
- 共有メモのviewer/editorバッジ表示
- 権限に応じた編集・削除ボタンの表示制御
- ownerによる共有相手の追加、権限変更、共有解除
- AI Assistantからタイトル生成、タグ生成、要約追加、リライト追加
- アカウント設定画面からのアカウント削除

モバイル版のGoogle/GitHubログインは未対応です。

アカウント削除はWeb版・モバイル版ともに確認ダイアログで実行します。`DELETE` 文字列を入力する方式ではありません。削除後はログアウト状態になり、ユーザー、ログイン連携、セッション、作成したメモなどの関連データを削除します。

## メモ共有と権限設計

メモ共有は `PostShare` によって、メモと共有先ユーザーを紐づけます。共有相手はメールアドレスで指定し、存在しないメールアドレスや自分自身への共有はエラーになります。

| Role | 閲覧 | 編集 | 削除 | 共有設定変更 |
| --- | --- | --- | --- | --- |
| owner | ○ | ○ | ○ | ○ |
| editor | ○ | ○ | - | - |
| viewer | ○ | - | - | - |

ownerはメモ作成者です。editorは本文・タイトル・タグなどを編集できますが、削除と共有設定変更はできません。viewerは閲覧のみ可能です。非公開メモはownerまたは明示的に共有されたユーザーだけがアクセスでき、非共有ユーザーからは見えません。

Web版はAuth.js / NextAuthのセッションで、モバイル版はBearer Tokenで認証したうえで、サーバー側で権限チェックを行います。UI上の表示制御だけに依存しない設計です。

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
| AI | Google Gemini API |
| Mobile Storage | Expo SecureStore |
| Deploy | Vercel |
| Package Manager | npm |

## アーキテクチャ概要

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

Web版はNext.js内のページ、Server Actions、Route Handlersで画面と更新処理を構成しています。モバイル版はNext.jsアプリをAPIサーバーとして利用し、JSON API経由でメモを操作します。

Todoは専用テーブルを持たず、本文の形式からチェックボックス/Todoとして扱う設計です。

## 認証方式の違い

### Web版

- Auth.js / NextAuthを利用
- Credentialsログイン
- Google OAuth
- GitHub OAuth
- セッションはNextAuthのJWT strategy

### モバイル版

- `/api/mobile/auth/login` にメールアドレス + パスワードを送信
- 成功時にモバイル用アクセストークンを発行
- 以降のAPIは `Authorization: Bearer <accessToken>` を付与
- トークンはExpo SecureStoreに保存
- アクセストークンの有効期限は現在 `12h`

refresh token / ApiSession は未実装です。現在は短期のBearer Tokenのみを使います。

## セットアップ方法

### 1. 前提

- Node.js LTS
- npm
- PostgreSQLデータベース
- Google/GitHubログインを使う場合は各OAuthアプリ
- AI機能を使う場合はGemini APIキー

### 2. リポジトリを取得

```bash
git clone https://github.com/m-komatsu-dev/next-prisma-memo.git
cd next-prisma-memo
```

### 3. 依存関係をインストール

```bash
npm install
```

モバイル版も使う場合:

```bash
cd mobile
npm install
cd ..
```

### 4. 環境変数を設定

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

# Optional: Vercel/production auth host handling
AUTH_TRUST_HOST="true"

# Optional: AI assistant
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"
```

`MOBILE_AUTH_SECRET` が未設定の場合は、`AUTH_SECRET` をモバイル用Bearer Tokenの署名にも使います。

モバイルアプリをローカルAPIへ接続する場合は、`mobile/.env` も作成します。詳しくは [mobile/README.md](mobile/README.md) を参照してください。

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

### 5. データベースを同期

Prisma Clientを生成します。

```bash
npm run db:generate
```

開発環境でschemaをDBへ反映します。

```bash
npm run db:push
```

マイグレーションを作成しながら開発する場合:

```bash
npm run db:migrate
```

### 6. Web版を起動

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
| `npm run db:seed` | seed実行 |

## API概要

モバイル版は次のAPIを利用します。

| Method | Path | 内容 |
| --- | --- | --- |
| `POST` | `/api/mobile/auth/login` | メールアドレス + パスワードでログイン |
| `GET` | `/api/mobile/posts` | 自分のメモ一覧を取得 |
| `POST` | `/api/mobile/posts` | メモ作成 |
| `GET` | `/api/mobile/posts/[id]` | メモ詳細を取得 |
| `PATCH` | `/api/mobile/posts/[id]` | メモ更新 |
| `DELETE` | `/api/mobile/posts/[id]` | メモ削除 |
| `GET` | `/api/mobile/posts/[id]/shares` | 共有一覧を取得 |
| `POST` | `/api/mobile/posts/[id]/shares` | 共有相手を追加 |
| `PATCH` | `/api/mobile/posts/[id]/shares/[shareId]` | 共有権限を変更 |
| `DELETE` | `/api/mobile/posts/[id]/shares/[shareId]` | 共有解除 |
| `POST` | `/api/mobile/ai/generate` | AI生成 |
| `DELETE` | `/api/mobile/account` | アカウント削除 |

`GET /api/mobile/posts` は自分のメモと自分に共有されたメモを返します。共有メモには `accessRole` が含まれ、モバイル側でviewer/editor/ownerに応じた表示を行います。削除と共有設定変更はownerのみ可能です。

`/api/mobile/ai/generate` は `content` と `mode` を受け取ります。対応modeは `title`、`tags`、`summarize`、`rewrite`、`improve`、`ideas` です。

`/api/mobile/account` はBearer Token認証が必要です。確認ダイアログで確定したあと、リクエスト本文に `{ "confirmed": true }` を送って削除します。削除対象はユーザー、ログイン連携、セッション、作成したメモなどの関連データです。モバイルアプリ側では削除成功後に保存済みアクセストークンを消去し、ログアウト状態に戻します。

## デプロイ情報

Web/APIはVercelへデプロイ済みです。

Vercelで動かす場合は、次の設定を行います。

1. VercelにGitHubリポジトリを接続
2. Root Directoryをプロジェクトルートに設定
3. Build Commandを `npm run build` に設定
4. Environment Variablesにルート `.env` と同等の値を設定
5. PostgreSQLの接続文字列を `DATABASE_URL` に設定
6. Google/GitHub OAuthを使う場合は、本番URLのcallback URLを各OAuthアプリに設定

モバイル版を本番APIへ接続する場合は、`mobile/.env` の `EXPO_PUBLIC_API_BASE_URL` をVercelのURLに変更します。

```env
EXPO_PUBLIC_API_BASE_URL=https://todo-text-memo.vercel.app
```

モバイル版は現在Expo Goでの確認を前提にしています。ストア配布やEAS Buildは今後の改善予定です。

## ポートフォリオとしての見どころ

- Next.js App Routerを使ったフルスタック構成
- Web UIとReact Native UIを同じサービス体験に近づけた設計
- WebはNextAuth、mobileはBearer Tokenという用途別の認証設計
- `/api/mobile/*` によるモバイル専用API設計
- Prisma + PostgreSQLによるリレーション管理
- owner/editor/viewerによる共有権限設計
- Web/mobile両方での共有メモ閲覧とサーバー側権限チェック
- Zodによるサーバー側入力検証
- Todo形式メモを本文から扱う設計
- Web/mobile両方の自動保存
- Gemini APIをサーバー側だけで扱うAI機能
- Vercelに載せやすいRoute Handler構成

## 今後の改善予定

- カレンダー表示
- リマインダー
- モバイル版Google/GitHubログイン
- refresh token / ApiSessionによるモバイル認証の強化
- GitHub ActionsによるCI
- テスト強化
- EAS Buildによる配布フロー
