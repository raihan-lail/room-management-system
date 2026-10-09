
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
    name: "employees.read",
    description: "View employees",
  },
  {
    name: "employees.create",
    description: "Create employees",
  },
  {
    name: "employees.update",
    description: "Update employees",
  },
  {
    name: "employees.deactivate",
    description: "Deactivate employees",
  },
  {
    name: "employees.assign_roles",
    description: "Assign roles to employees",
  },
  {
    name: "employees.assign_permissions",
    description: "Assign direct permissions to employees",
  },
  {
    name: "roles.read",
    description: "View roles",
  },
  {
    name: "roles.manage",
    description: "Create and update roles",
  },
  {
    name: "bookings.read",
    description: "View bookings",
  },
  {
    name: "bookings.create",
    description: "Create bookings",
  },
  {
    name: "bookings.table",
    description: "view bookings table"
  },
  {
    name: "bookings.calendar",
    description: "view bookings calendar"
  },
  {
    name: "bookings.update",
    description: "Update bookings",
  },
  {
    name: "rooms.read",
    description: "View rooms",
  },
  {
    name: "rooms.manage",
    description: "Create and update rooms",
  },
  {
    name: "dashboard",
    description: "view dashboard reports"
  },
  {
    name: "frontdesk",
    description: "view frontdesk"
  },
  {
    name: "resident.view",
    description: "view residents"
  },
  {
    name: "resident.manage",
    description: "create and update residents"
  },
  {
    name: "complaints",
    description: "manage complaints"
  },
  {
    name: "ratings",
    description: "manage ratings"
  },
  {
    name: "change.password",
    description: "change password"
  },
  {
    name: "home.leaves",
    description: "manage home leaves"
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
