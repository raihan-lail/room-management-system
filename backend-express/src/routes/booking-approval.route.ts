import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createBookingChangeRequest, listBookingChangeRequestHistory, listBookingChangeRequests, reviewBookingChangeRequest } from "../controllers/booking-approval.controller.js";

const router = Router();
router.use(authenticate);
router.get("/history", requirePermission("bookings.approve"), listBookingChangeRequestHistory);
router.get("/", requirePermission("bookings.approve"), listBookingChangeRequests);
router.post("/", requirePermission("bookings.create"), createBookingChangeRequest);
router.patch("/:id/review", requirePermission("bookings.approve"), reviewBookingChangeRequest);
export default router;
