import { Router } from "express";
import { getMyBookingById, getMyBookings, getMyCurrentBooking, getMyHomeLeaves, getMyProfile } from "../controllers/resident-portal.controller";
import { authenticate } from "../middleware/auth.middleware";

const residentPortalRouter = Router();

residentPortalRouter.use(authenticate);

residentPortalRouter.get("/me", getMyProfile);
residentPortalRouter.get("/bookings", getMyBookings);
residentPortalRouter.get("/bookings/current", getMyCurrentBooking);
residentPortalRouter.get("bookings/:id", getMyBookingById);
residentPortalRouter.get("/home-leaves", getMyHomeLeaves);

export default residentPortalRouter;