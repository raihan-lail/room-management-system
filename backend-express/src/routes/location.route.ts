import  { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createFloor, createLocation, deleteFloor, deleteLocation, getLocation, listLocations, updateFloor, updateLocation } from "../controllers/location.controller.js";

const locationRouter = Router();
locationRouter.use(authenticate);

// locations
locationRouter.get("/", requirePermission("location.read"), listLocations);
locationRouter.get("/:id", requirePermission("location.read"), getLocation);
locationRouter.post("/", requirePermission("location.manage"), createLocation);
locationRouter.patch("/:id", requirePermission("location.manage"), updateLocation);
locationRouter.delete("/:id", requirePermission("location.manage"), deleteLocation);

// floors
locationRouter.post("/:id/floor", requirePermission("location.manage"), createFloor);
locationRouter.patch("/:id/floor/:floorId", requirePermission("location.manage"), updateFloor);
locationRouter.delete("/:id/floor/:floorId", requirePermission("location.manage"), deleteFloor);

export default locationRouter;