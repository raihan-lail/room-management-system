/*
  Warnings:

  - Added the required column `status` to the `Resident` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Resident" ADD COLUMN     "status" TEXT NOT NULL;
