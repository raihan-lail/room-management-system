import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createRoomAllocation, deleteRoomAllocation, getRoomAllocation, listRoomAllocations, updateRoomAllocation } from "../controllers/room-allocation.controller.js";


const roomAllocationRouter = Router();
roomAllocationRouter.use(authenticate);

roomAllocationRouter.get("/", requirePermission("rooms.allocations"), listRoomAllocations);
roomAllocationRouter.get("/:id", requirePermission("rooms.allocations"), getRoomAllocation);
roomAllocationRouter.post("/", requirePermission("room-allocations.create"), createRoomAllocation);
roomAllocationRouter.patch("/:id", requirePermission("room-allocations.create"), updateRoomAllocation);
roomAllocationRouter.delete("/:id", requirePermission("room-allocations.create"), deleteRoomAllocation);

export default roomAllocationRouter;