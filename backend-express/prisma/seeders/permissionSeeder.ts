
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const permissions = [
  
  {
    name: "site.read",
    description: "view sites",
  },
  {
    name: "site.manage",
    description: "manage sites",
  },
 
];

async function main() {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        name: permission.name,
      },
      update: {
        description: permission.description,
      },
      create: permission,
    });

    console.log(`Seeded permission: ${permission.name}`);
  }

  console.log("All permissions seeded successfully.");
}

main()
  .catch((error) => {
    console.error("Permission seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
