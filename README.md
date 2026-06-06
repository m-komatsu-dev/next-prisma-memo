# My Memo App

Web とモバイルで使えるメモ / Todo アプリです。Web 版は Next.js、モバイル版は Expo / React Native で実装し、どちらも同じ PostgreSQL のデータを扱います。

| 項目 | 場所 |
| --- | --- |
| Web App | https://next-prisma-memo.vercel.app |
| Repository | https://github.com/m-komatsu-dev/next-prisma-memo |
| Mobile App | [mobile/](mobile/) |

## 概要

メモの作成、検索、共有、Todo 管理、通知を扱うアプリです。Web 版は画面とサーバー処理を Next.js にまとめ、モバイル版は `/api/mobile/*` の API を呼び出す構成にしています。

認証は Web とモバイルで方式を分けています。Web は Auth.js / NextAuth を使い、モバイルは access token と refresh token を使います。共有メモは owner / editor / viewer の権限をサーバー側で判定します。

## 主な機能

### Web

- メールアドレスとパスワードでの登録、ログイン
- Google / GitHub ログイン
- メモの作成、一覧、詳細、編集、削除
- 公開 / 非公開の切り替え
- タグ、タイトル、本文による検索
- Todo の作成、編集、完了、削除
- 期限付き Todo とカレンダー表示
- メモ本文内のチェックボックス表示、編集
- 作成 / 編集画面の自動保存
- メールアドレス指定によるメモ共有
- 共有相手ごとの閲覧 / 編集権限
- 通知一覧、未読件数、既読処理
- Gemini API を使ったタイトル生成、タグ生成、要約、リライト
- アカウント削除

### Mobile

- Expo / React Native アプリ
- メールアドレスとパスワードでのログイン
- Google / GitHub の外部ブラウザログイン
- access token / refresh token の保存
- メモの一覧、詳細、作成、編集、削除
- タグ、タイトル、本文、Todo による検索
- Todo 一覧、期限付き Todo、カレンダー表示
- 共有メモの閲覧と共有設定
- 通知一覧、未読管理、pull-to-refresh
- Expo Push Token の登録とログアウト時の無効化
- Gemini API を使った AI Assistant
- アカウント削除

### 通知

TodoItem の `reminderAt` が期限に達したとき、Cron API から Expo Push 通知を送ります。送信後は `reminderSentAt` を更新し、同じ Todo に重複して送らないようにしています。

共有時の通知はアプリ内通知として保存します。Push 通知の対象は Todo リマインダーです。

## 技術構成

| 領域 | 使用しているもの |
| --- | --- |
| Web | Next.js App Router, React, TypeScript |
| Mobile | Expo, React Native, TypeScript |
| API | Next.js Route Handlers, Server Actions |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | Auth.js / NextAuth, JWT, mobile access token / refresh token |
| Validation | Zod |
| Password | bcrypt |
| AI | Google Gemini API |
| Push | Expo Notifications |
| Test | Vitest, Playwright |
| Deploy | Vercel, EAS Build |

## データと権限

主なデータは `User`、`Post`、`TodoItem`、`Tag`、`PostShare`、`Notification`、`ApiSession`、`PushSubscription` です。

メモの操作は作成者、共有相手、共有権限をもとにサーバー側で判定します。モバイル API も同じ方針で実装しており、UI の表示だけに依存しません。

## ローカル起動

### 前提

- Node.js LTS
- npm
- PostgreSQL
- Google / GitHub ログインを使う場合は各 OAuth アプリ
- AI 機能を使う場合は Gemini API キー
- モバイル版を確認する場合は Expo Go、または iOS / Android シミュレーター

### Web

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

Web 版は `http://localhost:3000` で起動します。

### Mobile

先に Web 側の開発サーバーを起動してから、別ターミナルで実行します。

```bash
cd mobile
npm install
npm run start
```

接続先 API は `mobile/.env` の `EXPO_PUBLIC_API_BASE_URL` で指定します。設定例は [mobile/.env.example](mobile/.env.example) を参照してください。

## コマンド

| Command | 内容 |
| --- | --- |
| `npm run dev` | Next.js 開発サーバー |
| `npm run build` | production build |
| `npm run start` | build 後の Next.js 起動 |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run test:e2e` | Playwright |
| `npm run db:generate` | Prisma Client 生成 |
| `npm run db:push` | Prisma schema を DB に反映 |
| `npm run db:migrate` | migration 作成 |
| `npm run db:seed` | seed 実行 |
| `cd mobile && npm run start` | Expo 開発サーバー |
| `cd mobile && npm run typecheck` | モバイル版の型チェック |

## 環境変数

環境変数は `.env.example`、`.env.test.example`、[mobile/.env.example](mobile/.env.example) をもとに設定します。

| 変数 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 接続 |
| `AUTH_SECRET` | Auth.js / NextAuth の署名 |
| `AUTH_URL` | Web アプリの origin |
| `AUTH_TRUST_HOST` | Auth.js の host 信頼設定 |
| `MOBILE_AUTH_SECRET` | モバイル認証トークンの署名 |
| `MOBILE_OAUTH_CALLBACK_URL` | モバイル OAuth callback |
| `CRON_SECRET` | Todo リマインダー Cron の認証 |
| `EXPO_ACCESS_TOKEN` | Expo Push API のサーバー認証 |
| `ENABLE_PUSH_TEST_API` | production でテスト通知 API を有効にする場合のみ使用 |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini API |
| `EXPO_PUBLIC_API_BASE_URL` | Expo アプリの接続先 API |
| `EXPO_PUBLIC_MOBILE_OAUTH_CALLBACK_URL` | Expo アプリの OAuth callback |
| `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` | Playwright E2E 用テストユーザー |

`.env`、`.env.test`、`mobile/.env`、`mobile/.env.local` はコミットしません。`EXPO_PUBLIC_` で始まる値はアプリに埋め込まれるため、API キー、token、DB URL、認証 secret は入れないでください。

## セキュリティ

- パスワードは bcrypt でハッシュ化して保存します。
- 入力値は Zod で検証します。
- refresh token は平文保存せず、ハッシュ化して DB に保存します。
- refresh token は rotation し、再利用を検知した場合は同じ token family を失効します。
- 共有メモの閲覧、編集、削除、共有設定はサーバー側で権限を確認します。
- 認証、AI 生成、CSP report などの API に rate limit を設定しています。
- secret、token、DB URL などはログ出力時に伏せる処理を入れています。
- Todo リマインダー Cron は `CRON_SECRET` で認証します。

詳しい内容は [SECURITY_REPORT.md](SECURITY_REPORT.md)、[CSP_REPORT.md](CSP_REPORT.md)、[RATE_LIMIT_REPORT.md](RATE_LIMIT_REPORT.md) に分けています。

## 関連ドキュメント

- [mobile/README.md](mobile/README.md): モバイル版の起動、環境変数、EAS Build
- [SECURITY_REPORT.md](SECURITY_REPORT.md): セキュリティ対策
- [MOBILE_OAUTH_REPORT.md](MOBILE_OAUTH_REPORT.md): モバイル OAuth
- [NOTIFICATION_REPORT.md](NOTIFICATION_REPORT.md): 通知
- [E2E_REPORT.md](E2E_REPORT.md): Playwright E2E
- [EAS_BUILD_REPORT.md](EAS_BUILD_REPORT.md): EAS Build
- [PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md): パフォーマンス改善
- [REFACTOR_REPORT.md](REFACTOR_REPORT.md): リファクタリング
