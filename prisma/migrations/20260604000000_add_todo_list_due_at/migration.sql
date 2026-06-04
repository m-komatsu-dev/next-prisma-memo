ALTER TABLE "Post" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "Post" ADD COLUMN "todoListDueAt" TIMESTAMP(3);

CREATE INDEX "Post_kind_idx" ON "Post"("kind");
CREATE INDEX "Post_todoListDueAt_idx" ON "Post"("todoListDueAt");
