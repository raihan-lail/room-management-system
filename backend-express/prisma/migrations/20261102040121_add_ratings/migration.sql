-- CreateTable
CREATE TABLE "BookingRating" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingRating_bookingId_key" ON "BookingRating"("bookingId");

-- CreateIndex
CREATE INDEX "BookingRating_score_idx" ON "BookingRating"("score");

-- CreateIndex
CREATE INDEX "BookingRating_createdAt_idx" ON "BookingRating"("createdAt");

-- AddForeignKey
ALTER TABLE "BookingRating" ADD CONSTRAINT "BookingRating_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
