import { Router } from "express";
import { createResidentComplaint, getMyBookingById, getMyBookings, getMyComplaintById, getMyComplaints, getMyCurrentBooking, getMyHomeLeaves, getMyProfile, replyToMyComplaint } from "../controllers/resident-portal.controller";
import { authenticate } from "../middleware/auth.middleware";

const residentPortalRouter = Router();

residentPortalRouter.use(authenticate);

residentPortalRouter.get("/me", getMyProfile);
residentPortalRouter.get("/bookings", getMyBookings);
residentPortalRouter.get("/bookings/current", getMyCurrentBooking);
residentPortalRouter.get("/bookings/:id", getMyBookingById);
residentPortalRouter.get("/home-leaves", getMyHomeLeaves);

// complaints
residentPortalRouter.post("/bookings/:bookingId/complaints", createResidentComplaint);
residentPortalRouter.get("/complaints", getMyComplaints);
residentPortalRouter.get("/complaints/:id", getMyComplaintById);
residentPortalRouter.post("/complaints/:id/messages", replyToMyComplaint);


export default residentPortalRouter;
