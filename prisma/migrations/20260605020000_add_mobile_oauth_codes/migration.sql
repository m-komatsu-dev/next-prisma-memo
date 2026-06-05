CREATE TABLE "MobileOAuthCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MobileOAuthCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileOAuthCode_codeHash_key" ON "MobileOAuthCode"("codeHash");
CREATE INDEX "MobileOAuthCode_userId_idx" ON "MobileOAuthCode"("userId");
CREATE INDEX "MobileOAuthCode_expiresAt_idx" ON "MobileOAuthCode"("expiresAt");
CREATE INDEX "MobileOAuthCode_usedAt_idx" ON "MobileOAuthCode"("usedAt");

ALTER TABLE "MobileOAuthCode"
  ADD CONSTRAINT "MobileOAuthCode_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
