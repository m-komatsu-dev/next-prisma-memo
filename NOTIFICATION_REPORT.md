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

## 2026-06-05 通知一覧・既読管理UX改善

### 追加内容

- Webヘッダーに `/notifications` への通知リンクを追加し、ログイン中ユーザーの未読件数バッジを表示するようにしました。
- Web版 `/notifications` ページを追加し、`title`, `body`, `createdAt`, 未読/既読状態、空状態、「すべて既読にする」を表示しました。
- Web通知クリック時は `/api/notifications/[id]/read` で既読化してから、関連メモがある場合は `/posts/[postId]` に遷移します。
- mobile版に通知タブとメモ一覧ヘッダーの通知ボタンを追加し、未読件数、通知一覧、pull-to-refresh、再読み込み、「すべて既読にする」を追加しました。
- mobile通知タップ時は `/api/mobile/notifications/[id]/read` で既読化してから、関連メモ詳細へ遷移します。
- 通知取得・未読数・単体既読・全既読処理を `lib/notifications.ts` に整理し、Web APIとmobile APIで共通利用するようにしました。
- Web APIとして `/api/notifications`, `/api/notifications/[id]/read`, `/api/notifications/read-all` を追加しました。
- mobile APIとして既存 `/api/mobile/notifications` を活かしつつ、`/api/mobile/notifications/[id]/read`, `/api/mobile/notifications/read-all` を追加しました。
- `notificationIdValueSchema` を追加し、通知IDパラメータをZodで検証します。
- `Notification` テーブル既存カラムで実装できたため、新規migrationは追加していません。

### セキュリティ・認可

- 通知一覧、未読数、単体既読、全既読はすべてログイン中ユーザーの `userId` を条件にしています。
- 単体既読は `id` だけでは更新せず、`where: { id, userId }` の `updateMany` で更新します。他人の通知IDを指定しても更新されません。
- 未ログイン時は通知APIを401で拒否します。
- 既存のmobile auth、OAuth、PushSubscription、共有通知作成、Todo通知処理は変更範囲を分けて維持しています。

### 確認済み項目

- `npm run test`: 19 files / 125 tests passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:e2e`: 初回はsandbox内の `0.0.0.0:3000` listen権限で失敗、権限付き再実行で5 tests passed.
- `npm audit --audit-level=high`: 初回はネットワーク制限で失敗、権限付き再実行で `found 0 vulnerabilities`.
- `mobile && npm install`: up to date.
- `mobile && npx expo-doctor`: 初回はネットワーク制限で失敗、権限付き再実行で18/18 checks passed.
- `mobile && npm run typecheck`: passed.
- 追加unit testで、通知一覧取得、未読件数取得、自分の通知の既読化、他人通知の既読化拒否、全既読、未ログイン拒否、通知クリック先URL生成を確認しました。
- 既存unit testで、共有通知作成、Todo通知、mobile OAuth、メールログイン関連が引き続き通ることを確認しました。

### EAS Build枠回復後に確認する項目

- iOS/Android実機でPush通知受信からアプリ内通知一覧の未読件数が期待通りに更新されること。
- Push通知タップから該当メモ詳細へ遷移できること。
- アプリ起動中、バックグラウンド、終了状態それぞれで通知タップ後の既読化が期待通り動くこと。
- Expo Push Token登録、revoke、再ログイン後の再登録が実機で維持されること。
