# My Memo Mobile

`mobile/` はMy Memo AppのExpo / React Nativeアプリです。Next.js側の `/api/mobile/*` APIへ接続し、Web版と同じPostgreSQL上のメモデータを利用します。

プロジェクト全体の概要、Web版、DB、デプロイ、テスト構成についてはルートの [README.md](../README.md) を参照してください。

## Expoアプリ概要

- Expo + React Native + TypeScript
- Next.js APIを利用するモバイルクライアント
- メールアドレス + パスワードログイン
- access token + refresh token認証
- access token / refresh tokenをExpo SecureStoreに保存
- 自分のメモと共有されたメモを一覧表示
- owner / editor / viewerの権限に応じて操作を制御
- Gemini APIはモバイル側から直接呼ばず、Next.js API経由で実行
- Expo GoとEAS Build内部配布での確認を想定

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

主なコマンド:

| Command | 内容 |
| --- | --- |
| `npm run start` | Expo開発サーバーを起動 |
| `npm run android` | Android向けにExpoを起動 |
| `npm run ios` | iOS向けにExpoを起動 |
| `npm run web` | Web向けにExpoを起動 |
| `npm run typecheck` | TypeScriptの型チェック |

## `EXPO_PUBLIC_API_BASE_URL` の設定

`mobile/.env` を作成し、Next.js APIのURLを設定します。

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

iOS SimulatorでMac上のNext.js開発サーバーへ接続する場合は、通常 `localhost` を利用できます。

Android EmulatorでホストPCの開発サーバーへ接続する場合は、環境により次のURLを使います。

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
```

Expo Goや実機からMac上のNext.js開発サーバーへ接続する場合は、`localhost` ではなくMacのLAN IPを指定します。

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000
```

Preview / 本番Vercel環境へ接続する場合:

```env
EXPO_PUBLIC_API_BASE_URL=https://next-prisma-memo.vercel.app
```

`.env` を変更したあとは、Expo開発サーバーを再起動してください。`mobile/.env` はローカル接続先を含むため、コミットしないでください。

EAS Buildでは、`development` / `preview` / `production` profileの `EXPO_PUBLIC_API_BASE_URL` は `eas.json` に設定しています。現在の内部配布ビルドは本番Vercel APIへ接続します。

```env
EXPO_PUBLIC_API_BASE_URL=https://next-prisma-memo.vercel.app
```

`EXPO_PUBLIC_` で始まる値はアプリに埋め込まれる公開値です。Gemini API key、`DATABASE_URL`、`AUTH_SECRET`、`MOBILE_AUTH_SECRET`、refresh tokenなどの秘密情報はモバイル側へ置かず、Next.js APIまたはサーバー側の環境変数だけで管理してください。

Expo Dashboard側で環境ごとに管理する運用へ寄せる場合は、`eas.json` の `env` を削除してから次のように登録します。

```bash
npx eas-cli env:create --name EXPO_PUBLIC_API_BASE_URL --value https://next-prisma-memo.vercel.app --environment development --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_API_BASE_URL --value https://next-prisma-memo.vercel.app --environment preview --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_API_BASE_URL --value https://next-prisma-memo.vercel.app --environment production --visibility plaintext
```

ローカル開発でEAS側の環境変数を使う場合:

```bash
npx eas-cli env:pull --environment development
```

このコマンドで作成される `.env.local` もコミットしないでください。

## Expo Goでの確認方法

1. ルートで `npm run dev` を実行し、Next.js APIを起動する
2. `mobile/.env` の `EXPO_PUBLIC_API_BASE_URL` を接続先に合わせる
3. `cd mobile && npm run start` を実行する
4. 表示されたQRコードをExpo Goで読み取る
5. 実機で確認する場合は、スマホとPCを同じネットワークに接続する

実機では `http://localhost:3000` はスマホ自身を指します。PC上のNext.jsへ接続するには、`http://<PCのIPアドレス>:3000` を使います。

## EAS Build / 内部配布

Expo Goなしでスマホへインストールする内部配布ビルドはEAS Buildを使います。Expoの内部配布ではBuild URLからテスター端末へ直接インストールできます。`preview` profileは `distribution: "internal"` にしており、Androidは直接インストールしやすいAPKを生成します。

EAS CLIのインストール:

```bash
npm install --global eas-cli
```

グローバルインストールを避ける場合は、各コマンドを `npx eas-cli@latest ...` で実行できます。

初回セットアップ:

```bash
cd mobile
npm install
eas login
eas build:configure
```

`build:configure` 実行時にExpo project IDが `app.json` へ追加される場合があります。Expoアカウントにログインした状態で、生成された差分を確認してください。

内部配布ビルド:

```bash
cd mobile
npm run typecheck
eas build --platform android --profile preview
```

このコマンドはExpoのクラウドビルドを開始し、Expoアカウント、署名情報、ネットワーク接続を使います。実行前に `mobile/eas.json` の `preview.env.EXPO_PUBLIC_API_BASE_URL` が接続したいNext.js APIを指していることを確認してください。

iOSの内部配布ビルド:

```bash
cd mobile
eas device:create
eas build --platform ios --profile preview
```

iOSの内部配布はApple Developer Programと実機UDIDの登録が必要です。まずAndroidで確認し、iOSはテスター端末を登録してから実行してください。

ビルド完了後、EAS CLIまたはExpo Dashboardに表示されるBuild URLをスマホで開きます。AndroidはAPKをダウンロードしてインストールします。初回はAndroid側で「不明なアプリのインストール」を許可する必要があります。iOSは登録済み端末でBuild URLを開き、案内に従ってIPAをインストールします。

EAS Build profile:

| Profile | 用途 | 配布 | API URL |
| --- | --- | --- | --- |
| `development` | 開発確認用の内部配布ビルド | internal / Android APK | `https://next-prisma-memo.vercel.app` |
| `preview` | Android実機テスター向け内部配布 | internal / Android APK | `https://next-prisma-memo.vercel.app` |
| `production` | 将来のストア提出向け | store / Android AAB | `https://next-prisma-memo.vercel.app` |

よくあるエラーと対処:

| エラー / 症状 | 対処 |
| --- | --- |
| `EXPO_PUBLIC_API_BASE_URL が設定されていません。` | `mobile/.env` または `mobile/eas.json` の該当profileに `EXPO_PUBLIC_API_BASE_URL` を設定し、Expoを再起動します。 |
| 実機で `localhost` に接続できない | `localhost` はスマホ自身を指します。Expo Goのローカル確認では `http://<PCのLAN IP>:3000` を使います。EAS previewでは公開済みAPI URLを使います。 |
| 401が返る / ログイン状態が戻る | access token期限切れ時はrefresh token rotationで再発行します。refresh失敗時はSecureStoreの保存トークンを削除して再ログインしてください。 |
| APKを開けない | Android端末の設定で、ダウンロード元ブラウザからの不明なアプリのインストールを許可します。 |
| `eas: command not found` | `npm install --global eas-cli` を実行するか、`npx eas-cli@latest build --platform android --profile preview` を使います。 |
| `Project not configured` | `cd mobile && eas build:configure` を実行し、`app.json` の `extra.eas.projectId` と `eas.json` を確認します。 |
| Expoアカウントやcredentialsで止まる | `eas login` 後に再実行します。Android keystoreはEASに自動生成・管理させる運用で問題ありません。 |

## モバイル版の機能

- メールアドレス + パスワードログイン
- access token + refresh token認証
- 保存済みトークンによるログイン状態の復元
- メモ一覧、詳細、作成、編集、削除
- 作成/編集画面の自動保存
- タイトル、本文、タグでの検索
- 自分/共有/公開/非公開フィルター
- 更新日順、作成日順、タイトル順の並び替え
- タグ表示
- Todo形式メモの表示・編集
- TodoItemはAPIと型のみ対応中。普通のTodoは `dueAt: null`、期限付きTodoは日時ありで扱います
- ログイン後のExpo Push Token登録とTodoリマインダー通知
- 共有通知の一覧API
- メモ本文のコピー
- 共有されたメモの一覧・詳細表示
- 共有メモのviewer / editorバッジ表示
- ownerによる共有相手の追加、権限変更、共有解除
- viewerは閲覧のみ
- editorは閲覧と編集が可能
- ownerのみ削除と共有設定変更が可能
- AI Assistant
  - タイトル生成
  - タグ生成
  - 要約追加
  - リライト追加
  - 改善リライト
  - 次のアイデア生成
- アカウント削除

アカウント削除は確認ダイアログで実行します。削除後は保存済みaccess token / refresh tokenを消去し、ログアウト状態に戻します。

## 利用するAPI

API呼び出しでは次のヘッダーを付けます。

```http
Authorization: Bearer <accessToken>
```

ログイン成功時は `accessToken` と `refreshToken` を受け取り、どちらもExpo SecureStoreに保存します。通常のAPIリクエストではaccess tokenのみを使い、401が返った場合は `/api/mobile/auth/refresh` にrefresh tokenを送って新しいaccess token / refresh tokenへ入れ替えます。refreshに失敗した場合は保存済みトークンを削除してログアウト状態に戻します。

| Method | Path | 内容 |
| --- | --- | --- |
| `POST` | `/api/mobile/auth/login` | ログイン |
| `POST` | `/api/mobile/auth/refresh` | refresh tokenを検証し、token rotationを行う |
| `POST` | `/api/mobile/auth/logout` | ApiSessionを失効 |
| `GET` | `/api/mobile/posts` | 自分のメモと共有メモの一覧 |
| `POST` | `/api/mobile/posts` | メモ作成 |
| `GET` | `/api/mobile/posts/[id]` | メモ詳細 |
| `PATCH` | `/api/mobile/posts/[id]` | メモ更新 |
| `DELETE` | `/api/mobile/posts/[id]` | メモ削除 |
| `GET` | `/api/mobile/posts/[id]/todos` | TodoItem一覧 |
| `POST` | `/api/mobile/posts/[id]/todos` | TodoItem追加（`dueAt: null` で普通のTodo、日時ありで期限付きTodo） |
| `PATCH` | `/api/mobile/posts/[id]/todos/[todoId]` | TodoItem更新 |
| `DELETE` | `/api/mobile/posts/[id]/todos/[todoId]` | TodoItem削除 |
| `GET` | `/api/mobile/posts/[id]/shares` | 共有一覧 |
| `POST` | `/api/mobile/posts/[id]/shares` | 共有相手を追加 |
| `PATCH` | `/api/mobile/posts/[id]/shares/[shareId]` | 共有権限を変更 |
| `DELETE` | `/api/mobile/posts/[id]/shares/[shareId]` | 共有解除 |
| `GET` | `/api/mobile/notifications` | 自分宛て通知一覧 |
| `POST` | `/api/mobile/push-subscriptions` | Expo Push Token登録 |
| `DELETE` | `/api/mobile/push-subscriptions` | Expo Push Token無効化 |
| `POST` | `/api/mobile/push-subscriptions/test` | テスト通知送信。productionでは `ENABLE_PUSH_TEST_API=true` のときだけ有効 |
| `POST` | `/api/mobile/ai/generate` | AI生成 |
| `DELETE` | `/api/mobile/account` | アカウント削除 |

権限チェックはモバイルUIだけではなく、Next.js側のAPIでも行います。

## モバイル版の制限

- Google / GitHubログインは未対応
- access tokenは15分、refresh tokenは30日
- 公開メモ全体の閲覧はWeb版中心で、モバイルAPIは自分のメモと共有メモを返す設計
- TodoItemはAPIと型のみ対応中。モバイル版の専用画面は未対応で、画面操作はWeb版優先
- ストア配布は未運用。EAS BuildのAndroid内部配布のみ設定済み
- 共有通知はアプリ内通知レコードと一覧APIまで対応。共有時Push送信は未実装
- 画像添付は未実装
- モバイル版の単体テストとE2Eテストは未整備

現在のモバイル向け検証コマンドはTypeScriptの型チェックです。

```bash
npm run typecheck
```

## Web版との違い

| 項目 | Web版 | モバイル版 |
| --- | --- | --- |
| 実装 | Next.js / React | Expo / React Native |
| 認証 | Auth.js / NextAuth | access token + refresh token |
| OAuth | Google / GitHub対応 | 未対応 |
| データ取得 | Server Actions / Route Handlers | `/api/mobile/*` |
| トークン保存 | NextAuth管理 | Expo SecureStore |
| 公開メモ | 公開メモも閲覧対象 | 自分のメモと共有メモが中心 |
| AI機能 | 編集画面・詳細画面 | AI Assistantパネル |
| 配布 | Vercel | Expo Go / EAS Build内部配布 |

## 注意

Node.js v24系の環境では、Expo CLIが `ERR_SOCKET_BAD_PORT` で起動に失敗する場合があります。その場合はExpoが対応しているLTS系Node.jsで確認してください。

ルートの `.env` / `.env.test` と同様に、`mobile/.env` もコミットしないでください。
