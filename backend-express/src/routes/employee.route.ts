import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";

const employeeRouter = Router();

employeeRouter.get(
  "/test",
  authenticate,
  requirePermission("employees.read"),
  (_req, res) => {
    res.json({
      message: "You have permission to read employees",
    });
  }
);

export default employeeRouter;