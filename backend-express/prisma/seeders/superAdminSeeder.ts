import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import argon2 from "argon2";


const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
argon2

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL ?? "superadmin@example.com";
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD ?? "ChangeMe123!";
const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME ?? "Super Admin";
const SUPERADMIN_ROLE = "superadmin";

async function main() {
  const password = await argon2.hash(SUPERADMIN_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: { password },
    create: {
      email: SUPERADMIN_EMAIL,
      password,
    },
  });

  const employee = await prisma.employee.upsert({
    where: { userId: user.id },
    update: { name: SUPERADMIN_NAME },
    create: {
      userId: user.id,
      name: SUPERADMIN_NAME,
    },
  });

  const role = await prisma.role.upsert({
    where: { name: SUPERADMIN_ROLE },
    update: {},
    create: {
      name: SUPERADMIN_ROLE,
      description: "Full system access, not scoped to any site",
    },
  });

  await prisma.employeeRole.upsert({
    where: {
      employeeId_roleId: {
        employeeId: employee.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      employeeId: employee.id,
      roleId: role.id,
    },
  });

  console.log(`Seeded superadmin: ${user.email} (role: ${role.name})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
