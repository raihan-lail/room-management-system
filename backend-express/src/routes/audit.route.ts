import { Router } from "express";
import { getAuditLogs } from "../controllers/audit.controller";
import { requirePermission } from "../middleware/permission.middleware";
import { authenticate } from "../middleware/auth.middleware";


const auditRouter = Router();
auditRouter.use(authenticate);

auditRouter.get("/", requirePermission("audit.logs"), getAuditLogs);

export default auditRouter;
