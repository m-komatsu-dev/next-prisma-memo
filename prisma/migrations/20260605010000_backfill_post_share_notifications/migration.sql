INSERT INTO "Notification" (
  "id",
  "userId",
  "actorId",
  "type",
  "title",
  "body",
  "postId",
  "postShareId",
  "createdAt",
  "updatedAt"
)
SELECT
  'psn_' || md5("PostShare"."id"::text || ':post_shared') AS "id",
  "PostShare"."userId",
  "Post"."authorId",
  'post_shared',
  'メモが共有されました',
  CASE
    WHEN "PostShare"."role"::text = 'editor'
      THEN '編集者としてメモに招待されました。'
    ELSE '閲覧者としてメモに招待されました。'
  END,
  "PostShare"."postId",
  "PostShare"."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PostShare"
INNER JOIN "Post" ON "Post"."id" = "PostShare"."postId"
WHERE "PostShare"."userId" <> "Post"."authorId"
  AND NOT EXISTS (
    SELECT 1
    FROM "Notification"
    WHERE "Notification"."postShareId" = "PostShare"."id"
      AND "Notification"."type" = 'post_shared'
  );
