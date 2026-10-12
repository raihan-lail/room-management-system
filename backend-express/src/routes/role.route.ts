import { Router } from "express";
import { createRole, deleteRole, getRole, listRoles, replaceRolePermissions, updateRole } from "../controllers/role.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const roleRouter = Router();

roleRouter.use(authenticate);

roleRouter.get( "/", requirePermission("roles.read"), listRoles);
roleRouter.get( "/:id", requirePermission("roles.read"), getRole);
roleRouter.post("/", requirePermission("roles.manage"), createRole);
roleRouter.patch("/:id", requirePermission("roles.manage"), updateRole);
roleRouter.put("/:id/permissions", requirePermission("roles.manage"), replaceRolePermissions)
roleRouter.delete("/:id", requirePermission("roles.manage"), deleteRole)


export default roleRouter