-- Add token-family identifiers for mobile refresh token reuse detection.
ALTER TABLE "ApiSession"
  ADD COLUMN "tokenFamilyId" TEXT,
  ADD COLUMN "refreshTokenId" TEXT,
  ADD COLUMN "previousRefreshTokenHash" TEXT;

UPDATE "ApiSession"
SET "tokenFamilyId" = "id"
WHERE "tokenFamilyId" IS NULL;

ALTER TABLE "ApiSession"
  ALTER COLUMN "tokenFamilyId" SET NOT NULL;

CREATE UNIQUE INDEX "ApiSession_refreshTokenId_key" ON "ApiSession"("refreshTokenId");
CREATE UNIQUE INDEX "ApiSession_previousRefreshTokenHash_key" ON "ApiSession"("previousRefreshTokenHash");
CREATE INDEX "ApiSession_tokenFamilyId_idx" ON "ApiSession"("tokenFamilyId");
CREATE INDEX "ApiSession_tokenFamilyId_revokedAt_idx" ON "ApiSession"("tokenFamilyId", "revokedAt");
