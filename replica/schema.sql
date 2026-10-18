-- HingeX Subscription & Entitlements Schema

CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PLUS', 'X');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'EXPIRED');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'TRIMONTHLY', 'SEMIANNUAL');

CREATE TABLE "Subscription" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "currentPeriodEnd" TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "Subscription"("userId", "plan", "status");

CREATE TABLE "DailyLike" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "unique_user_daily_like" UNIQUE ("userId", "date")
);
CREATE INDEX ON "DailyLike"("userId", "date");

CREATE TABLE "DealbreakerPreference" (
    "userId" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
    "strictVerifiedOnly" BOOLEAN NOT NULL DEFAULT false,
    "strictSamePace" BOOLEAN NOT NULL DEFAULT false,
    "strictBudgetOverlap" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extension to existing Interest table
ALTER TABLE "Interest" ADD COLUMN IF NOT EXISTS "isPriority" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Interest_toUserId_isPriority_idx" ON "Interest"("toUserId", "isPriority", "createdAt" DESC);
