# My Memo Mobile

Expo + React Native + TypeScript のスマホアプリです。既存の Next.js アプリを API サーバーとして使い、まずはメモ一覧だけを表示します。

Expo Goでの確認を優先するため、Expo SDK 54系の安定構成に合わせています。

## セットアップ

```bash
cd mobile
npm install
cp .env.example .env
npm run start
```

`.env` に API サーバーのURLを設定します。

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

iOSシミュレーターや実機から Mac 上の Next.js 開発サーバーへ接続する場合、`localhost` ではなく開発PCのLAN IPを指定してください。

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000
```

AndroidエミュレーターでホストPCの開発サーバーへ接続する場合は、環境により次のURLを使います。

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
```

## 起動

Next.js 側を先に起動します。

```bash
npm run dev
```

別ターミナルで mobile 側を起動します。

```bash
cd mobile
npm run start
```

## 現在の制限

現在の `/api/mobile/posts` は NextAuth/Auth.js のログインCookieを必要とします。そのため、React Native から直接呼び出すと `401` になる可能性があります。

この段階では、画面構成と API 呼び出し処理だけを用意しています。React Native から安定して利用するには、次の段階でモバイル向け認証を追加してください。

候補:

- モバイル用の email/password ログインAPIを追加する
- access token / refresh token を発行する
- React Native 側で token を安全に保存する
- `/api/mobile/*` が Cookie または Bearer token のどちらでも認証できるようにする
