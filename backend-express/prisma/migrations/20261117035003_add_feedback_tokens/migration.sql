-- CreateEnum
CREATE TYPE "FeedbackTokenType" AS ENUM ('COMPLAINT', 'RATING');

-- CreateTable
CREATE TABLE "FeedbackToken" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "FeedbackTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackToken_tokenHash_key" ON "FeedbackToken"("tokenHash");

-- CreateIndex
CREATE INDEX "FeedbackToken_bookingId_type_idx" ON "FeedbackToken"("bookingId", "type");

-- CreateIndex
CREATE INDEX "FeedbackToken_expiresAt_idx" ON "FeedbackToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "FeedbackToken" ADD CONSTRAINT "FeedbackToken_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
