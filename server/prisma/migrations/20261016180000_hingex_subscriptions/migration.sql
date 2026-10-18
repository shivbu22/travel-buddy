-- AlterTable
ALTER TABLE "Interest" ADD COLUMN "isPriority" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Interest_toUserId_isPriority_createdAt_idx" ON "Interest"("toUserId", "isPriority", "createdAt");

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealbreakerPreference" (
    "userId" TEXT NOT NULL,
    "strictVerifiedOnly" BOOLEAN NOT NULL DEFAULT false,
    "strictSamePace" BOOLEAN NOT NULL DEFAULT false,
    "strictBudgetOverlap" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealbreakerPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_userId_plan_status_idx" ON "Subscription"("userId", "plan", "status");

-- CreateIndex
CREATE INDEX "DailyLike_userId_date_idx" ON "DailyLike"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLike_userId_date_key" ON "DailyLike"("userId", "date");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLike" ADD CONSTRAINT "DailyLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealbreakerPreference" ADD CONSTRAINT "DealbreakerPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
