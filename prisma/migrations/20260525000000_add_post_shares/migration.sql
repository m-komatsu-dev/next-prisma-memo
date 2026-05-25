-- Add per-user memo sharing with explicit viewer/editor roles.
CREATE TYPE "PostShareRole" AS ENUM ('viewer', 'editor');

CREATE TABLE "PostShare" (
  "id" SERIAL NOT NULL,
  "postId" INTEGER NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "PostShareRole" NOT NULL DEFAULT 'viewer',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PostShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostShare_postId_userId_key" ON "PostShare"("postId", "userId");
CREATE INDEX "PostShare_postId_idx" ON "PostShare"("postId");
CREATE INDEX "PostShare_userId_idx" ON "PostShare"("userId");
CREATE INDEX "PostShare_userId_role_idx" ON "PostShare"("userId", "role");

ALTER TABLE "PostShare"
  ADD CONSTRAINT "PostShare_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostShare"
  ADD CONSTRAINT "PostShare_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
