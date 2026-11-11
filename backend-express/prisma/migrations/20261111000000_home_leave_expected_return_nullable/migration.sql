-- Preserve historical expected return dates while allowing new leaves to omit them.
ALTER TABLE "HomeLeave" ALTER COLUMN "expectedReturnAt" DROP NOT NULL;

DROP INDEX IF EXISTS "HomeLeave_expectedReturnAt_status_idx";
