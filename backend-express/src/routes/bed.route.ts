import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { deleteBed, listBeds, updateBed } from "../controllers/bed.controller.js";

const bedRouter = Router();
bedRouter.use(authenticate);

bedRouter.get("/", requirePermission("rooms.read"), listBeds);
bedRouter.patch("/id", requirePermission("rooms.manage"), updateBed);
bedRouter.delete("/:id", requirePermission("rooms.manage"), deleteBed);

export default bedRouter;