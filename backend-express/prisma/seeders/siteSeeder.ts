import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client.ts";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const SITE_NAME = "DSLNG";
const SITE_CODE = "SITE0001";
const SITE_DESC = "PT Donggi Senoro LNG";

async function main() {
  const site = await prisma.site.upsert({
    where: { name: SITE_NAME },
    update: {},
    create: {
      name: SITE_NAME,
      code: SITE_CODE,
      description: SITE_DESC,
    },
  });
   console.log(`Seeded site: ${site.name} `);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
