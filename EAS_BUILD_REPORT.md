# EAS Build Report

## 追加した設定

- `mobile/eas.json` にAndroid内部配布向けの `development` / `preview` / `production` profileを整理しました。
- `development` と `preview` は `distribution: "internal"` かつAndroid APK生成にしています。
- `production` は将来のストア提出を想定し、Android App Bundle (`app-bundle`) を生成する設定にしています。
- `mobile/.env.example` にローカル、Android Emulator、Android実機、Preview / production API URLの使い分けを追記しました。
- `mobile/README.md` にEAS CLI、ログイン、configure、Android preview build、実機インストール、よくあるエラーを追記しました。
- `npx expo-doctor` のSDK互換性チェックに合わせて、`mobile/package.json` の `expo` を `~54.0.35` へ更新しました。

## ビルドprofileの説明

| Profile | 用途 | Android artifact | 配布 |
| --- | --- | --- | --- |
| `development` | 開発確認用の内部配布ビルド | APK | internal |
| `preview` | Android実機テスター向け内部配布 | APK | internal |
| `production` | 将来のGoogle Play提出向け | AAB | store |

`preview` はExpo GoなしでAndroid実機へ配布しやすいようにAPKを明示しています。ビルド完了後はEAS Build URLをAndroid端末で開き、APKをダウンロードしてインストールします。

## 必要な環境変数

モバイルアプリに埋め込む公開値:

```env
EXPO_PUBLIC_API_BASE_URL="https://next-prisma-memo.vercel.app"
```

ローカル開発では `mobile/.env` に次のいずれかを設定します。

```env
# iOS Simulator
EXPO_PUBLIC_API_BASE_URL="http://localhost:3000"

# Android Emulator
EXPO_PUBLIC_API_BASE_URL="http://10.0.2.2:3000"

# Android physical device with Expo Go
EXPO_PUBLIC_API_BASE_URL="http://<your-pc-lan-ip>:3000"
```

モバイル側へ置かない値:

- `GEMINI_API_KEY`
- `DATABASE_URL`
- `AUTH_SECRET`
- `MOBILE_AUTH_SECRET`
- `CRON_SECRET`
- OAuth client secret
- access token / refresh tokenの固定値

Gemini API keyやDB URLなどのsecretはNext.js API側の環境変数として管理します。モバイルアプリはNext.jsの `/api/mobile/*` だけを呼び出し、ログイン後に受け取ったaccess token / refresh tokenをExpo SecureStoreへ保存します。

## 内部配布の手順

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

ビルド完了後:

1. EAS CLIまたはExpo Dashboardに表示されるBuild URLをAndroid実機で開きます。
2. APKをダウンロードします。
3. Androidの確認画面で、必要に応じて不明なアプリのインストールを許可します。
4. インストール後、メールアドレス + パスワードでログインし、既存のNext.js APIとBearer token認証で動作することを確認します。

## セキュリティ確認

- モバイルの設定にsecretやAPI keyは追加していません。
- `EXPO_PUBLIC_API_BASE_URL` は公開URLとして扱い、secretではない値だけを埋め込みます。
- 既存のBearer token API、refresh token rotation、SecureStore保存コードは変更していません。
- refresh token family revocationを含むサーバー側のモバイル認証APIには変更を加えていません。

## 確認結果

| Command | Result |
| --- | --- |
| `npm run test` | Passed: 14 files / 92 tests |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `npm run test:e2e` | Passed: 5 tests |
| `cd mobile && npm install` | Passed |
| `cd mobile && npx expo-doctor` | Passed: 18/18 checks |
| `cd mobile && npm run typecheck` | Passed |

`npm run test:e2e` は通常のサンドボックス内では `listen EPERM: operation not permitted 0.0.0.0:3000` でWebサーバー起動が制限されたため、同じコマンドを権限付きで再実行して成功しました。

`npx expo-doctor` は最初に `expo` のpatch version mismatchを検出したため、Expo SDK 54が期待する `~54.0.35` へ更新して再実行し、18/18 checks passedを確認しました。

## 残課題

- `eas build --platform android --profile preview` はExpoアカウントとクラウドビルドを使うため、今回は実行していません。手順確認後に実行してください。
- iOS内部配布はApple Developer Program、端末UDID登録、provisioning profileが必要です。
- CIでEAS Buildを自動化する場合は、Expo access tokenをCI secretとして登録し、モバイル側には置かない運用にしてください。
- `npm install expo@~54.0.35` 実行後、npm auditはmoderate severityを12件報告しています。破壊的更新を避けるため、この作業では `npm audit fix --force` は実行していません。
