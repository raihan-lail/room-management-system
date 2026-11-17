import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";
import {
  exportRatingsToExcel,
  getRatingFeedback,
  listRatings,
  submitRatingFeedback,
} from "../controllers/rating.controller";

const ratingRouter = Router();

// Public token-based rating feedback
ratingRouter.get("/feedback/:bookingId/:token", getRatingFeedback);
ratingRouter.post("/feedback/:bookingId/:token", submitRatingFeedback);

ratingRouter.use(authenticate);

ratingRouter.get("/export", requirePermission("ratings"), exportRatingsToExcel);
ratingRouter.get("/", requirePermission("ratings"), listRatings)

export default ratingRouter;
