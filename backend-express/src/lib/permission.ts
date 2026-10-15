
import { prisma } from "./prisma.js";
import { expandPermissions } from "../utils/actor.js";

export async function getEmployeeEffectivePermissions(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  if (!employee) {
    return [];
  }

  const rolePermissions = employee.roles.flatMap(({ role }) =>
    role.permissions.map(({ permission }) => permission.name)
  );

  const directPermissions = employee.permissions.map(
    ({ permission }) => permission.name
  );

  return [...expandPermissions([...rolePermissions, ...directPermissions])];
}
