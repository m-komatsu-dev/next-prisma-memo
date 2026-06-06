# Performance

一覧画面で必要以上のデータを取得しないようにしています。

## Changes

- メモ一覧の Prisma `findMany` に `take`、URL limit、サーバー側 `orderBy` を入れました。
- 一覧用の Prisma `select` を詳細 / 編集用と分けました。
- Todo preview は最大 5 件、共有ロールは 1 件だけ取得します。
- 長文メモは一覧用に切り詰め、詳細画面で全文を取得します。
- Todo 横断一覧と mobile Todo API に `take` と安定した `orderBy` を入れました。
- Web のメモ一覧と Todo 一覧に「もっと見る」を追加しました。
- Web / Expo の検索・集計処理は、小さな配列と memoized / deferred な計算に寄せています。
- mobile のメモ / Todo / カレンダー API 呼び出しに limit を渡します。

## Boundaries

詳細画面、編集画面、Todo 操作、共有 / 公開 / 削除の権限チェックは既存のサーバーアクションと個別 API を使います。一覧では preview だけを扱い、編集対象の全文や全 Todo は詳細取得時に読みます。

認証、mobile Bearer token、PostShare 権限チェックの構造は変更していません。

## Remaining Work

- 大量データで全件横断検索が必要な場合は、PostgreSQL の `tsvector` や trigram index を検討します。
- フィルターごとの完全な件数が必要な場合は、集計専用クエリを追加します。
- mobile には追加ロード UI をまだ入れていません。API とクライアント関数は limit を受け取れます。
