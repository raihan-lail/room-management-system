/*
  Warnings:

  - The `status` column on the `Bed` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('VACANT', 'BOOKED', 'OCCUPIED', 'HOME_LEAVE');

-- AlterTable
ALTER TABLE "Bed" DROP COLUMN "status",
ADD COLUMN     "status" "BedStatus" NOT NULL DEFAULT 'VACANT';
