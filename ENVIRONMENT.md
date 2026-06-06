# Environment

`.env` は Git に入れません。実値はローカル環境またはホスティング側の環境変数として管理します。

## Local Web

プロジェクトルートに `.env` を作成します。

```env
DATABASE_URL="<postgres-connection-url>"
AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"

MOBILE_AUTH_SECRET="replace-with-a-long-random-mobile-secret"
MOBILE_OAUTH_CALLBACK_URL="mymemo://auth/callback"
DATABASE_POOL_MAX="5"
CRON_SECRET="replace-with-a-long-random-cron-secret"
EXPO_ACCESS_TOKEN="optional-expo-server-access-token"
ENABLE_PUSH_TEST_API="false"

AUTH_GOOGLE_ID="your-local-google-client-id"
AUTH_GOOGLE_SECRET="your-local-google-client-secret"
AUTH_GITHUB_ID="your-local-github-client-id"
AUTH_GITHUB_SECRET="your-local-github-client-secret"

GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"
```

`AUTH_URL` は origin のみを指定します。ローカルで `npm run dev` を使う場合は `http://localhost:3000` です。`/api/auth` などの path は含めません。

Google / GitHub ログインを使う場合、OAuth provider 側の callback URL は次の形式にします。

```text
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/auth/callback/github
```

GitHub OAuth App は callback URL を1つしか持てないため、本番でも GitHub ログインを使う場合はローカル用に別の OAuth App を作ります。

## Production Web

本番では `.env` をアップロードせず、ホスティング側に環境変数を設定します。

```env
DATABASE_URL="<postgres-connection-url>"
AUTH_SECRET="production-long-random-secret"
AUTH_URL="https://your-production-origin.example"
AUTH_TRUST_HOST="true"

MOBILE_AUTH_SECRET="production-long-random-mobile-secret"
MOBILE_OAUTH_CALLBACK_URL="mymemo://auth/callback"
DATABASE_POOL_MAX="1"
CRON_SECRET="production-long-random-cron-secret"
EXPO_ACCESS_TOKEN="optional-expo-server-access-token"
ENABLE_PUSH_TEST_API="false"

AUTH_GOOGLE_ID="your-production-google-client-id"
AUTH_GOOGLE_SECRET="your-production-google-client-secret"
AUTH_GITHUB_ID="your-production-github-client-id"
AUTH_GITHUB_SECRET="your-production-github-client-secret"

GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"
```

`AUTH_SECRET` と `MOBILE_AUTH_SECRET` はローカルと本番で分けます。`CRON_SECRET` は URL query に入れず、header で送ります。

## Cron

Todo reminder Cron は次の header を受け付けます。

```text
Authorization: Bearer <CRON_SECRET>
x-cron-secret: <CRON_SECRET>
```

`/api/cron/send-todo-reminders?secret=...` は認証に使いません。

## Mobile

Expo を動かす場合は `mobile/.env` を作成します。

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_MOBILE_OAUTH_CALLBACK_URL=mymemo://auth/callback
```

実機からローカルサーバーに接続する場合、`localhost` ではなく PC の LAN IP を使います。

`EXPO_PUBLIC_` で始まる値はアプリに埋め込まれます。secret、token、DB URL、API key は mobile 側に置きません。

## Login Checklist

- `AUTH_URL` がブラウザの origin と一致している。
- `AUTH_SECRET` が設定され、意図せず変更されていない。
- `AUTH_TRUST_HOST=true` が設定されている。
- `DATABASE_URL` が対象の DB を指している。
- Credentials ユーザーは `User.password` に bcrypt hash を持っている。
- OAuth のみのユーザーは `User.password = null` で、元の OAuth provider からログインする。
- `AUTH_URL` や `AUTH_SECRET` を変更した後は、古い origin の cookie を削除する。
