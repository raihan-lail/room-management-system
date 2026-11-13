import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { requestBookingArchive, requestBookingCancellation, requestBookingExtension } from "../controllers/booking-approval.controller.js";
import { checkInBooking, checkOutBooking, createBooking, exportBookingsToExcel, exportHomeLeavesToExcel, getBookingById, listBookings, listHomeLeaves, returnFromHomeLeave, startHomeLeave } from "../controllers/booking.controller";

const bookingRouter = Router();

bookingRouter.use(authenticate)

bookingRouter.get("/", requirePermission("bookings.read"), listBookings);
bookingRouter.get("/export", requirePermission("bookings.export"), exportBookingsToExcel);
bookingRouter.get("/home-leaves/export", requirePermission("home.leaves"), exportHomeLeavesToExcel);
bookingRouter.get("/home-leaves", requirePermission("home.leaves"), listHomeLeaves);
bookingRouter.get("/:id", requirePermission("bookings.read"), getBookingById );
bookingRouter.post("/", requirePermission("bookings.create"), createBooking);
bookingRouter.post("/:id/check-in", requirePermission("bookings.create"), checkInBooking);
bookingRouter.post("/:id/cancel", requirePermission("bookings.create"), requestBookingCancellation);
bookingRouter.post("/:id/home-leaves", requirePermission("home.leaves"), startHomeLeave);
bookingRouter.post("/:id/return-from-leave", requirePermission("home.leaves"), returnFromHomeLeave);
bookingRouter.post("/:id/extend", requirePermission("bookings.create"), requestBookingExtension);
bookingRouter.post("/:id/check-out", requirePermission("bookings.create"), checkOutBooking);
bookingRouter.post("/:id/archive", requirePermission("bookings.create"), requestBookingArchive);

export default bookingRouter;
