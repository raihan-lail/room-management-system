/*
  Warnings:

  - Added the required column `Category` to the `Complaint` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ComplaintPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- AlterEnum
ALTER TYPE "ComplaintStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "Category" TEXT NOT NULL,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "priority" "ComplaintPriority" NOT NULL DEFAULT 'MEDIUM';

-- CreateTable
CREATE TABLE "ComplaintMessage" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplaintMessage_complaintId_createdAt_idx" ON "ComplaintMessage"("complaintId", "createdAt");

-- AddForeignKey
ALTER TABLE "ComplaintMessage" ADD CONSTRAINT "ComplaintMessage_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintMessage" ADD CONSTRAINT "ComplaintMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
