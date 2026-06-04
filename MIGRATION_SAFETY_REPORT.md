# MIGRATION_SAFETY_REPORT

作成日: 2026-06-05

## 結論

- `prisma/migrations` に `migration.sql` がない空の migration ディレクトリは残っていません。
- `prisma/schema.prisma` と `prisma/migrations/20260604010000_add_api_session_token_families/migration.sql` の列名・index 名は整合しています。
- 追加 migration には `DROP TABLE` / `DROP COLUMN` / `DROP SCHEMA` / `DELETE` / `TRUNCATE` はありません。
- 追加 migration には既存 `ApiSession` 行の新列 `tokenFamilyId` を `id` で埋める backfill の `UPDATE` があります。既存列を消したり既存 token を書き換えたりするものではなく、既存 session を token family に安全に所属させるための処理です。
- 今回の調査では、DB 状態を変更するコマンドは実行していません。
- 2026-06-05 の追加調査では、Prisma migrate の PostgreSQL advisory lock key `72707369` を保持している接続と、同じ lock を待っている接続を確認しました。これが `P1002` advisory lock timeout の直接原因と考えられます。

## 原因推定

`npx prisma migrate dev` の `Drift detected` と `We need to reset the "public" schema` は、今回追加した token family migration そのものよりも、既存 DB が過去に `prisma db push` などで作成・変更され、`prisma/migrations` と DB の `_prisma_migrations` 履歴が一致していないことが原因の可能性が高いです。

以前存在していた空の `prisma/migrations/20260603000000_add_post_kind` は削除済みで、現時点では空 migration ディレクトリは確認されませんでした。ただし、実 DB 側の migration 履歴や実スキーマがローカル migration 履歴とズレている場合、`migrate dev` は reset を要求します。

`P1002` advisory lock timeout は別の問題です。Prisma Migrate は同時に複数の migration が走らないよう、PostgreSQL advisory lock `72707369` を取得します。今回の `pg_locks` 読み取り確認では、この lock を保持している backend と、同じ lock を待っている複数 backend がありました。つまり、migration コマンドが lock を取得できず待ち続け、timeout している状態です。

観測時点の状況:

- advisory key: `72707369`
- granted holder: pid `534`
- waiters: pid `545`, `580`, `596`, `634`
- waiters は `wait_event_type = Lock`, `wait_event = advisory`
- holder は `application_name = psql` かつ観測用 SELECT の接続自身として見えました
- holder backend の age は約 53 分でした

この見え方から、Prisma pooled connection の backend に session-level advisory lock が残り、その backend が観測用 `psql` に割り当てられている可能性があります。通常の active migration ではなく、pooler / backend session に残った lock が後続 migrate 接続を塞いでいる、という形が疑わしいです。

## 確認したファイル

- `prisma/schema.prisma`
- `prisma/migrations/20260604010000_add_api_session_token_families/migration.sql`
- `prisma/migrations/*/migration.sql`
- `SECURITY_REPORT.md`

## 実行した検査コマンド

- `git status --short`
- `git diff`
- `ls -1 prisma/migrations`
- `find prisma/migrations -mindepth 1 -maxdepth 1 -type d ! -exec test -f "{}/migration.sql" \; -print`
- `cat prisma/migrations/20260604010000_add_api_session_token_families/migration.sql`
- `cat prisma/schema.prisma`
- `cat prisma/migrations/*/migration.sql`
- `npx prisma validate`
- `npx prisma format`
- `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`
- `npx prisma migrate status`
- `psql` による `pg_locks` / `pg_stat_activity` の SELECT 確認

補足: Prisma 7 では `--to-schema-datamodel` が廃止されていたため、その形式の `migrate diff` はエラーで終了しました。DB には接続・変更していません。新しい `--to-schema` 形式で再実行し、schema から生成される SQL に `ApiSession` の token family 用列と index が含まれることを確認しました。

`npx prisma migrate status` の結果:

- migrations found: 13
- pending migration: `20260604010000_add_api_session_token_families`
- reset は実行していません。
- deploy / dev / resolve も実行していません。

## 今回の検証結果

- `npx prisma validate`: passed
- `npx prisma format`: passed
- `npm run test`: 14 files / 92 tests passed
- `npm run lint`: passed
- `npm run build`: passed
- `npm run test:e2e`: 5 tests passed
- `npm audit --audit-level=high`: `found 0 vulnerabilities`

補足:

- `npm run test:e2e` は sandbox 内では WebServer の `0.0.0.0:3000` listen が `EPERM` で失敗したため、承認後に同じコマンドを再実行して成功しました。
- `npm audit --audit-level=high` は sandbox 内では npm registry の DNS lookup が失敗したため、承認後に同じコマンドを再実行して成功しました。

## Advisory Lock 調査

実行した SELECT:

```sql
SELECT
  l.pid,
  l.locktype,
  l.mode,
  l.granted,
  l.classid,
  l.objid,
  l.objsubid,
  CASE
    WHEN l.locktype = 'advisory' AND l.objsubid = 1
      THEN ((l.classid::bigint << 32) + l.objid::bigint)::text
    ELSE concat(l.classid::text, ',', l.objid::text)
  END AS advisory_key,
  a.usename,
  a.datname,
  a.application_name,
  a.client_addr,
  a.state,
  a.wait_event_type,
  a.wait_event,
  now() - a.xact_start AS xact_age,
  now() - a.query_start AS query_age
FROM pg_locks l
LEFT JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.locktype = 'advisory'
ORDER BY l.granted DESC, query_age DESC NULLS LAST;
```

観測用接続かどうかも含めて確認する SELECT:

```sql
SELECT
  pg_backend_pid() AS observer_pid,
  l.pid,
  l.mode,
  l.granted,
  l.classid,
  l.objid,
  l.objsubid,
  CASE
    WHEN l.objsubid = 1
      THEN ((l.classid::bigint << 32) + l.objid::bigint)::text
    ELSE concat(l.classid::text, ',', l.objid::text)
  END AS advisory_key,
  l.pid = pg_backend_pid() AS is_observer_connection,
  a.usename,
  a.datname,
  a.application_name,
  a.client_addr,
  a.state,
  a.wait_event_type,
  a.wait_event,
  now() - a.backend_start AS backend_age,
  now() - a.xact_start AS xact_age,
  now() - a.query_start AS query_age
FROM pg_locks l
LEFT JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.locktype = 'advisory'
  AND l.objid = 72707369
ORDER BY l.granted DESC, query_age DESC NULLS LAST;
```

確認結果の要約:

- `pid = 534` が `ExclusiveLock` を `granted = true` で保持していました。
- `pid = 545`, `580`, `596`, `634` は同じ `72707369` の `ExclusiveLock` を `granted = false` で待っていました。
- 待機中 backend は `wait_event_type = Lock`, `wait_event = advisory` でした。
- `pid = 534` は観測用 `psql` 接続自身として見えました。ただし backend age が長いため、pooler が以前の session-level advisory lock を保持した backend を再利用している可能性があります。

## Lock 解除が必要な場合の安全手順

このレポート作成中に lock 解除コマンドは実行していません。特に `pg_terminate_backend` は実行していません。

推奨順:

1. ローカル・CI・別ターミナルで走っている `prisma migrate ...` コマンドがないか確認し、実行中なら通常の方法で終了させてください。
2. しばらく待ってから、上記 SELECT で `72707369` の holder / waiters が消えるか確認してください。
3. Prisma pooled connection を使っている場合、pooler / DB 管理画面側で idle backend や connection pool を安全にリセットできるか確認してください。
4. lock holder が本当に不要な session だと確認できるまで、強制解除はしないでください。
5. 強制解除が必要に見えても、まず backup と影響範囲を確認してください。

この調査では次を実行しない方針です。

- `pg_terminate_backend`
- `DROP` / `DELETE` / `TRUNCATE` / `UPDATE`
- `prisma migrate reset`
- `prisma db push`
- `prisma migrate deploy`
- `prisma migrate dev`
- `prisma migrate resolve`

lock が残ったまま `migrate deploy` や `migrate dev` を繰り返すと、さらに waiters が増え、同じ `P1002` timeout を繰り返す可能性があります。

## 実行していない危険なコマンド

今回の調査では、以下は実行していません。

- `npx prisma migrate reset`
- `prisma migrate reset`
- `npx prisma migrate dev`
- `npx prisma migrate deploy`
- `npx prisma db push`
- `npx prisma db push --force-reset`
- `npx prisma migrate resolve --applied`
- `npx prisma migrate resolve --rolled-back`
- `DROP DATABASE`
- `DROP SCHEMA`
- `DROP TABLE`
- `DELETE` / `TRUNCATE` / `UPDATE` などの DB データ変更 SQL

## 追加 migration の安全性

`20260604010000_add_api_session_token_families` は以下を行います。

- `ApiSession.tokenFamilyId` を nullable column として追加
- `ApiSession.refreshTokenId` を nullable column として追加
- `ApiSession.previousRefreshTokenHash` を nullable column として追加
- 既存 `ApiSession` の `tokenFamilyId` だけを `id` で backfill
- `tokenFamilyId` を `NOT NULL` 化
- `refreshTokenId` / `previousRefreshTokenHash` の unique index を追加
- `tokenFamilyId` / `(tokenFamilyId, revokedAt)` の index を追加

既存データへの影響:

- 既存の `refreshTokenHash` は変更しません。
- 既存の `revokedAt` / `expiresAt` / `lastUsedAt` は変更しません。
- 既存 session は `tokenFamilyId = id` になり、既存 session ごとに独立した family として扱われます。
- `refreshTokenId` と `previousRefreshTokenHash` は既存行では `NULL` のままです。PostgreSQL の unique index は複数の `NULL` を許容するため、既存行が複数あっても unique index 作成の衝突にはなりません。

注意点:

- migration 実行中に旧アプリが `ApiSession` を作成すると、`tokenFamilyId` が入らず `NOT NULL` 化で失敗する可能性があります。適用時はアプリを停止するか、少なくとも mobile login / refresh を止める maintenance window を取ってください。
- 実 DB に同名 column / index がすでに手動作成されている場合、この migration は失敗します。その場合も reset せず、実 DB の状態を確認してから方針を決めてください。

## 既存 DB を消さずに進める推奨手順

1. 本番・開発を問わず、まず DB backup を取得してください。
2. 可能なら本番 DB の clone / staging DB で先に検証してください。
3. `npx prisma migrate dev` は drift 時に reset を要求するため、既存データがある DB では実行しないでください。
4. `All data will be lost` または reset を促す表示が出たら、その場で中止してください。
5. まず migration 履歴と実 DB の状態を読み取りで確認してください。
6. 実 DB が過去の migration 相当の schema をすでに持っているが `_prisma_migrations` だけ不足している場合は、Prisma の baselining が必要です。これは migration 履歴を書き換える操作なので、backup と実 schema 照合後に手動でのみ検討してください。
7. migration 履歴が正常で、今回の `20260604010000_add_api_session_token_families` だけが pending であることを確認できた場合だけ、maintenance window で手動適用してください。

## 手動で実行する候補コマンド

まず読み取り・検査だけ:

```bash
git status --short
find prisma/migrations -mindepth 1 -maxdepth 1 -type d ! -exec test -f "{}/migration.sql" \; -print
npx prisma validate
npx prisma migrate status
```

`npx prisma migrate status` で drift / reset / `All data will be lost` に相当する表示が出た場合:

```text
そこで停止してください。reset、migrate dev、db push --force-reset は実行しないでください。
```

staging clone で安全性を確認する場合:

```bash
npx prisma migrate status
npx prisma migrate deploy
npm run test
npm run lint
npm run build
npm run test:e2e
```

本番または保持したい DB に適用する場合:

```bash
# 1. backup を取得
# 2. アプリを停止、または mobile auth を止める maintenance window に入る
npx prisma migrate status

# status が正常で、pending が 20260604010000_add_api_session_token_families だけの場合に限る
npx prisma migrate deploy

npm run test
npm run lint
npm run build
npm run test:e2e
```

既存 DB が `db push` 由来で migration 履歴が不足している場合:

```text
この場合は自動で進めないでください。
DB backup を取得し、実 schema が各 migration と同等であることを確認した上で、Prisma の baselining 手順を検討してください。
`prisma migrate resolve --applied` は migration 履歴を書き換えるため、Codex では実行せず、あなたが確認しながら手動で行ってください。
```

## 停止条件

以下が出た場合は、作業を止めてください。

- `We need to reset the "public" schema`
- `All data will be lost`
- `Drift detected` かつ reset を促す表示
- `DROP TABLE` / `DROP SCHEMA` / `TRUNCATE` を含む SQL が提案された場合
- 既存 table / column / index が存在するため migration が失敗した場合

この状態で reset や force reset を実行すると既存データを失う可能性があります。
