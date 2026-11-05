import { Router } from "express";
import {
  getEmailSettings,
  listEmailLogs,
  updateEmailSettings,
} from "../controllers/email-logs.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const emailLogRouter = Router();
emailLogRouter.use(authenticate);

emailLogRouter.get("/", requirePermission("email.logs"), listEmailLogs);
emailLogRouter.get(
  "/settings",
  requirePermission("email.logs"),
  getEmailSettings
);
emailLogRouter.patch(
  "/settings",
  requirePermission("email.logs"),
  updateEmailSettings
);

export default emailLogRouter;