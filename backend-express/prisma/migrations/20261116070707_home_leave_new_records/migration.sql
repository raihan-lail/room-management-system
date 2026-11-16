/*
  Warnings:

  - You are about to drop the column `passwordEncrypted` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "HomeLeave" ALTER COLUMN "expectedReturnAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordEncrypted";
