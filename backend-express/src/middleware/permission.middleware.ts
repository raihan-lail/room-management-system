
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  getActor,
  getEffectivePermissions,
  isGlobalSuperadmin,
} from "../utils/actor.js";

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

      const employee = await getActor(req.userId);

      if (!employee) {
        res.status(403).json({
          message: "Employee access required",
        });
        return;
      }

      // Global Superadmin bypasses ordinary permission checks.
      // Site-scoped roles named "superadmin" do not qualify.
      if (isGlobalSuperadmin(employee)) {
        next();
        return;
      }

      const effectivePermissions = getEffectivePermissions(employee);

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
