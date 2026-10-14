import type { Response } from "express";
import { Prisma } from "../generated/prisma/client.js";

import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

export const NO_MATCHING_ID = "__no_matching_record__";

/**
 * Richest actor query used across controllers/middleware.
 * Superset of the simpler `roles: { include: { role: true } }` variants,
 * so every previous call-site stays type-compatible.
 */
export async function getActor(userId: string) {
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

export type Actor = NonNullable<Awaited<ReturnType<typeof getActor>>>;

type MinimalRoleHolder = {
  roles: Array<{ role: { name: string; siteId: string | null } }>;
};

export function isGlobalSuperadmin(employee: MinimalRoleHolder): boolean {
  return employee.roles.some(
    ({ role }) => role.name === "superadmin" && role.siteId === null,
  );
}

export function getEffectivePermissions(employee: Actor): Set<string> {
  const rolePermissions = employee.roles.flatMap(({ role }) =>
    role.permissions.map(({ permission }) => permission.name),
  );

  const directPermissions = employee.permissions.map(
    ({ permission }) => permission.name,
  );

  return new Set([...rolePermissions, ...directPermissions]);
}

export function canGrantPermission(
  actor: Actor,
  permissionName: string,
): boolean {
  if (isGlobalSuperadmin(actor)) return true;
  return getEffectivePermissions(actor).has(permissionName);
}

export async function getActorOrRespond(
  req: AuthRequest,
  res: Response,
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

type PrismaErrorMessages = {
  duplicate?: string;
  notFound?: string;
  conflict?: string;
};

/**
 * Shared Prisma known-error mapper (P2002 / P2025 / P2003).
 * Pass custom messages per controller; falls back to generic ones.
 */
export function handlePrismaError(
  error: unknown,
  res: Response,
  messages: PrismaErrorMessages = {},
): void {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    res.status(409).json({
      message: messages.duplicate ?? "Record already exists",
    });
    return;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    res.status(404).json({
      message: messages.notFound ?? "Record not found",
    });
    return;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    res.status(409).json({
      message:
        messages.conflict ??
        "Cannot complete the operation because related records exist",
    });
    return;
  }

  console.error("Controller error:", error);
  res.status(500).json({ message: "Internal server error" });
}

/** `{}` for global superadmin, otherwise `{ siteId }` (locations, employees). */
export function getSiteScopedFilter(actor: Actor): { siteId?: string } {
  if (isGlobalSuperadmin(actor)) return {};
  return { siteId: actor.siteId ?? NO_MATCHING_ID };
}

export function canManageSite(actor: Actor, siteId: string): boolean {
  return isGlobalSuperadmin(actor) || actor.siteId === siteId;
}

/** Role visible to the actor (global sees all, others only own site). */
export async function findManageableRole(
  req: AuthRequest,
  res: Response,
  actor: Actor,
) {
  const superadmin = isGlobalSuperadmin(actor);

  const role = await prisma.role.findFirst({
    where: superadmin
      ? { id: req.params.id as string }
      : {
          id: req.params.id as string,
          siteId: actor.siteId ?? NO_MATCHING_ID,
        },
  });

  if (!role) {
    res.status(404).json({ message: "Role not found" });
    return null;
  }

  return role;
}

/** Employee visible to the actor (global sees all, others only own site). */
export async function findManageableEmployee(
  req: AuthRequest,
  res: Response,
  actor: Actor,
) {
  const superadmin = isGlobalSuperadmin(actor);

  const employee = await prisma.employee.findFirst({
    where: superadmin
      ? { id: req.params.id as string }
      : {
          id: req.params.id as string,
          siteId: actor.siteId ?? NO_MATCHING_ID,
        },
    select: { id: true },
  });

  if (!employee) {
    res.status(404).json({ message: "Employee not found" });
    return null;
  }

  return employee;
}
