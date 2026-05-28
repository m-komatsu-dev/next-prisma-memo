-- Add first-class todo items with optional due dates for posts.
CREATE TABLE "TodoItem" (
  "id" SERIAL NOT NULL,
  "postId" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "dueAt" TIMESTAMP(3),
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TodoItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TodoItem_postId_idx" ON "TodoItem"("postId");
CREATE INDEX "TodoItem_postId_position_idx" ON "TodoItem"("postId", "position");
CREATE INDEX "TodoItem_postId_completed_idx" ON "TodoItem"("postId", "completed");
CREATE INDEX "TodoItem_dueAt_idx" ON "TodoItem"("dueAt");

ALTER TABLE "TodoItem"
  ADD CONSTRAINT "TodoItem_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
