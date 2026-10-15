-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "siteId" TEXT;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
