ALTER TABLE "Interest" ADD COLUMN "targetId" TEXT;
ALTER TABLE "Interest" ADD COLUMN "targetText" TEXT;
ALTER TABLE "Interest" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'discover';
ALTER TABLE "Interest" ADD COLUMN "dismissedAt" TIMESTAMP(3);
