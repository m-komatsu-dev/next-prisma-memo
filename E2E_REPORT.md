# E2E Report

## 追加したE2Eテスト

Playwrightで `tests/e2e/memo-flow.spec.ts` を追加し、Chromium上で以下の主要フローを確認します。

- 未ログイン状態では `/posts` にアクセスできず、トップページのログイン画面へ戻る
- `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` のユーザーでログインできる
- ログイン後にメモ一覧を表示できる
- 通常メモを新規作成できる
- Todoリストを新規作成できる
- メモ詳細を表示できる
- メモを編集できる
- メモを削除できる
- ログアウトできる

`playwright.config.ts` では `tests/e2e/global-setup.ts` と `tests/e2e/global-teardown.ts` を設定しています。global setupはテストユーザーを作成し、global teardownはテストユーザーとE2Eで作成したデータを削除します。

## ローカルでの実行方法

本番ではないPostgreSQLを `DATABASE_URL` に設定し、必要に応じてマイグレーションを適用します。

```bash
npm ci
npx prisma migrate deploy
npx playwright install chromium
cp .env.test.example .env.test
npm run test:e2e
```

`.env.test` には以下を設定します。実パスワードやsecretはコミットしません。

```env
E2E_TEST_EMAIL="e2e-user@example.invalid"
E2E_TEST_PASSWORD="replace-with-a-local-test-password"
```

UIモードやブラウザ表示ありで確認する場合:

```bash
npm run test:e2e:ui
npm run test:e2e:headed
```

## GitHub Actionsでの実行方法

`.github/workflows/ci.yml` のQuality checksで以下を実行します。

- `npm run test`
- `npm run lint`
- `npm run build`
- `npx playwright install --with-deps chromium`
- `npm run test:e2e`

CIではPostgreSQLサービスコンテナに対して `npx prisma migrate deploy` を実行し、そのDBをE2Eに使います。E2Eに必要なメールアドレスとパスワードはGitHub Secretsから渡します。

## 必要な環境変数

- `DATABASE_URL`: E2E専用またはCI専用PostgreSQLへの接続文字列
- `AUTH_SECRET`: Auth.js用secret
- `AUTH_URL`: `http://localhost:3000`
- `AUTH_TRUST_HOST`: `true`
- `E2E_TEST_EMAIL`: テストユーザーのメールアドレス。誤削除防止のため `e2e-` を含める
- `E2E_TEST_PASSWORD`: テストユーザーのパスワード
- `MOBILE_AUTH_SECRET`: CIの既存unit/build用
- `GEMINI_API_KEY` / `GEMINI_MODEL`: build用の値

## Rate limitとの関係

Rate limitは無効化していません。E2Eはglobal setupで作成した正しい認証情報を使って通常のログイン画面からログインするため、失敗ログインを連発しません。

本番コードに認証回避のバックドアやE2E専用ログインAPIは追加していません。テストユーザー作成・削除はPlaywright実行プロセスからPrismaで行い、アプリの認証・認可・Rate limitの実装はそのまま通します。

## テストデータ

E2Eで作成するメモ/Todoタイトルは `e2e-` prefixを付けています。global teardownでは `E2E_TEST_EMAIL` のユーザーを削除するため、そのユーザーに紐づくPost/Todo/Sessionなどはcascadeで削除されます。孤立しうる `e2e-` prefixのTagも削除します。

安全のため、`E2E_TEST_EMAIL` に `e2e-` が含まれない場合はsetup/teardownを停止します。本番データベースを `DATABASE_URL` に指定しないでください。

## 残っているE2E課題

- OAuthログイン、共有権限、AI補助、Todoカレンダー、モバイルAPIのブラウザ外フローは今回の最小E2E対象外です。
- 現在のPlaywright projectはChromiumのみです。必要に応じてFirefox/WebKitを追加できます。
- CIのPR実行ではGitHub Secretsが渡らない設定のリポジトリではE2Eが失敗します。fork PRを受ける運用では、E2Eだけ条件分岐するか、CI用の固定ダミーcredentialを別途安全に用意してください。
