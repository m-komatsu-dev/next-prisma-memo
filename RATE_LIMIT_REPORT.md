# Rate Limit

認証系、token 更新、AI 生成、CSP report API に rate limit を入れています。現在の実装は `lib/rate-limit.ts` のメモリベースです。

## 対象

| 対象 | 単位 | 制限 |
| --- | --- | --- |
| Credentials login | IP | 15分あたり20回の失敗 |
| Credentials login | email + IP | 15分あたり5回の失敗 |
| Mobile login | IP | 15分あたり20回の失敗 |
| Mobile login | email + IP | 15分あたり5回の失敗 |
| Mobile refresh | IP | 5分あたり60回 |
| Mobile refresh | refresh token | 15分あたり10回 |
| AI generation | user ID | 1分あたり10回 |
| CSP report | IP | 60秒あたり30回 |

## 実装

- login は成功時に email + IP の失敗カウンタをリセットします。
- IP 単位の失敗カウンタは window 終了まで保持します。
- 失敗理由は固定文言にし、メールアドレスの存在有無を返しません。
- rate limit key に使う email、IP、refresh token、user ID はハッシュ化します。
- 制限超過時は `429 Too Many Requests` を返します。
- `Retry-After` と `X-RateLimit-*` ヘッダーには内部キーや個人情報を含めません。
- Gemini API key はサーバー側でのみ参照します。

## 注意点

メモリベースのため、サーバーレスや複数プロセスではカウンタが共有されません。本番で強い制限が必要な場合は Redis などの外部ストアへ移す必要があります。

外部ストアへ移す場合も、キーは現在と同じくハッシュ化した値を使います。カウント更新は `INCR` / `EXPIRE`、または Lua script で原子的に処理する方針です。
