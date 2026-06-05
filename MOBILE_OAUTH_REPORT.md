# Mobile OAuth Report

## Overview

- Mobile Google/GitHub login uses the external browser through Expo WebBrowser, not an in-app WebView.
- The mobile app opens `/api/mobile/oauth/start?provider=google|github`.
- NextAuth completes provider login and returns to `/mobile/oauth/complete`.
- `/mobile/oauth/complete` issues a short-lived one-time code and redirects to `mymemo://auth/callback?code=...`.
- The raw one-time code is never stored in the database. Only its SHA-256 hash is stored in `MobileOAuthCode`.
- The mobile app posts the code to `/api/mobile/oauth/exchange`, receives mobile `accessToken` and `refreshToken`, and saves them in SecureStore.

## Environment

Next.js:

```env
AUTH_URL="https://your-web-origin.example"
AUTH_SECRET="replace-with-a-long-random-secret"
MOBILE_AUTH_SECRET="replace-with-a-long-random-mobile-secret"
MOBILE_OAUTH_CALLBACK_URL="mymemo://auth/callback"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"
```

Mobile:

```env
EXPO_PUBLIC_API_BASE_URL="https://your-web-origin.example"
EXPO_PUBLIC_MOBILE_OAUTH_CALLBACK_URL="mymemo://auth/callback"
```

Do not put server secrets in `mobile/.env`. `EXPO_PUBLIC_` values are bundled into the app.

## Provider Redirect URLs

Configure the web OAuth callback URLs for Auth.js:

- Google: `https://your-web-origin.example/api/auth/callback/google`
- GitHub: `https://your-web-origin.example/api/auth/callback/github`

The mobile deep link is handled after Auth.js returns to the web app, so provider consoles should use the web callback URLs above.

## Verification Steps

1. Apply the Prisma migration and generate the client.
2. Set the environment variables above with real provider credentials.
3. Run the web app and the mobile app with matching public base URLs.
4. Tap `Googleで続ける` or `GitHubで続ける`.
5. Confirm the browser opens outside the app, provider login completes, and the app returns through `mymemo://auth/callback`.
6. Confirm the app reaches the memo list and push token registration runs as it does after email/password login.
7. Confirm the one-time code cannot be exchanged twice and expired/invalid codes are rejected.

## Current Limitation

EAS Build free quota is exhausted, so final real-device confirmation for production builds is intentionally pending until the next build window. Local unit/build checks can verify the code path, but native deep link behavior in the final signed build still needs device confirmation.
