-- Improve case-insensitive memo search over titles, bodies, tags, and Todo items.
-- This migration only adds indexes and the PostgreSQL extension needed by those indexes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Post_title_trgm_idx"
  ON "Post" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Post_content_trgm_idx"
  ON "Post" USING GIN ("content" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Tag_name_trgm_idx"
  ON "Tag" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "TodoItem_text_trgm_idx"
  ON "TodoItem" USING GIN ("text" gin_trgm_ops);
