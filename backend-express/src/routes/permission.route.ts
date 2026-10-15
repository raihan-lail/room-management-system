import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { listPermissions } from "../controllers/permission.controller.js";

const permissionRouter = Router()

permissionRouter.use(authenticate);

permissionRouter.get("/", requirePermission("permissions.read"), listPermissions);




export default permissionRouter;