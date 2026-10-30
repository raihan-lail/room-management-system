import { Router } from "express";
import { assignComplaint, createComplaintMessage, getComplaintById, listComplaints, updateComplaintStatus } from "../controllers/complaints.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const complaintRouter = Router();

complaintRouter.use(authenticate);

complaintRouter.get("/", requirePermission("complaints"), listComplaints);
complaintRouter.get("/:id", requirePermission("complaints"), getComplaintById);
complaintRouter.patch("/:id/assign", requirePermission("complaints"), assignComplaint);
complaintRouter.patch("/:id/status", requirePermission("complaints"), updateComplaintStatus);
complaintRouter.post("/:id/messages", requirePermission("complaints"), createComplaintMessage);

export default complaintRouter;
