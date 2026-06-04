# Rate Limit Report

## 追加した対象

- Web Credentials login: `/api/auth/callback/credentials`
- Auth.js Credentials provider の `authorize`
- Mobile login: `/api/mobile/auth/login`
- Mobile refresh: `/api/mobile/auth/refresh`
- Mobile AI generation: `/api/mobile/ai/generate`
- Web AI generation server action: `app/posts/[id]/edit/ai-actions.ts`

## 制限値

| 対象 | 単位 | 制限 |
| --- | --- | --- |
| Credentials login | IP | 15分あたり20回の失敗 |
| Credentials login | email + IP | 15分あたり5回の失敗 |
| Mobile login | IP | 15分あたり20回の失敗 |
| Mobile login | email + IP | 15分あたり5回の失敗 |
| Mobile refresh | IP | 5分あたり60回 |
| Mobile refresh | refresh token | 15分あたり10回 |
| AI generation | user ID | 1分あたり10回 |

Credentials login / mobile login は、成功時に同じ email + IP の失敗カウンタをリセットします。IP 単位の失敗カウンタは、複数メールアドレスへの総当たりを抑えるため window 終了まで保持します。失敗理由は従来通り「メールアドレスまたはパスワードが正しくありません」に統一し、メールアドレスの存在有無を推測できないようにしています。

## 実装方式

- `lib/rate-limit.ts` に固定窓方式のメモリベース rate limiter を追加しました。
- メールアドレス、IP、refresh token、user ID は rate limit key を作る前に SHA-256 でハッシュ化しています。
- 制限超過時は `429 Too Many Requests` を返し、レスポンス本文には IP、token、secret、DB情報を含めません。
- `Retry-After` / `X-RateLimit-*` ヘッダーを返しますが、内部キーや個人情報は含めません。
- Gemini API キーは引き続きサーバー側の `lib/ai-content.ts` のみで参照します。
- refresh token rotation / replay 拒否の DB 条件は変更していません。

## ローカルと本番での注意点

現在の実装は Node.js プロセス内メモリにカウンタを保持します。ローカル開発や単一プロセスでは動作しますが、Vercel のサーバーレス環境では完全な防御にはなりません。

理由:

- インスタンスごとにメモリが分かれる
- コールドスタートや再デプロイでカウンタがリセットされる
- 複数リージョンや並列実行ではカウンタが共有されない

そのため、本番の強い防御には外部ストアが必要です。

## 残っている課題

- 分散環境での厳密な一貫性はありません。
- IP は `x-forwarded-for` / `x-real-ip` / `cf-connecting-ip` を参照します。プロキシ構成によっては信頼できる転送元ヘッダーの整理が必要です。
- ユーザー単位の AI 制限はログイン後に効きます。未ログインの AI API 利用は引き続き拒否されます。

## Redis等へ移行する場合の方針

本番では Upstash Redis などの外部ストアへ移行するのが安全です。

- `lib/rate-limit.ts` の `checkRateLimit` / `consumeRateLimit` / `resetRateLimit` を Redis 実装に差し替える
- キー形式は現状と同じくハッシュ化した値を使う
- `INCR` と `EXPIRE`、または Lua script で原子的にカウントとTTLを更新する
- Vercel Edge / Serverless から低レイテンシで到達できるリージョンを選ぶ
- 認証系と AI 系で別 prefix を使い、監視しやすくする
