import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";
import { exportRatingsToExcel, listRatings } from "../controllers/rating.controller";

const ratingRouter = Router();
ratingRouter.use(authenticate);

ratingRouter.get("/export", requirePermission("ratings"), exportRatingsToExcel);
ratingRouter.get("/", requirePermission("ratings"), listRatings)

export default ratingRouter;
