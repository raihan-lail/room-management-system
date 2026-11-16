DROP INDEX IF EXISTS "HomeLeave_expectedReturnAt_status_idx";

ALTER TABLE "HomeLeave" DROP COLUMN "expectedReturnAt";

CREATE INDEX "HomeLeave_startedAt_status_idx" ON "HomeLeave"("startedAt", "status");
