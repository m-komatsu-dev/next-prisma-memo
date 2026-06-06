# CSP

`Content-Security-Policy-Report-Only` を全ページと API に設定しています。現時点では report-only で、ブラウザによる強制ブロックは有効化していません。

## Policy

本番想定の値:

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

開発環境では Next.js の dev overlay や HMR のために追加の許可が入ります。本番 policy には開発用の `unsafe-eval`、`ws:`、`http://localhost:*` は入れません。

## Report API

`/api/csp-report` は `POST` のみ受け付けます。

- `application/csp-report`
- `application/json`
- `application/reports+json`

本文は最大 16KB です。legacy CSP report と Reporting API の `csp-violation` を検証します。IP 単位で rate limit をかけ、DB 保存はしません。

ログには directive、disposition、blocked URI の分類などの概要だけを出します。URL query、token、cookie、Authorization header、メールアドレスなどの生値は保存しません。

## Enforce していない理由

Next.js App Router、Auth.js のログイン、OAuth、Vercel Analytics / Speed Insights、モバイル OAuth のブラウザ遷移に影響が出る可能性があります。まず report-only で本番相当の通信を確認し、必要な通信先だけを policy に追加してから `Content-Security-Policy` へ切り替えます。

将来 enforce する場合は、preview でログイン、Google / GitHub OAuth、モバイル OAuth、通知、検索、AI 生成、mobile API、Vercel Analytics / Speed Insights を確認してから本番に反映します。
