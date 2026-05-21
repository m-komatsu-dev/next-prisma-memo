-- Add composite indexes for owner-scoped memo lists and date sorting.
CREATE INDEX "Post_authorId_updatedAt_idx" ON "Post"("authorId", "updatedAt");
CREATE INDEX "Post_authorId_createdAt_idx" ON "Post"("authorId", "createdAt");
