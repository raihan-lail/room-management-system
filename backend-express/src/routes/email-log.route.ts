import { Router } from "express";
import { listEmailLogs } from "../controllers/email-logs.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const emailLogRouter = Router();
emailLogRouter.use(authenticate);

emailLogRouter.get("/", requirePermission("email.logs"), listEmailLogs);

export default emailLogRouter;