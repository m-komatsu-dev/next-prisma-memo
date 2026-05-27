-- Add mobile API sessions for refresh-token based authentication.
CREATE TABLE "ApiSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ApiSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiSession_refreshTokenHash_key" ON "ApiSession"("refreshTokenHash");
CREATE INDEX "ApiSession_userId_idx" ON "ApiSession"("userId");
CREATE INDEX "ApiSession_expiresAt_idx" ON "ApiSession"("expiresAt");
CREATE INDEX "ApiSession_revokedAt_idx" ON "ApiSession"("revokedAt");

ALTER TABLE "ApiSession"
  ADD CONSTRAINT "ApiSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
