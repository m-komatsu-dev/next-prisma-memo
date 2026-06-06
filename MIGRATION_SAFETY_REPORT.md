# Migration Safety

`20260604010000_add_api_session_token_families` は mobile refresh token の token family 対応を追加する migration です。既存データを消す操作は含みません。

## Migration

対象:

```text
prisma/migrations/20260604010000_add_api_session_token_families/migration.sql
```

内容:

- `ApiSession.tokenFamilyId` を追加する。
- `ApiSession.refreshTokenId` を追加する。
- `ApiSession.previousRefreshTokenHash` を追加する。
- 既存 `ApiSession` の `tokenFamilyId` を `id` で backfill する。
- `tokenFamilyId` を `NOT NULL` にする。
- `refreshTokenId` / `previousRefreshTokenHash` に unique index を追加する。
- `tokenFamilyId` / `(tokenFamilyId, revokedAt)` に index を追加する。

含まれない操作:

- `DROP TABLE`
- `DROP COLUMN`
- `DROP SCHEMA`
- `DELETE`
- `TRUNCATE`
- 既存 `refreshTokenHash` の書き換え

既存 session は `tokenFamilyId = id` になり、既存 session ごとに独立した family として扱われます。`refreshTokenId` と `previousRefreshTokenHash` は既存行では `NULL` のままです。

## Drift

`npx prisma migrate dev` で `Drift detected` や `We need to reset the "public" schema` が出る場合、この migration 自体ではなく、既存 DB の migration 履歴と `prisma/migrations` の履歴がずれている可能性があります。

既存データを保持したい DB では、drift 表示が出た状態で reset、`db push --force-reset`、`migrate dev` を進めないでください。

## Advisory Lock

過去の調査では PostgreSQL advisory lock key `72707369` を待つ接続があり、Prisma Migrate の `P1002` timeout の原因になっていました。

同じ状態が出た場合は、まず実行中の `prisma migrate ...` がないか確認します。lock holder が不要な session だと確認できるまでは、強制終了しないでください。

実行しない操作:

- `pg_terminate_backend`
- `prisma migrate reset`
- `prisma db push --force-reset`
- `DROP` / `DELETE` / `TRUNCATE`
- migration 履歴の手動変更

## Safe Checks

読み取りと検査だけ行う場合:

```bash
git status --short
find prisma/migrations -mindepth 1 -maxdepth 1 -type d ! -exec test -f "{}/migration.sql" \; -print
npx prisma validate
npx prisma migrate status
```

`npx prisma migrate status` で reset や data loss を示す表示が出たら、その場で止めます。

## Apply To Staging

clone / staging DB で先に確認します。

```bash
npx prisma migrate status
npx prisma migrate deploy
npm run test
npm run lint
npm run build
npm run test:e2e
```

## Apply To A DB You Keep

本番または保持したい DB では、backup を取得してから maintenance window で実行します。

```bash
npx prisma migrate status
npx prisma migrate deploy
npm run test
npm run lint
npm run build
npm run test:e2e
```

`migrate status` が正常で、pending が `20260604010000_add_api_session_token_families` だけの場合に限ります。migration 中は旧アプリが `ApiSession` を作らないように、少なくとも mobile login / refresh を止めます。

## Baselining

既存 DB が `db push` 由来で migration 履歴だけ不足している場合、Prisma の baselining が必要になることがあります。これは migration 履歴を変更する作業です。

自動で進めず、backup を取り、実 schema が各 migration と同等であることを確認してから手動で判断します。

## Stop Conditions

以下が出たら作業を止めます。

- `We need to reset the "public" schema`
- `All data will be lost`
- `Drift detected` かつ reset を促す表示
- `DROP TABLE` / `DROP SCHEMA` / `TRUNCATE` を含む SQL
- 既存 table / column / index が存在するため migration が失敗した場合

この状態で reset や force reset を実行すると既存データを失う可能性があります。
