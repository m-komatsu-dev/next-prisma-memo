# Notification Report

## 現状確認

- `TodoItem` は `dueAt`, `reminderAt`, `reminderSentAt` を持ち、通知済み判定は `reminderSentAt` で行います。
- `PushSubscription` はUserに紐づくExpo Push Tokenを保存し、`revokedAt` で無効化します。
- `/api/cron/send-todo-reminders` は `Authorization: Bearer <CRON_SECRET>` または `x-cron-secret` のheader認証のみを受け付けます。query secret方式は使いません。
- mobile側はログイン後に `expo-notifications` で通知許可を求め、Expo Push Tokenをサーバーに登録します。

## 実装内容

- `reminderAt` 未指定で未来の `dueAt` があるTodoは、期限1時間前を既定リマインダー時刻として保存します。期限まで1時間未満なら即時対象、期限切れは自動補完しません。
- Cronは `reminderAt <= now`, `completed=false`, `reminderSentAt=null` のTodoだけを対象にし、Push送信後に `reminderSentAt` を更新して重複送信を防ぎます。
- Push Token登録APIは認証必須です。activeな他ユーザーのExpo Push Tokenは上書き登録できません。DELETEもログイン中ユーザーのtokenだけをrevokeします。
- `Notification` テーブルを追加し、`PostShare` 作成/更新時に共有されたユーザー向けの `post_shared` 通知を作成します。
- `20260605010000_backfill_post_share_notifications` で、既存の `PostShare` に対応する共有通知が無い場合も `post_shared` 通知を補完します。
- `/api/mobile/notifications` でログイン中ユーザーの通知一覧を取得できます。

## 環境変数

- `CRON_SECRET`: Todo通知Cronのheader認証に使います。
- `EXPO_ACCESS_TOKEN`: Expo Push APIのサーバー認証に使う任意値です。mobile側には置きません。
- `ENABLE_PUSH_TEST_API`: productionでテスト通知APIを有効化する場合だけ `true` にします。
- `EXPO_PUBLIC_API_BASE_URL`: mobile側に置く公開API URLです。secretではありません。

## 安全性

- Bearer token、refresh token、Push Token、DB URL、secretはレスポンスやログに出さない方針を維持しています。
- mobileには `EXPO_PUBLIC_` 以外のsecretを置きません。
- Cron認証はheader方式のみです。
