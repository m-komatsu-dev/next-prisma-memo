# CSP_REPORT

作成日: 2026-06-06

## 今回追加したCSP

全ページ/APIに `Content-Security-Policy-Report-Only` を追加しました。`Content-Security-Policy` による強制ブロックはまだ有効化していません。

本番想定のポリシー:

```text
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
img-src 'self' data: blob: https:;
font-src 'self' data:;
media-src 'self' blob:;
connect-src 'self' https://*.vercel-insights.com;
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
worker-src 'self' blob:;
manifest-src 'self';
report-uri /api/csp-report
```

開発環境では Next.js dev overlay / React debug 用に `script-src 'unsafe-eval'` を追加し、Vercel Analytics / Speed Insights の debug script 用に `https://va.vercel-scripts.com`、HMR用に `ws:` と `http://localhost:*` を追加します。本番ではこれらの開発用許可は入りません。

## Report-Onlyであること

追加したヘッダー名は `Content-Security-Policy-Report-Only` です。`Content-Security-Policy` ヘッダーは追加していないため、違反はレポートされますがブラウザによる強制ブロックは起きません。

## まだenforceしない理由

- Next.js App Router は nonce なしの静的CSPでは inline script/style の扱いに注意が必要です。今回は既存画面とAuth.jsのログイン/OAuthフローを壊さないことを優先し、`script-src 'unsafe-inline'` と `style-src 'unsafe-inline'` を Report-Only で観測します。
- 開発環境では React/Next.js のデバッグ機能に `unsafe-eval` が必要です。本番CSPには入れていません。
- Vercel Analytics / Speed Insights は本番では主に同一オリジンの `/_vercel/insights/*` と `/_vercel/speed-insights/*` を使いますが、デプロイ環境やパッケージ設定で収集先が変わる余地があるため、まず Report-Only で実際の違反を確認します。
- OAuth、モバイルOAuthのブラウザ遷移、Auth.jsセッション、通知、検索、AI生成、mobile API、PushSubscription処理への影響を本番相当のログで確認してから enforce へ進めます。

## レポートAPI

`/api/csp-report` を追加しました。

- `POST` のみ実装しています。
- `Content-Type` は `application/csp-report`、`application/json`、`application/reports+json` のみ受け付けます。
- 本文は最大16KBです。`Content-Length` とストリーム読み取り時の両方で制限します。
- legacy CSP report と Reporting API形式の `csp-violation` を検証します。
- IP単位で 30 requests / 60 seconds の rate limit を入れています。
- DB保存はしません。
- ログには `effectiveDirective`、`violatedDirective`、`disposition`、`blockedUriType` などの概要だけを出します。`document-uri`、`blocked-uri`、`source-file`、URL query、token、cookie、Authorization header、個人情報になり得る生データは出しません。

## 確認済み項目

- `Content-Security-Policy-Report-Only` ヘッダーが生成されること。
- `Content-Security-Policy` ヘッダーを追加していないこと。
- `default-src 'self'`、`object-src 'none'`、`base-uri 'self'`、`frame-ancestors 'none'`、`form-action 'self'` が含まれること。
- 開発環境の `unsafe-eval` / `https://va.vercel-scripts.com` が本番CSPには入らないこと。
- `/api/csp-report` が不正な入力を 400 で拒否すること。
- `/api/csp-report` が大きすぎる本文を 413 で拒否すること。
- `/api/csp-report` に rate limit があり、超過時に 429 と rate limit headers を返すこと。
- CSPレポートログに token、Bearer文字列、メールアドレス、外部URLの生hostを出さないこと。

## 実行した確認コマンド

- `npm run test`
  - 22 files / 140 tests passed.
- `npm run lint`
  - passed.
- `npm run build`
  - passed.
- `npm run test:e2e`
  - sandbox内では WebServer の `0.0.0.0:3000` listen が `EPERM` で失敗したため、承認後に再実行して 5 tests passed.
- `npm audit --audit-level=high`
  - 初回はネットワーク制限で失敗。ネットワーク許可後に再実行し、`found 0 vulnerabilities`.
- `cd mobile && npm install && npx expo-doctor`
  - `npm install` は `up to date`.
  - `npx expo-doctor` は初回ネットワーク制限で失敗。ネットワーク許可後に再実行し、18/18 checks passed.

## 未確認項目

- 本番Vercel上での実際の CSP violation レポート内容。
- Googleログイン、GitHubログイン、モバイルOAuthの実機ブラウザ遷移で追加許可が必要かどうか。
- Vercel Analytics / Speed Insights が本番プロジェクト固有設定で追加の `connect-src` を必要とするかどうか。
- 通知、共有通知、検索、AI生成、既存mobile API、PushSubscription処理の本番相当E2Eでの violation の有無。

## 将来 Content-Security-Policy に切り替える手順

1. 本番またはpreviewで Report-Only の violation を数日から1週間程度収集します。
2. `/api/csp-report` の概要ログから、正当な通信先だけを `script-src`、`style-src`、`connect-src`、`img-src` に追加します。
3. URLやtokenを含む可能性があるため、レポートの生データを保存・共有しない運用を維持します。
4. 可能なら Next.js の nonce-based CSP へ移行し、`script-src 'unsafe-inline'` を外します。静的レンダリングへの影響が大きい場合は、Subresource Integrity や route単位の導入も検討します。
5. `style-src 'unsafe-inline'` が実際に不要か検証し、不要なら削除します。
6. Preview環境で `Content-Security-Policy-Report-Only` と同じ値を `Content-Security-Policy` に切り替えて、ログイン、Google/GitHub OAuth、モバイルOAuth、通知、検索、AI生成、mobile API、PushSubscription、Vercel Analytics、Speed Insightsを確認します。
7. 問題がなければ本番で `Content-Security-Policy` に切り替え、しばらく `Content-Security-Policy-Report-Only` も併用して差分を監視します。
