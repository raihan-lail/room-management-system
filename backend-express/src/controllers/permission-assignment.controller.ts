
import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";



async function getActor(userId: string) {
  return prisma.employee.findUnique({
    where: { userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
      permissions: {
        include: { permission: true },
      },
    },
  });
}

type Actor = NonNullable<Awaited<ReturnType<typeof getActor>>>;

async function getActorOrRespond(
  req: AuthRequest,
  res: Response
): Promise<Actor | null> {
  if (!req.userId) {
    res.status(401).json({ message: "Authentication required" });
    return null;
  }

  const actor = await getActor(req.userId);

  if (!actor) {
    res.status(403).json({ message: "Employee access required" });
    return null;
  }

  return actor;
}
function isGlobalSuperadmin(employee: Actor): boolean {
  return employee.roles.some(
    ({ role }) => role.name === "superadmin" && role.siteId === null,
  );
}
function canGrantPermission(
  actor: Actor,
  permissionName: string
): boolean {
  if (isGlobalSuperadmin(actor)) return true;

  const rolePermissions = actor.roles.flatMap(({ role }) =>
    role.permissions.map(({ permission }) => permission.name)
  );

  const directPermissions = actor.permissions.map(
    ({ permission }) => permission.name
  );

  return new Set([
    ...rolePermissions,
    ...directPermissions,
  ]).has(permissionName);
}

// GET /api/roles/:id/permissions
export async function getRolePermissions(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const superadmin = isGlobalSuperadmin(actor);

    const role = await prisma.role.findFirst({
      where: superadmin
        ? { id: req.params.id as string }
        : {
            id: req.params.id as string,
            siteId: actor.siteId ?? "__no_matching_site__",
          },
      select: { id: true },
    });

    if (!role) {
      res.status(404).json({ message: "Role not found" });
      return;
    }

    const permissions = await prisma.permission.findMany({
      orderBy: { name: "asc" },
      include: {
        roles: {
          where: { roleId: role.id },
          select: { roleId: true },
        },
      },
    });

    res.json({
      data: permissions.map(({ roles, ...permission }) => ({
        ...permission,
        assigned: roles.length > 0,
      })),
    });
  } catch (error) {
    console.error("Get role permissions error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// PUT /api/roles/:id/permissions/:permissionId
export async function enableRolePermission(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const superadmin = isGlobalSuperadmin(actor);

    const role = await prisma.role.findFirst({
      where: superadmin
        ? { id: req.params.id as string}
        : {
            id: req.params.id as string,
            siteId: actor.siteId ?? "__no_matching_site__",
          },
    });

    if (!role) {
      res.status(404).json({ message: "Role not found" });
      return;
    }

    if (role.name === "superadmin") {
      res.status(403).json({
        message: "The Superadmin role is protected",
      });
      return;
    }

    const permission = await prisma.permission.findUnique({
      where: { id: req.params.permissionId as string },
    });

    if (!permission) {
      res.status(404).json({ message: "Permission not found" });
      return;
    }

    if (!canGrantPermission(actor, permission.name)) {
      res.status(403).json({
        message: "You cannot grant this permission",
      });
      return;
    }

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
      update: {},
    });

    res.json({ message: "Role permission enabled" });
  } catch (error) {
    console.error("Enable role permission error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// DELETE /api/roles/:id/permissions/:permissionId
export async function disableRolePermission(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const superadmin = isGlobalSuperadmin(actor);

    const role = await prisma.role.findFirst({
      where: superadmin
        ? { id: req.params.id as string}
        : {
            id: req.params.id as string,
            siteId: actor.siteId ?? "__no_matching_site__",
          },
    });

    if (!role) {
      res.status(404).json({ message: "Role not found" });
      return;
    }

    if (role.name === "superadmin") {
      res.status(403).json({
        message: "The Superadmin role is protected",
      });
      return;
    }

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permissionId: req.params.permissionId as string,
      },
    });

    res.json({ message: "Role permission disabled" });
  } catch (error) {
    console.error("Disable role permission error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}


async function findManageableEmployee(
  req: AuthRequest,
  res: Response,
  actor: Actor
) {
  const superadmin = isGlobalSuperadmin(actor);

  const employee = await prisma.employee.findFirst({
    where: superadmin
      ? { id: req.params.id as string }
      : {
          id: req.params.id as string,
          siteId: actor.siteId ?? "__no_matching_site__",
        },
    select: { id: true },
  });

  if (!employee) {
    res.status(404).json({ message: "Employee not found" });
    return null;
  }

  return employee;
}

// GET /api/employees/:id/permissions
export async function getEmployeePermissions(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const employee = await findManageableEmployee(req, res, actor);
    if (!employee) return;

    const permissions = await prisma.permission.findMany({
      orderBy: { name: "asc" },
      include: {
        employees: {
          where: { employeeId: employee.id },
          select: { employeeId: true },
        },
      },
    });

    res.json({
      data: permissions.map(({ employees, ...permission }) => ({
        ...permission,
        assigned: employees.length > 0,
      })),
    });
  } catch (error) {
    console.error("Get employee permissions error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// PUT /api/employees/:id/permissions/:permissionId
export async function enableEmployeePermission(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const employee = await findManageableEmployee(req, res, actor);
    if (!employee) return;

    const permission = await prisma.permission.findUnique({
      where: { id: req.params.permissionId as string },
    });

    if (!permission) {
      res.status(404).json({ message: "Permission not found" });
      return;
    }

    if (!canGrantPermission(actor, permission.name)) {
      res.status(403).json({
        message: "You cannot grant this permission",
      });
      return;
    }

    await prisma.employeePermission.upsert({
      where: {
        employeeId_permissionId: {
          employeeId: employee.id,
          permissionId: permission.id,
        },
      },
      create: {
        employeeId: employee.id,
        permissionId: permission.id,
      },
      update: {},
    });

    res.json({ message: "Employee permission enabled" });
  } catch (error) {
    console.error("Enable employee permission error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// DELETE /api/employees/:id/permissions/:permissionId
export async function disableEmployeePermission(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const employee = await findManageableEmployee(req, res, actor);
    if (!employee) return;

    await prisma.employeePermission.deleteMany({
      where: {
        employeeId: employee.id,
        permissionId: req.params.permissionId as string,
      },
    });

    res.json({ message: "Employee permission disabled" });
  } catch (error) {
    console.error("Disable employee permission error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

