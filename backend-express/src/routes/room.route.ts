import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createRoom, deleteRoom, getRoom, importRoomsFromExcel, listRooms, updateRoom } from "../controllers/room.controller.js";
import multer from "multer";
import { upload } from "../utils/excel.js";


const roomRouter = Router();

roomRouter.use(authenticate);

roomRouter.get("/", requirePermission("rooms.read"), listRooms);
roomRouter.get("/:id", requirePermission("rooms.read"), getRoom);
roomRouter.post("/", requirePermission("rooms.manage"), createRoom);
roomRouter.patch("/:id", requirePermission("rooms.manage"), updateRoom);
roomRouter.delete("/:id", requirePermission("rooms.manage"), deleteRoom);



roomRouter.post("/import", requirePermission("rooms.manage"), upload.single("file"), importRoomsFromExcel,);

export default roomRouter;