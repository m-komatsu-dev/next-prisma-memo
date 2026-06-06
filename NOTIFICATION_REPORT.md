# Notifications

通知は Todo リマインダーの Push 通知と、共有時のアプリ内通知に分けています。

## Todo Reminders

- `TodoItem` は `dueAt`、`reminderAt`、`reminderSentAt` を持ちます。
- `reminderAt` が未指定で未来の `dueAt` がある場合、期限の1時間前を既定のリマインダー時刻として保存します。
- Cron は `reminderAt <= now`、`completed = false`、`reminderSentAt = null` の Todo だけを対象にします。
- Push 送信後に `reminderSentAt` を更新し、同じ Todo への重複送信を避けます。

Cron endpoint は `GET /api/cron/send-todo-reminders` です。認証は header のみです。

```text
Authorization: Bearer <CRON_SECRET>
x-cron-secret: <CRON_SECRET>
```

`?secret=...` の query 認証は使いません。

## Push Tokens

- Push Token 登録 API はログイン必須です。
- active な他ユーザーの Expo Push Token は上書きできません。
- DELETE はログイン中ユーザーに紐づく token だけを revoke します。
- `EXPO_ACCESS_TOKEN` はサーバー側だけで使います。

## App Notifications

`Notification` テーブルを使い、共有時に `post_shared` 通知を作成します。既存の共有データについては `20260605010000_backfill_post_share_notifications` で通知を補完しています。

Web と mobile のどちらにも通知一覧、未読件数、単体既読、全既読の API があります。既読化は `id` だけでは更新せず、ログイン中ユーザーの `userId` も条件に入れています。

## Environment

| 変数 | 用途 |
| --- | --- |
| `CRON_SECRET` | Todo リマインダー Cron の認証 |
| `EXPO_ACCESS_TOKEN` | Expo Push API のサーバー認証 |
| `ENABLE_PUSH_TEST_API` | production でテスト通知 API を有効にする場合だけ使用 |
| `EXPO_PUBLIC_API_BASE_URL` | mobile から接続する公開 API URL |

Bearer token、refresh token、Push Token、DB URL、secret はレスポンスやログに出さない方針です。mobile には `EXPO_PUBLIC_` 以外の secret を置きません。
