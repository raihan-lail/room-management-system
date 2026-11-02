import { Router } from "express";
import { getDashboardData } from "../controllers/dashboard.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";

const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.get("/", requirePermission("dashboard"), getDashboardData);

export default dashboardRouter;
