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
- 自分のメモと共有されたメモを同じ一覧で扱う
- 共有メモはowner/editor/viewerの権限に応じて閲覧・編集・削除・共有設定変更を制御
- アカウント削除は確認ダイアログで確定し、削除後はログアウト状態に戻る

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
- アカウント削除
- 作成/編集画面の自動保存
- タイトル、本文、タグでの検索
- 自分/共有/公開/非公開フィルター
- 更新日順、作成日順、タイトル順の並び替え
- タグ表示
- Todo形式メモの表示・編集
- 共有されたメモの一覧・詳細表示
- 共有メモのviewer/editorバッジ表示
- ownerによる共有相手の追加、viewer/editorの権限変更、共有解除
- viewerは閲覧のみ
- editorは閲覧と編集が可能
- ownerのみ削除と共有設定変更が可能
- AI Assistant
  - タイトル生成
  - タグ生成
  - 要約追加
  - リライト追加

アカウント削除は `DELETE` 文字列を入力する方式ではなく、確認ダイアログで実行します。削除するとユーザー、ログイン連携、セッション、作成したメモなどの関連データが削除され、保存済みアクセストークンも消去されます。

## 利用するAPI

| Method | Path | 内容 |
| --- | --- | --- |
| `POST` | `/api/mobile/auth/login` | ログイン |
| `GET` | `/api/mobile/posts` | メモ一覧 |
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

API呼び出しでは次のヘッダーを付けます。

```http
Authorization: Bearer <accessToken>
```

## 共有メモの権限

| Role | 閲覧 | 編集 | 削除 | 共有設定変更 |
| --- | --- | --- | --- | --- |
| owner | ○ | ○ | ○ | ○ |
| editor | ○ | ○ | - | - |
| viewer | ○ | - | - | - |

`GET /api/mobile/posts` は自分のメモと自分に共有されたメモを返します。共有メモには `accessRole` が含まれ、モバイルUIはその値に応じて編集・削除・共有ボタンを出し分けます。

権限チェックはUIだけではなくNext.js側のモバイルAPIでも行います。非共有ユーザーは非公開メモを閲覧できません。viewerは更新できず、editorは削除や共有設定変更ができません。共有解除後は共有先ユーザーの一覧・詳細から対象メモが見えなくなります。

## モバイル版の現在の制限

- Google/GitHubログインは未対応
- refresh token / ApiSession は未実装
- アクセストークンは現在 `12h` の短期Bearer Token
- ストア配布やEAS Buildは未対応
- カレンダー、リマインダーは未実装
- GitHub Actionsやテスト強化は今後の改善予定

## 注意

Node.js v24系の環境では、Expo CLIが `ERR_SOCKET_BAD_PORT` で起動に失敗する場合があります。その場合はExpoが対応しているLTS系Node.jsで確認してください。
