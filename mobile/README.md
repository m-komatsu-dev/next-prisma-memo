# My Memo Mobile

`mobile/` は My Memo App の Expo / React Native アプリです。Next.js 側の `/api/mobile/*` API に接続し、Web 版と同じ PostgreSQL のメモ、Todo、通知、共有データを扱います。

プロジェクト全体の構成は [README.md](../README.md) を参照してください。

## 概要

- Expo / React Native / TypeScript
- メールアドレスとパスワードでのログイン
- Google / GitHub の外部ブラウザログイン
- access token / refresh token によるモバイル認証
- Expo SecureStore への token 保存
- メモの一覧、詳細、作成、編集、削除
- タイトル、本文、タグ、Todo の検索
- 自分のメモ、共有メモ、公開 / 非公開のフィルター
- Todo 一覧、期限付き Todo、カレンダー表示
- 共有設定と viewer / editor 権限の表示
- 通知一覧、既読処理、pull-to-refresh
- Expo Push Token 登録
- AI Assistant
- アカウント削除

AI 生成はモバイル側から Gemini API を直接呼ばず、Next.js API 経由で実行します。

## 起動

先にプロジェクトルートで Web 側を起動します。

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

別ターミナルで Expo を起動します。

```bash
cd mobile
npm install
npm run start
```

型チェック:

```bash
npm run typecheck
```

## コマンド

| Command | 内容 |
| --- | --- |
| `npm run start` | Expo 開発サーバー |
| `npm run android` | Android 向けに Expo を起動 |
| `npm run ios` | iOS 向けに Expo を起動 |
| `npm run web` | Web 向けに Expo を起動 |
| `npm run typecheck` | TypeScript の型チェック |

## API 接続先

`mobile/.env` を作成し、Next.js API の URL を設定します。

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_MOBILE_OAUTH_CALLBACK_URL=mymemo://auth/callback
```

接続先は実行環境によって変わります。

| 環境 | 設定例 |
| --- | --- |
| iOS Simulator | `http://localhost:3000` |
| Android Emulator | `http://10.0.2.2:3000` |
| Expo Go / 実機 | `http://<PCのLAN IP>:3000` |
| Preview / production | `https://next-prisma-memo.vercel.app` |

`.env` を変更したあとは Expo 開発サーバーを再起動してください。

`EXPO_PUBLIC_` で始まる値はアプリに埋め込まれます。Gemini API key、`DATABASE_URL`、`AUTH_SECRET`、`MOBILE_AUTH_SECRET`、`CRON_SECRET`、`EXPO_ACCESS_TOKEN`、refresh token などの秘密情報は mobile 側に置かないでください。

## OAuth

モバイル版の Google / GitHub ログインは Expo WebBrowser を使います。

1. アプリが `/api/mobile/oauth/start?provider=google|github` を開く
2. Auth.js 側で OAuth ログインを完了する
3. `/mobile/oauth/complete` が短時間だけ使える code を発行する
4. `mymemo://auth/callback?code=...` でアプリへ戻る
5. アプリが `/api/mobile/oauth/exchange` に code を送り、access token / refresh token を受け取る

OAuth code の生値は DB に保存せず、ハッシュ化して保存します。

## 利用する API

通常の API リクエストでは次のヘッダーを付けます。

```http
Authorization: Bearer <accessToken>
```

access token が期限切れになった場合は `/api/mobile/auth/refresh` で token を更新します。refresh に失敗した場合は保存済み token を削除し、ログアウト状態に戻します。

| Method | Path | 内容 |
| --- | --- | --- |
| `POST` | `/api/mobile/auth/login` | ログイン |
| `POST` | `/api/mobile/auth/refresh` | token 更新 |
| `POST` | `/api/mobile/auth/logout` | セッション失効 |
| `GET` | `/api/mobile/posts` | メモ一覧 |
| `POST` | `/api/mobile/posts` | メモ作成 |
| `GET` | `/api/mobile/posts/[id]` | メモ詳細 |
| `PATCH` | `/api/mobile/posts/[id]` | メモ更新 |
| `DELETE` | `/api/mobile/posts/[id]` | メモ削除 |
| `GET` | `/api/mobile/posts/[id]/todos` | Todo 一覧 |
| `POST` | `/api/mobile/posts/[id]/todos` | Todo 追加 |
| `PATCH` | `/api/mobile/posts/[id]/todos/[todoId]` | Todo 更新 |
| `DELETE` | `/api/mobile/posts/[id]/todos/[todoId]` | Todo 削除 |
| `GET` | `/api/mobile/todos` | 横断 Todo 一覧 |
| `GET` | `/api/mobile/todos/calendar` | Todo カレンダー |
| `GET` | `/api/mobile/posts/[id]/shares` | 共有一覧 |
| `POST` | `/api/mobile/posts/[id]/shares` | 共有相手追加 |
| `PATCH` | `/api/mobile/posts/[id]/shares/[shareId]` | 共有権限変更 |
| `DELETE` | `/api/mobile/posts/[id]/shares/[shareId]` | 共有解除 |
| `GET` | `/api/mobile/notifications` | 通知一覧 |
| `PATCH` | `/api/mobile/notifications/[id]/read` | 通知を既読にする |
| `PATCH` | `/api/mobile/notifications/read-all` | 通知をすべて既読にする |
| `POST` | `/api/mobile/push-subscriptions` | Expo Push Token 登録 |
| `DELETE` | `/api/mobile/push-subscriptions` | Expo Push Token 無効化 |
| `POST` | `/api/mobile/push-subscriptions/test` | テスト通知送信 |
| `POST` | `/api/mobile/ai/generate` | AI 生成 |
| `DELETE` | `/api/mobile/account` | アカウント削除 |

`/api/mobile/push-subscriptions/test` は production では `ENABLE_PUSH_TEST_API=true` の場合だけ有効です。

## EAS Build

`mobile/eas.json` には `development`、`preview`、`production` の profile を設定しています。現在の profile は `EXPO_PUBLIC_API_BASE_URL` を `https://next-prisma-memo.vercel.app` に向けています。

EAS CLI を使う場合:

```bash
npm install --global eas-cli
```

グローバルインストールを避ける場合は `npx eas-cli@latest` で実行できます。

Android の内部配布ビルド:

```bash
cd mobile
npm run typecheck
eas build --platform android --profile preview
```

iOS の内部配布ビルドでは Apple Developer Program と実機 UDID の登録が必要です。

## 注意

- `mobile/.env` と `mobile/.env.local` はコミットしません。
- 実機から `localhost` を指定すると、PC ではなく端末自身を指します。
- Node.js v24 系では Expo CLI が `ERR_SOCKET_BAD_PORT` で起動に失敗する場合があります。その場合は Expo が対応している LTS 系 Node.js で確認してください。
- 画像添付は実装していません。
- ストア配布は運用していません。
