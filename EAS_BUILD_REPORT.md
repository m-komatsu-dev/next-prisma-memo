# EAS Build

`mobile/eas.json` に Expo の build profile を定義しています。

## Profiles

| Profile | 用途 | Android artifact | 配布 |
| --- | --- | --- | --- |
| `development` | 開発確認用 | APK | internal |
| `preview` | Android 実機確認用 | APK | internal |
| `production` | ストア配信用 | AAB | store |

`development` と `preview` は Android 実機へ配布しやすいように APK を生成します。`production` は Android App Bundle を生成します。

## Public Config

EAS profile では次の公開値を設定しています。

```env
EXPO_PUBLIC_API_BASE_URL="https://next-prisma-memo.vercel.app"
```

ローカルでは `mobile/.env` で接続先を切り替えます。

```env
# iOS Simulator
EXPO_PUBLIC_API_BASE_URL="http://localhost:3000"

# Android Emulator
EXPO_PUBLIC_API_BASE_URL="http://10.0.2.2:3000"

# Physical device
EXPO_PUBLIC_API_BASE_URL="http://<your-pc-lan-ip>:3000"
```

mobile 側には次の値を置きません。

- `GEMINI_API_KEY`
- `DATABASE_URL`
- `AUTH_SECRET`
- `MOBILE_AUTH_SECRET`
- `CRON_SECRET`
- OAuth client secret
- 固定の access token / refresh token

## Build

初回:

```bash
cd mobile
npm install
npm install --global eas-cli
eas login
eas build:configure
```

Android preview build:

```bash
cd mobile
npm run typecheck
eas build --platform android --profile preview
```

グローバルインストールを避ける場合は `npx eas-cli@latest` を使います。

## Notes

- `EXPO_PUBLIC_API_BASE_URL` は公開 URL として扱います。
- Gemini API key や DB URL は Next.js API 側の環境変数で管理します。
- アプリは `/api/mobile/*` を呼び、ログイン後に受け取った token を Expo SecureStore に保存します。
- iOS の内部配布には Apple Developer Program、端末 UDID、provisioning profile が必要です。
- CI で EAS Build を自動化する場合、Expo access token は CI secret として管理します。
