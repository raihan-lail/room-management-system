-- DropIndex
DROP INDEX "HomeLeave_startedAt_status_idx";

-- AlterTable
ALTER TABLE "HomeLeave" ADD COLUMN     "expectedReturnAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "HomeLeave_expectedReturnAt_status_idx" ON "HomeLeave"("expectedReturnAt", "status");
