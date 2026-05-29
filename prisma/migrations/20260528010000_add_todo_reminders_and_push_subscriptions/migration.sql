-- Add reminder scheduling fields to TodoItem.
ALTER TABLE "TodoItem"
  ADD COLUMN "reminderAt" TIMESTAMP(3),
  ADD COLUMN "reminderSentAt" TIMESTAMP(3);

CREATE INDEX "TodoItem_reminderAt_idx" ON "TodoItem"("reminderAt");
CREATE INDEX "TodoItem_reminderAt_reminderSentAt_completed_idx"
  ON "TodoItem"("reminderAt", "reminderSentAt", "completed");

-- Store Expo push tokens per user. Tokens are globally unique and can be revoked.
CREATE TABLE "PushSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expoPushToken" TEXT NOT NULL,
  "platform" TEXT,
  "deviceName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),

  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_expoPushToken_key"
  ON "PushSubscription"("expoPushToken");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX "PushSubscription_userId_revokedAt_idx"
  ON "PushSubscription"("userId", "revokedAt");
CREATE INDEX "PushSubscription_revokedAt_idx" ON "PushSubscription"("revokedAt");

ALTER TABLE "PushSubscription"
  ADD CONSTRAINT "PushSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
