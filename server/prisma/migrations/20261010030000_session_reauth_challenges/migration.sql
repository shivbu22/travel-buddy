CREATE TABLE "ReauthChallenge" (
  "sessionId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "providerSid" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReauthChallenge_pkey" PRIMARY KEY ("sessionId"),
  CONSTRAINT "ReauthChallenge_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
