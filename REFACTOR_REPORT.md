# Refactor

巨大化していた API クライアント、validation、Todo UI の責務を分けました。既存の公開 import は維持しています。

## Changed Files

| ファイル | 変更 |
| --- | --- |
| `mobile/src/api/posts.ts` | 既存 API を保つ再エクスポート用ファイルに変更 |
| `mobile/src/api/posts/client.ts` | fetch、エラー処理、レスポンス形式チェック、一覧クエリ生成を集約 |
| `mobile/src/api/posts/normalizers.ts` | メモ、Todo、共有設定の正規化処理を集約 |
| `mobile/src/api/posts/posts.ts` | mobile の通常メモ API 処理 |
| `mobile/src/api/posts/todos.ts` | mobile の Todo API 処理 |
| `mobile/src/api/posts/shares.ts` | mobile の共有設定 API 処理 |
| `lib/zod.ts` | 既存 import 互換を保つ再エクスポート用ファイルに変更 |
| `lib/validation/*` | 共通、認証、投稿、Todo、mobile、AI の schema を分割 |
| `components/todo-items.tsx` | Todo パネル本体に絞り込み |
| `components/todo-items/todo-item-row.tsx` | Todo 1行分の表示と操作を分離 |
| `components/todo-items/helpers.ts` | Todo form data、IME Enter 判定、日時変換を集約 |
| `lib/mobile-api-response.ts` | mobile Route Handler 向けの CORS 付き JSON / error response を共通化 |

## Shared Logic

- mobile API の fetch、JSON 解析、機密値を伏せたレスポンス preview。
- mobile API レスポンスの配列 / オブジェクト読み取りと正規化。
- メモ、Todo、共有設定レスポンスの型ガード。
- Zod の ID 変換、日時変換、タグ整形。
- Todo UI の form data 生成、IME 入力中の Enter 判定、`datetime-local` 変換。
- mobile Route Handler の JSON response / error response。

## Notes

- DB schema は変更していません。
- UI の大きな変更はありません。
- 認証、認可、mobile API、Todo、タグ、AI validation の公開 import は維持しています。
- 認可条件と validation は緩めていません。

## Next Candidates

- `app/api/mobile/posts/*` の通常メモ / 共有 Route Handler に `mobileJson` / `mobileError` を広げる。
- 投稿一覧や投稿詳細ページの Prisma query を、用途別の lib 関数へ寄せる。
- `components/posts-list-client.tsx` とカレンダー系コンポーネントを、表示部品と状態管理に分ける。
- mobile 側の `auth.ts`、`ai.ts`、`push-subscriptions.ts` に HTTP クライアント共通化を広げる。
