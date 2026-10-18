-- AlterTable
ALTER TABLE "Prompt" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "education" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "heightCm" INTEGER,
ADD COLUMN     "hometown" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "occupation" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "relationshipGoal" TEXT NOT NULL DEFAULT '';
