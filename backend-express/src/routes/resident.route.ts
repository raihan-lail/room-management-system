import  { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createResident, deactivateResident, getResident, importResidentsFromExcel, listResidents, updateResident } from "../controllers/resident.controller.js";
import { upload } from "../utils/excel.js";

const residentRouter = Router();
residentRouter.use(authenticate)

residentRouter.get("/", requirePermission("resident.view"), listResidents);
residentRouter.post("/", requirePermission("resident.manage"), createResident);
residentRouter.post("/import", requirePermission("resident.manage"), upload.single("file"), importResidentsFromExcel);
residentRouter.get("/:id", requirePermission("resident.view"), getResident);
residentRouter.patch("/:id", requirePermission("resident.manage"), updateResident);
residentRouter.delete("/:id", requirePermission("resident.manage"), deactivateResident);

export default residentRouter;