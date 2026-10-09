
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { prisma } from "../lib/prisma.js";

interface AuthRequest extends Request {
  userId?: string;
}

export function requirePermission(permissionName: string) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          message: "Authentication required",
        });
        return;
      }

      const employee = await prisma.employee.findUnique({
        where: {
          userId: req.userId,
        },
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
        res.status(403).json({
          message: "Employee access required",
        });
        return;
      }

      // Global Superadmin bypasses ordinary permission checks.
      // Site-scoped roles named "superadmin" do not qualify.
      const isGlobalSuperadmin = employee.roles.some(
        ({ role }) =>
          role.name === "superadmin" &&
          role.siteId === null
      );

      if (isGlobalSuperadmin) {
        next();
        return;
      }

      // Permissions inherited from roles.
      const rolePermissions = employee.roles.flatMap(
        ({ role }) =>
          role.permissions.map(
            ({ permission }) => permission.name
          )
      );

      // Permissions assigned directly to the employee.
      const directPermissions = employee.permissions.map(
        ({ permission }) => permission.name
      );

      const effectivePermissions = new Set([
        ...rolePermissions,
        ...directPermissions,
      ]);

      if (!effectivePermissions.has(permissionName)) {
        res.status(403).json({
          message: "You do not have permission to perform this action",
        });
        return;
      }

      next();
    } catch (error) {
      console.error("Permission middleware error:", error);

      res.status(500).json({
        message: "Internal server error",
      });
    }
  };
}
