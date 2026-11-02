import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";
import { listRatings } from "../controllers/rating.controller";

const ratingRouter = Router();
ratingRouter.use(authenticate);

ratingRouter.get("/", requirePermission("ratings"), listRatings)

export default ratingRouter;