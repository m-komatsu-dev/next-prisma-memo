# My Memo Mobile

Expo + React Native + TypeScript のモバイルアプリです。Next.jsアプリをAPIサーバーとして利用し、`/api/mobile/*` をBearer Token付きで呼び出します。

## 現在できること

- Web版に近い初期概要画面
- メールアドレス + パスワードログイン
- Bearer Token認証
- メモ一覧
- メモ詳細
- メモ作成
- メモ編集
- メモ削除
- 作成/編集画面の自動保存
- タグ表示
- Todo形式メモの表示
- AI Assistant
  - 要約
  - リライト
  - アイデア生成
  - 生成結果の本文への反映

Google/GitHubログイン、refresh token、ApiSessionは未実装です。

## セットアップ

リポジトリルートでNext.jsアプリを先にセットアップしてください。

```bash
npm install
npm run dev
```

別ターミナルでmobile側を準備します。

```bash
cd mobile
npm install
```

`mobile/.env` を作成します。

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

iOSシミュレーターや実機からMac上のNext.js開発サーバーへ接続する場合、`localhost` ではなく開発PCのLAN IPを指定してください。

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000
```

AndroidエミュレーターでホストPCの開発サーバーへ接続する場合は、環境により次のURLを使います。

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
```

## 起動

```bash
npm run start
```

型チェック:

```bash
npm run typecheck
```

## 認証

モバイル版は `/api/mobile/auth/login` にメールアドレスとパスワードを送信し、成功時に返る `accessToken` をExpo SecureStoreに保存します。

以降のAPI呼び出しでは次のヘッダーを付けます。

```http
Authorization: Bearer <accessToken>
```

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

AI生成はNext.js側のRoute Handler経由で実行されます。Gemini APIキーはmobile側に置きません。

## 注意

Node.js v24系の環境では、Expo CLIが `ERR_SOCKET_BAD_PORT` で起動に失敗する場合があります。その場合はExpoが対応しているLTS系Node.jsで確認してください。
