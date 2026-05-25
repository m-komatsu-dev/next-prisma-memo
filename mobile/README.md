# My Memo Mobile

`mobile/` は My Memo App のExpo / React Nativeアプリです。Next.js側の `/api/mobile/*` APIへ接続し、Web版と同じPostgreSQL上のメモデータを利用します。

このREADMEはモバイルアプリ専用の起動・設定メモです。プロジェクト全体の構成、Web版、DB、デプロイについてはルートの [README.md](../README.md) を参照してください。

## Expoアプリの概要

- Expo + React Native + TypeScript
- Next.js APIを利用するクライアントアプリ
- メールアドレス + パスワードログイン
- Bearer Token認証
- アクセストークンはExpo SecureStoreに保存
- Gemini APIキーはモバイル側に置かず、Next.js API経由でAI生成を実行

## 起動方法

先にプロジェクトルートでNext.js開発サーバーを起動します。

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

別ターミナルでExpoアプリを起動します。

```bash
cd mobile
npm install
npm run start
```

型チェック:

```bash
npm run typecheck
```

## EXPO_PUBLIC_API_BASE_URL の設定

`mobile/.env` を作成し、Next.js APIのURLを設定します。

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

iOS SimulatorでMac上のNext.js開発サーバーへ接続する場合は、通常 `localhost` を利用できます。

Android EmulatorでホストPCの開発サーバーへ接続する場合は、環境により次のURLを使います。

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
```

スマホ実機やExpo GoからMac上のNext.js開発サーバーへ接続する場合は、`localhost` ではなくMacのLAN IPを指定してください。

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000
```

本番Vercel環境へ接続する場合:

```env
EXPO_PUBLIC_API_BASE_URL=https://todo-text-memo.vercel.app
```

`.env` を変更したあとは、Expo開発サーバーを再起動してください。

## Expo Goでの確認方法

1. Next.js開発サーバーを `npm run dev` で起動
2. `mobile/.env` の `EXPO_PUBLIC_API_BASE_URL` を接続先に合わせて設定
3. `cd mobile && npm run start` を実行
4. 表示されたQRコードをExpo Goで読み取る
5. 実機で確認する場合は、スマホとMacを同じネットワークに接続する

実機では `http://localhost:3000` はスマホ自身を指します。パソコン上のNext.jsへ接続するには、`http://<パソコンのIPアドレス>:3000` を使います。

## モバイル版の機能

- メールアドレス + パスワードログイン
- Bearer Token認証
- メモ一覧
- メモ詳細
- メモ作成
- メモ編集
- メモ削除
- 作成/編集画面の自動保存
- タイトル、本文、タグでの検索
- 公開/非公開フィルター
- 更新日順、作成日順、タイトル順の並び替え
- タグ表示
- Todo形式メモの表示・編集
- AI Assistant
  - タイトル生成
  - タグ生成
  - 要約追加
  - リライト追加

## 利用するAPI

| Method | Path | 内容 |
| --- | --- | --- |
| `POST` | `/api/mobile/auth/login` | ログイン |
| `GET` | `/api/mobile/posts` | メモ一覧 |
| `POST` | `/api/mobile/posts` | メモ作成 |
| `GET` | `/api/mobile/posts/[id]` | メモ詳細 |
| `PATCH` | `/api/mobile/posts/[id]` | メモ更新 |
| `DELETE` | `/api/mobile/posts/[id]` | メモ削除 |
| `POST` | `/api/mobile/ai/generate` | AI生成 |

API呼び出しでは次のヘッダーを付けます。

```http
Authorization: Bearer <accessToken>
```

## モバイル版の現在の制限

- Google/GitHubログインは未対応
- refresh token / ApiSession は未実装
- アクセストークンは現在 `12h` の短期Bearer Token
- ストア配布やEAS Buildは未対応
- アカウント削除、共有機能、カレンダー、リマインダーは未実装

## 注意

Node.js v24系の環境では、Expo CLIが `ERR_SOCKET_BAD_PORT` で起動に失敗する場合があります。その場合はExpoが対応しているLTS系Node.jsで確認してください。
