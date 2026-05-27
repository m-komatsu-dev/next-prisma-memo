# My Memo Mobile

`mobile/` はMy Memo AppのExpo / React Nativeアプリです。Next.js側の `/api/mobile/*` APIへ接続し、Web版と同じPostgreSQL上のメモデータを利用します。

プロジェクト全体の概要、Web版、DB、デプロイ、テスト構成についてはルートの [README.md](../README.md) を参照してください。

## Expoアプリ概要

- Expo + React Native + TypeScript
- Next.js APIを利用するモバイルクライアント
- メールアドレス + パスワードログイン
- Bearer Token認証
- アクセストークンをExpo SecureStoreに保存
- 自分のメモと共有されたメモを一覧表示
- owner / editor / viewerの権限に応じて操作を制御
- Gemini APIはモバイル側から直接呼ばず、Next.js API経由で実行
- Expo Goでの確認を想定

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

本番Vercel環境へ接続する場合:

```env
EXPO_PUBLIC_API_BASE_URL=https://todo-text-memo.vercel.app
```

`.env` を変更したあとは、Expo開発サーバーを再起動してください。`mobile/.env` はローカル接続先を含むため、コミットしないでください。

## Expo Goでの確認方法

1. ルートで `npm run dev` を実行し、Next.js APIを起動する
2. `mobile/.env` の `EXPO_PUBLIC_API_BASE_URL` を接続先に合わせる
3. `cd mobile && npm run start` を実行する
4. 表示されたQRコードをExpo Goで読み取る
5. 実機で確認する場合は、スマホとPCを同じネットワークに接続する

実機では `http://localhost:3000` はスマホ自身を指します。PC上のNext.jsへ接続するには、`http://<PCのIPアドレス>:3000` を使います。

## モバイル版の機能

- メールアドレス + パスワードログイン
- Bearer Token認証
- 保存済みトークンによるログイン状態の復元
- メモ一覧、詳細、作成、編集、削除
- 作成/編集画面の自動保存
- タイトル、本文、タグでの検索
- 自分/共有/公開/非公開フィルター
- 更新日順、作成日順、タイトル順の並び替え
- タグ表示
- Todo形式メモの表示・編集
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

アカウント削除は確認ダイアログで実行します。削除後は保存済みアクセストークンを消去し、ログアウト状態に戻します。

## 利用するAPI

API呼び出しでは次のヘッダーを付けます。

```http
Authorization: Bearer <accessToken>
```

| Method | Path | 内容 |
| --- | --- | --- |
| `POST` | `/api/mobile/auth/login` | ログイン |
| `GET` | `/api/mobile/posts` | 自分のメモと共有メモの一覧 |
| `POST` | `/api/mobile/posts` | メモ作成 |
| `GET` | `/api/mobile/posts/[id]` | メモ詳細 |
| `PATCH` | `/api/mobile/posts/[id]` | メモ更新 |
| `DELETE` | `/api/mobile/posts/[id]` | メモ削除 |
| `GET` | `/api/mobile/posts/[id]/shares` | 共有一覧 |
| `POST` | `/api/mobile/posts/[id]/shares` | 共有相手を追加 |
| `PATCH` | `/api/mobile/posts/[id]/shares/[shareId]` | 共有権限を変更 |
| `DELETE` | `/api/mobile/posts/[id]/shares/[shareId]` | 共有解除 |
| `POST` | `/api/mobile/ai/generate` | AI生成 |
| `DELETE` | `/api/mobile/account` | アカウント削除 |

権限チェックはモバイルUIだけではなく、Next.js側のAPIでも行います。

## モバイル版の制限

- Google / GitHubログインは未対応
- refresh token / ApiSessionは未実装
- アクセストークンは現在12時間の短期Bearer Token
- 公開メモ全体の閲覧はWeb版中心で、モバイルAPIは自分のメモと共有メモを返す設計
- ストア配布やEAS Buildは未対応
- カレンダー、リマインダー、画像添付は未実装
- モバイル版の単体テストとE2Eテストは未整備

現在のモバイル向け検証コマンドはTypeScriptの型チェックです。

```bash
npm run typecheck
```

## Web版との違い

| 項目 | Web版 | モバイル版 |
| --- | --- | --- |
| 実装 | Next.js / React | Expo / React Native |
| 認証 | Auth.js / NextAuth | Bearer Token |
| OAuth | Google / GitHub対応 | 未対応 |
| データ取得 | Server Actions / Route Handlers | `/api/mobile/*` |
| トークン保存 | NextAuth管理 | Expo SecureStore |
| 公開メモ | 公開メモも閲覧対象 | 自分のメモと共有メモが中心 |
| AI機能 | 編集画面・詳細画面 | AI Assistantパネル |
| 配布 | Vercel | Expo Goでの確認を想定 |

## 注意

Node.js v24系の環境では、Expo CLIが `ERR_SOCKET_BAD_PORT` で起動に失敗する場合があります。その場合はExpoが対応しているLTS系Node.jsで確認してください。

ルートの `.env` / `.env.test` と同様に、`mobile/.env` もコミットしないでください。
