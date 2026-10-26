import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { archiveBooking, cancelBooking, checkInBooking, checkOutBooking, createBooking, extendBooking, getBookingById, listBookings, returnFromHomeLeave, startHomeLeave } from "../controllers/booking.controller";

const bookingRouter = Router();

bookingRouter.use(authenticate)

bookingRouter.get("/", requirePermission("bookings.read"), listBookings);
bookingRouter.get("/:id", requirePermission("bookings.read"), getBookingById );
bookingRouter.post("/", requirePermission("bookings.create"), createBooking);
bookingRouter.post("/:id/check-in", requirePermission("bookings.create"), checkInBooking);
bookingRouter.post("/:id/cancel", requirePermission("bookings.create"), cancelBooking);
bookingRouter.post("/:id/home-leaves", requirePermission("home.leaves"), startHomeLeave);
bookingRouter.post("/:id/return-from-leave", requirePermission("home.leaves"), returnFromHomeLeave);
bookingRouter.post("/:id/extend", requirePermission("bookings.create"), extendBooking);
bookingRouter.post("/:id/check-out", requirePermission("bookings.create"), checkOutBooking);
bookingRouter.post("/:id/archive", requirePermission("bookings.create"), archiveBooking);

export default bookingRouter;