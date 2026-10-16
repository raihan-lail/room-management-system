
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
  // Sites
  {
    name: "site.read",
    description: "view sites",
  },
  {
    name: "site.manage",
    description: "manage sites",
  },
  // Locations & floors
  {
    name: "location.read",
    description: "view locations and floors",
  },
  {
    name: "location.manage",
    description: "manage locations and floors",
  },
  // Roles
  {
    name: "roles.read",
    description: "view roles",
  },
  {
    name: "roles.manage",
    description: "manage roles",
  },
  // Permissions assignment
  {
    name: "permissions.read",
    description: "view permission assignments",
  },
  {
    name: "permissions.manage",
    description: "manage permission assignments",
  },
  // Employees
  {
    name: "employees.read",
    description: "view employees",
  },
  {
    name: "employees.create",
    description: "create employees",
  },
  {
    name: "employees.update",
    description: "update and delete employees",
  },
  {
    name: "employees.deactivate",
    description: "deactivate employees",
  },
  // Sidebar / page access (names must match the database registry)
  {
    name: "dashboard",
    description: "view dashboard reports",
  },
  {
    name: "frontdesk",
    description: "view frontdesk",
  },
  {
    name: "bookings.calendar",
    description: "view bookings calendar",
  },
  {
    name: "bookings.table",
    description: "view bookings table",
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
    name: "bookings.update",
    description: "Update bookings",
  },
  {
    name: "home.leaves",
    description: "manage home leaves",
  },
  {
    name: "complaints",
    description: "manage complaints",
  },
  {
    name: "ratings",
    description: "manage ratings",
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
    name: "rooms.allocations",
    description: "access room allocations page",
  },
  {
    name: "rooms.map",
    description: "access room map view",
  },
  {
    name: "resident.view",
    description: "view residents",
  },
  {
    name: "resident.manage",
    description: "create and update residents",
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
    name: "change.password",
    description: "change password",
  },
  {
    name: "meal-type.read",
    description: "access meal type page",
  },
  {
    name: "audit.logs",
    description: "access audit logs page",
  },
  {
    name:"bookings.import",
    description:"import bookings in excel/csv"
  },
  {
    name:"bookings.export",
    description:"export bookings in excel/csv"
  },
  {
    name:"home-leave.export",
    description:"export home leaves in excel/csv"
  },
  {
    name:"rooms.export",
    description:"export rooms in excel/csv"
  },
  {
    name:"room-allocations.create",
    description:"create room allocations"
  },
  {
    name:"room-allocations.import",
    description:"import room allocations data"
  },
  {
    name:"room-allocations.export",
    description:"export room data in excel/csv"
  },
  {
    name:"resident.import",
    description:"import resident data",

  }, {
    name:"resident.export",
    description:"export resident data in escel/csv"
  }
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
