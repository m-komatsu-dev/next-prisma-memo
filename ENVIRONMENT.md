# Environment Variables

This app uses Auth.js, Prisma, PostgreSQL, and Expo. Keep real `.env` files out of Git.

## Local Web

Create `.env` in the project root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"

MOBILE_AUTH_SECRET="replace-with-a-long-random-mobile-secret"
DATABASE_POOL_MAX="5"
CRON_SECRET="replace-with-a-long-random-cron-secret"

AUTH_GOOGLE_ID="your-local-google-client-id"
AUTH_GOOGLE_SECRET="your-local-google-client-secret"
AUTH_GITHUB_ID="your-local-github-client-id"
AUTH_GITHUB_SECRET="your-local-github-client-secret"

GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"
```

- `AUTH_URL` must be `http://localhost:3000` when running `npm run dev` locally.
- Do not include `/api/auth` or any path in `AUTH_URL`.
- `AUTH_SECRET` must stay stable while testing login sessions locally. Changing it invalidates existing Auth.js cookies.
- `AUTH_TRUST_HOST=true` is required for Auth.js host validation in this setup.
- Google and GitHub OAuth apps must include these local callback URLs when OAuth login is used:
  - `http://localhost:3000/api/auth/callback/google`
  - `http://localhost:3000/api/auth/callback/github`
- GitHub OAuth Apps have a single callback URL. If production also uses GitHub login, create a separate GitHub OAuth App for local development and put its client ID/secret in local `.env`.

## Production Web

Set environment variables in the hosting provider, not by uploading `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
AUTH_SECRET="production-long-random-secret"
AUTH_URL="https://your-production-origin.example"
AUTH_TRUST_HOST="true"

MOBILE_AUTH_SECRET="production-long-random-mobile-secret"
DATABASE_POOL_MAX="1"
CRON_SECRET="production-long-random-cron-secret"

AUTH_GOOGLE_ID="your-production-google-client-id"
AUTH_GOOGLE_SECRET="your-production-google-client-secret"
AUTH_GITHUB_ID="your-production-github-client-id"
AUTH_GITHUB_SECRET="your-production-github-client-secret"

GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"
```

- `AUTH_URL` must be the production origin only, for example `https://memo.example.com`.
- Do not reuse local `AUTH_SECRET` in production.
- Set `CRON_SECRET` in the hosting provider when Todo reminder Cron is enabled. Do not put the secret in the Cron URL query string.
- OAuth provider callback URLs must match the production `AUTH_URL`.

## Cron

Todo reminders run through `GET /api/cron/send-todo-reminders`. Cron authentication only accepts these headers:

```text
Authorization: Bearer <CRON_SECRET>
x-cron-secret: <CRON_SECRET>
```

Do not use `/api/cron/send-todo-reminders?secret=...`. Query secret authentication is intentionally rejected.

## Mobile

Create `mobile/.env` when running Expo:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

Use a LAN URL instead of `localhost` when testing from a physical device that cannot reach the host machine through `localhost`.

## Auth.js Login Checklist

- `AUTH_URL` matches the browser origin exactly.
- `AUTH_SECRET` exists and has not changed unexpectedly.
- `AUTH_TRUST_HOST=true` is present.
- `DATABASE_URL` points to the database where the registered user exists.
- Credentials users have a non-null bcrypt hash in `User.password`.
- OAuth-only users have `User.password = null` and must log in with the original OAuth provider.
- GitHub local login uses a GitHub OAuth App whose callback URL is exactly `http://localhost:3000/api/auth/callback/github`.
- Browser cookies for the old origin are cleared after changing `AUTH_URL` or `AUTH_SECRET`.
