import { Router } from "express";
import { createRole, deleteRole, getRole, listRoles, replaceRolePermissions, updateRole } from "../controllers/role.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { disableRolePermission, enableRolePermission, getRolePermissions } from "../controllers/permission-assignment.controller.js";

const roleRouter = Router();

roleRouter.use(authenticate);

roleRouter.get( "/", requirePermission("roles.read"), listRoles);
roleRouter.get( "/:id", requirePermission("roles.read"), getRole);
roleRouter.post("/", requirePermission("roles.manage"), createRole);
roleRouter.patch("/:id", requirePermission("roles.manage"), updateRole);
roleRouter.put("/:id/permissions", requirePermission("roles.manage"), replaceRolePermissions)
roleRouter.delete("/:id", requirePermission("roles.manage"), deleteRole);

// permissions
roleRouter.get("/:id/permissions", requirePermission("permissions.read"),getRolePermissions );
roleRouter.put("/:id/permissions/:permissionId", requirePermission("permissions.manage"), enableRolePermission);
roleRouter.delete("/:id/permissions/:permissionId", requirePermission("permissions.manage"), disableRolePermission );



export default roleRouter