import { Router } from "express";
import {
  assignComplaint,
  exportComplaints,
  getComplaintById,
  listComplaints,
  updateComplaintPriority,
  updateComplaintStatus,
} from "../controllers/complaints.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const complaintRouter = Router();

complaintRouter.use(authenticate);

complaintRouter.get("/", requirePermission("complaints"), listComplaints);
complaintRouter.get("/export", requirePermission("complaints"), exportComplaints);
complaintRouter.get("/:id", requirePermission("complaints"), getComplaintById);
complaintRouter.patch("/:id/assign", requirePermission("complaints"), assignComplaint);
complaintRouter.patch("/:id/status", requirePermission("complaints"), updateComplaintStatus);
complaintRouter.patch("/:id/priority", requirePermission("complaints"), updateComplaintPriority);

export default complaintRouter;
