/*
  Warnings:

  - Added the required column `gender` to the `Resident` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `Resident` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "Resident" ADD COLUMN     "gender" "Gender" NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL;
