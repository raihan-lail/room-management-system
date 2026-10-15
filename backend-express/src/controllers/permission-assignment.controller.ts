
import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import {
  canGrantPermission,
  findManageableEmployee,
  getActorOrRespond,
  isGlobalSuperadmin,
} from "../utils/actor.js";
import { notifyActor } from "../services/notification.service.js";

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

    await notifyActor(req, {
      title: "Role Permission Enabled",
      message: `Permission ${permission.name} was enabled for role ${role.name}.`,
      type: "INFO",
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

    await notifyActor(req, {
      title: "Role Permission Disabled",
      message: `A permission was disabled for role ${role.name}.`,
      type: "WARNING",
    });

    res.json({ message: "Role permission disabled" });
  } catch (error) {
    console.error("Disable role permission error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
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

    await notifyActor(req, {
      title: "Employee Permission Enabled",
      message: `Permission ${permission.name} was enabled for an employee.`,
      type: "INFO",
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

    await notifyActor(req, {
      title: "Employee Permission Disabled",
      message: `A permission was disabled for an employee.`,
      type: "WARNING",
    });

    res.json({ message: "Employee permission disabled" });
  } catch (error) {
    console.error("Disable employee permission error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

