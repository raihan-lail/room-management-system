import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { deleteBed, updateBed } from "../controllers/bed.controller.js";

const bedRouter = Router();

bedRouter.patch("/id", requirePermission("rooms.manage"), updateBed);
bedRouter.delete("/:id", requirePermission("rooms.manage"), deleteBed);

export default bedRouter;