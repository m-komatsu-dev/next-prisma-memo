# E2E

Playwright で Web 版の基本フローを確認します。対象ファイルは `tests/e2e/memo-flow.spec.ts` です。

## Coverage

- 未ログイン状態で `/posts` にアクセスするとログイン画面へ戻る
- `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` でログインする
- メモ一覧を表示する
- 通常メモを作成する
- Todo リストを作成する
- メモ詳細を表示する
- メモを編集する
- メモを削除する
- ログアウトする

`playwright.config.ts` では global setup / teardown を使います。setup はテストユーザーを作成し、teardown はテストユーザーと E2E で作ったデータを削除します。

## Run Locally

本番ではない PostgreSQL を `DATABASE_URL` に設定してから実行します。

```bash
npm ci
npx prisma migrate deploy
npx playwright install chromium
cp .env.test.example .env.test
npm run test:e2e
```

`.env.test` には実 password や secret を入れますが、ファイル自体はコミットしません。

```env
E2E_TEST_EMAIL="e2e-user@example.invalid"
E2E_TEST_PASSWORD="replace-with-a-local-test-password"
```

UI mode:

```bash
npm run test:e2e:ui
npm run test:e2e:headed
```

## Required Variables

| 変数 | 用途 |
| --- | --- |
| `DATABASE_URL` | E2E 用 DB |
| `AUTH_SECRET` | Auth.js |
| `AUTH_URL` | `http://localhost:3000` |
| `AUTH_TRUST_HOST` | `true` |
| `E2E_TEST_EMAIL` | テストユーザー |
| `E2E_TEST_PASSWORD` | テストユーザーの password |
| `MOBILE_AUTH_SECRET` | build / unit test 用 |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | build 用 |

## Test Data

E2E で作るメモと Todo のタイトルには `e2e-` prefix を付けます。`E2E_TEST_EMAIL` に `e2e-` が含まれない場合、setup / teardown は停止します。本番 DB を `DATABASE_URL` に指定しないでください。

## Scope

OAuth、共有権限、AI 補助、Todo カレンダー、モバイル API のブラウザ外フローは現在の E2E 対象外です。必要になった時点で、既存の基本フローとは別 spec として追加します。
