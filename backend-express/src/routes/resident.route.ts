import  { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createResident, deactivateResident, exportResidentsToExcel, getResident, importResidentsFromExcel, listResidents, updateResident } from "../controllers/resident.controller.js";
import { upload } from "../utils/excel.js";


const residentRouter = Router();
residentRouter.use(authenticate)

residentRouter.get("/", requirePermission("resident.read"), listResidents);
residentRouter.post("/", requirePermission("resident.manage"), createResident);
residentRouter.post("/import", requirePermission("resident.import"), upload.single("file"), importResidentsFromExcel);
residentRouter.get("/export", requirePermission('resident.export'), exportResidentsToExcel);
residentRouter.get("/:id", requirePermission("resident.read"), getResident);
residentRouter.patch("/:id", requirePermission("resident.manage"), updateResident);
residentRouter.delete("/:id", requirePermission("resident.manage"), deactivateResident);

export default residentRouter;