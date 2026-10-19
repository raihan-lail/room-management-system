import type { Response } from "express";
import { Prisma } from "../generated/prisma/client";
import argon2 from "argon2";


import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";
import {
  getActorOrRespond,
  handlePrismaError,
  isGlobalSuperadmin,
} from "../utils/actor.js";
import { notifyActor } from "../services/notification.service.js";
import { auditInTransaction } from "../services/audit.service.js";
import type { EmployeeInput } from "../types/employee.type.js";

const employeeSelect = {
  id: true,
  name: true,
  userId: true,
  siteId: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      createdAt: true,
    },
  },
  site: true,
  roles: {
    select: {
      role: {
        select: {
          id: true,
          name: true,
          description: true,
          siteId: true,
        },
      },
    },
  },
} as const;

export async function listEmployees(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const where = isGlobalSuperadmin(actor)
      ? {}
      : actor.siteId
        ? { siteId: actor.siteId }
        : { siteId: "__no_matching_employee__" };

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { name: "asc" },
      select: employeeSelect,
    });

    res.json({ data: employees });
  } catch (error) {
    handlePrismaError(error, res, {
      duplicate: "Email already exists",
      notFound: "Employee not found",
    });
  }
}

export async function getEmployee(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const employee = await prisma.employee.findFirst({
      where: isGlobalSuperadmin(actor)
        ? { id: req.params.id as string }
        : {
            id: req.params.id as string,
            siteId: actor.siteId ?? "__no_matching_employee__",
          },
      select: employeeSelect,
    });

    if (!employee) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }
    res.json({ data: employee });
  } catch (error) {
    handlePrismaError(error, res, {
      duplicate: "Email already exists",
      notFound: "Employee not found",
    });
  }
}

export async function createEmployee(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const superadmin = isGlobalSuperadmin(actor);
    const {
      name,
      email,
      password,
      siteId,
      roleIds = [],
    } = req.body as EmployeeInput;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      res.status(400).json({
        message:
          "name and email are required. Password must be at least 8 characters.",
      });
      return;
    }
    let assignedSiteId: string | null;

    if (superadmin) {
      assignedSiteId = siteId ?? null;
    } else {
      if (!actor.siteId) {
        res.status(403).json({
          message: "the account is not assigned to a site",
        });
        return;
      }

      if (siteId !== undefined && siteId !== actor.siteId) {
        res
          .status(403)
          .json({ message: "You can only create employees for your own site" });
        return;
      }
      assignedSiteId = actor.siteId;
    }

    if (assignedSiteId !== null) {
      const site = await prisma.site.findUnique({
        where: { id: assignedSiteId },
        select: { id: true },
      });
      if (!site) {
        res.status(400).json({ message: "Invalid siteId" });
        return;
      }
    }
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await argon2.hash(password);

    if (
      !Array.isArray(roleIds) ||
      !roleIds.every((id) => typeof id === "string") ||
      new Set(roleIds).size !== roleIds.length
    ) {
      res.status(400).json({
        message: "roleIds must be an array of unique role IDs",
      });
      return;
    }

    const roles = await prisma.role.findMany({
      where: {
        id: { in: roleIds },
      },
      select: {
        id: true,
        name: true,
        siteId: true,
      },
    });

    if (roles.length !== roleIds.length) {
      res.status(400).json({
        message: "One or more role IDs are invalid",
      });
      return;
    }

    const invalidRole = roles.some((role) => {
      if (role.name === "superadmin") return true;

      if (superadmin) return false;

      return !actor.siteId || role.siteId !== actor.siteId;
    });

    if (invalidRole) {
      res.status(403).json({
        message: "You cannot assign one or more of these roles",
      });
      return;
    }

    const employee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: passwordHash,
        },
      });

      const employee = await tx.employee.create({
        data: {
          name: name.trim(),
          userId: user.id,
          siteId: assignedSiteId,
        },
      });

      if (roleIds.length > 0) {
        await tx.employeeRole.createMany({
          data: roleIds.map((roleId) => ({
            employeeId: employee.id,
            roleId,
          })),
        });
      }

      const created = await tx.employee.findUniqueOrThrow({
        where: { id: employee.id },
        select: {
          id: true,
          name: true,
          userId: true,
          siteId: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          site: true,
          roles: {
            select: {
              role: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
            },
          },
        },
      });

      await auditInTransaction(tx, req, actor, {
        action: "create",
        resource: "employee",
        resourceId: created.id,
        description: `Employee ${created.name} created`,
        after: created,
      });

      return created;
    });

    await notifyActor(req, {
      title: "Employee Created",
      message: `Employee ${employee.name} was created successfully.`,
      type: "SUCCESS",
    });

    res.status(201).json({
      message: "Employee created successfully",
      data: employee,
    });
  } catch (error) {
    handlePrismaError(error, res, {
      duplicate: "Email already exists",
      notFound: "Employee not found",
    });
  }
}

export async function updateEmployee(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const superadmin = isGlobalSuperadmin(actor);
    const { name, email, password, siteId, roleIds } =
      req.body as EmployeeInput;

    const target = await prisma.employee.findFirst({
      where: superadmin
        ? { id: req.params.id as string }
        : {
            id: req.params.id as string,
            siteId: actor.siteId ?? "__no_matching_site__",
          },
      select: {
        id: true,
        userId: true,
        siteId: true,
      },
    });

    if (!target) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    if (name !== undefined && typeof name !== "string") {
      res.status(400).json({ message: "Name must be a string" });
      return;
    }

    // Blank means "not provided": only a non-blank name is changed.
    const nextName =
      typeof name === "string" && name.trim() ? name.trim() : undefined;

    if (email !== undefined && typeof email !== "string") {
      res.status(400).json({ message: "Email must be a string" });
      return;
    }

    const normalizedEmail =
      typeof email === "string" && email.trim()
        ? email.trim().toLowerCase()
        : undefined;

    // Blank means "keep the current password".
    let nextPassword: string | undefined;

    if (password !== undefined && password !== "") {
      if (typeof password !== "string" || password.length < 8) {
        res.status(400).json({
          message: "Password must be at least 8 characters",
        });
        return;
      }

      nextPassword = password;
    }

    // An empty siteId ("") means "not provided", while an explicit null
    // clears the employee's site.
    const nextSiteId =
      siteId === "" ? undefined : (siteId as string | null | undefined);

    if (
      nextSiteId !== undefined &&
      nextSiteId !== null &&
      typeof nextSiteId !== "string"
    ) {
      res.status(400).json({ message: "Invalid siteId" });
      return;
    }

    if (
      nextSiteId !== undefined &&
      !superadmin &&
      nextSiteId !== actor.siteId
    ) {
      res.status(403).json({
        message: "Only the global Superadmin can change an employee's site",
      });
      return;
    }

    if (nextSiteId !== undefined && nextSiteId !== null) {
      const site = await prisma.site.findUnique({
        where: { id: nextSiteId },
        select: { id: true },
      });

      if (!site) {
        res.status(400).json({ message: "Invalid siteId" });
        return;
      }
    }

    let nextRoleIds: string[] | undefined;

    if (roleIds !== undefined) {
      if (
        !Array.isArray(roleIds) ||
        !roleIds.every((id) => typeof id === "string") ||
        new Set(roleIds).size !== roleIds.length
      ) {
        res.status(400).json({
          message: "roleIds must be an array of unique role IDs",
        });
        return;
      }

      const roles = await prisma.role.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, name: true, siteId: true },
      });

      if (roles.length !== roleIds.length) {
        res.status(400).json({
          message: "One or more role IDs are invalid",
        });
        return;
      }

      const invalidRole = roles.some((role) => {
        if (role.name === "superadmin") return true;
        if (superadmin) return false;

        return !actor.siteId || role.siteId !== actor.siteId;
      });

      if (invalidRole) {
        res.status(403).json({
          message: "You cannot assign one or more of these roles",
        });
        return;
      }

      nextRoleIds = roleIds;
    }

    if (
      nextName === undefined &&
      normalizedEmail === undefined &&
      nextPassword === undefined &&
      nextSiteId === undefined &&
      nextRoleIds === undefined
    ) {
      res.status(400).json({ message: "No fields to update" });
      return;
    }

    const passwordHash =
      nextPassword === undefined ? undefined : await argon2.hash(nextPassword);

    const updatedEmployee = await prisma.$transaction(async (tx) => {
      if (normalizedEmail !== undefined || passwordHash !== undefined) {
        await tx.user.update({
          where: { id: target.userId as string },
          data: {
            ...(normalizedEmail !== undefined
              ? { email: normalizedEmail }
              : {}),
            ...(passwordHash !== undefined ? { password: passwordHash } : {}),
          },
        });
      }

      if (nextRoleIds !== undefined) {
        await tx.employeeRole.deleteMany({
          where: { employeeId: target.id },
        });

        if (nextRoleIds.length > 0) {
          await tx.employeeRole.createMany({
            data: nextRoleIds.map((roleId) => ({
              employeeId: target.id,
              roleId,
            })),
          });
        }
      }

      const employeeData: Prisma.EmployeeUpdateInput = {
        ...(nextName !== undefined ? { name: nextName } : {}),
        ...(nextSiteId !== undefined ? { siteId: nextSiteId } : {}),
      };

      const updated = Object.keys(employeeData).length > 0
        ? await tx.employee.update({
          where: { id: target.id },
          data: employeeData,
          select: employeeSelect,
        })
        : await tx.employee.findUniqueOrThrow({
          where: { id: target.id },
          select: employeeSelect,
        });

      await auditInTransaction(tx, req, actor, {
        action: "update",
        resource: "employee",
        resourceId: target.id,
        description: `Employee ${updated.name} updated`,
        before: target,
        after: updated,
      });

      return updated;
    });

    await notifyActor(req, {
      title: "Employee Updated",
      message: `Employee ${updatedEmployee.name} was updated successfully.`,
      type: "INFO",
    });

    res.json({
      message: "Employee updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    handlePrismaError(error, res, {
      duplicate: "Email already exists",
      notFound: "Employee not found",
    });
  }
}

export async function deleteEmployee(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const superadmin = isGlobalSuperadmin(actor);

    const target = await prisma.employee.findFirst({
      where: superadmin
        ? { id: req.params.id as string }
        : {
            id: req.params.id as string,
            siteId: actor.siteId ?? "__no_matching_site__",
          },
      select: { id: true, userId: true, name: true },
    });

    if (!target) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    if (target.userId === req.userId) {
      res.status(400).json({
        message: "You cannot delete your own account",
      });
      return;
    }
    await prisma.$transaction(async (tx) => {
      // Delete Employee first, then its User account.
      await tx.employee.delete({
        where: { id: target.id },
      });

      await tx.user.delete({
        where: { id: target.userId },
      });

      await auditInTransaction(tx, req, actor, {
        action: "delete",
        resource: "employee",
        resourceId: target.id,
        description: `Employee ${target.name} deleted`,
        before: target,
      });
    });

    await notifyActor(req, {
      title: "Employee Deleted",
      message: `Employee ${target.name} was deleted successfully.`,
      type: "WARNING",
    });

    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    handlePrismaError(error, res, {
      duplicate: "Email already exists",
      notFound: "Employee not found",
    });
  }
}
