import { prisma } from "../lib/prisma.js";
import { getEmployeeEffectivePermissions } from "../lib/permission.js";

export async function buildAuthUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      employee: {
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      },
      resident: {
        include: {
          site: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  if (user.employee) {
    const roleNames = user.employee.roles.map(
      (employeeRole) => employeeRole.role.name
    );

    const permissions = await getEmployeeEffectivePermissions(user.id);

    const superadmin = user.employee.roles.some(
      ({ role }) => role.name === "superadmin" && role.siteId === null
    );

    const site = user.employee.siteId
      ? await prisma.site.findUnique({
          where: { id: user.employee.siteId },
          select: { id: true, name: true },
        })
      : null;

    return {
      id: user.id,
      email: user.email,
      accountType: "employee" as const,
      roles: roleNames,
      permissions,
      isSuperadmin: superadmin,
      employee: {
        id: user.employee.id,
        name: user.employee.name,
        siteId: user.employee.siteId,
        siteName: site?.name ?? "GLOBAL",
        site,
        roles: roleNames,
        permissions,
      },
    };
  }

  if (user.resident) {
    const resident = user.resident;

    return {
      id: user.id,
      email: user.email,
      accountType: "resident" as const,
      roles: [] as string[],
      permissions: [] as string[],
      isSuperadmin: false,
      resident: {
        id: resident.id,
        fullName: resident.fullName,
        siteId: resident.siteId,
        siteName: resident.site?.name ?? null,
      },
    };
  }

  return null;
}
