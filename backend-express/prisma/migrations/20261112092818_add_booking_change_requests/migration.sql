-- CreateEnum
CREATE TYPE "BookingChangeType" AS ENUM ('EXTEND', 'CHANGE_DATES', 'CANCEL', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "BookingChangeRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "type" "BookingChangeType" NOT NULL,
    "status" "BookingChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "oldData" JSONB NOT NULL,
    "requestedData" JSONB NOT NULL,
    "rejectionReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingChangeRequest_bookingId_status_idx" ON "BookingChangeRequest"("bookingId", "status");

-- CreateIndex
CREATE INDEX "BookingChangeRequest_status_createdAt_idx" ON "BookingChangeRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BookingChangeRequest_requestedById_createdAt_idx" ON "BookingChangeRequest"("requestedById", "createdAt");

-- AddForeignKey
ALTER TABLE "BookingChangeRequest" ADD CONSTRAINT "BookingChangeRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingChangeRequest" ADD CONSTRAINT "BookingChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingChangeRequest" ADD CONSTRAINT "BookingChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
