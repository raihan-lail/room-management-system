import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createRoom, deleteRoom, getRoom, importRoomsFromExcel, listRooms, updateRoom } from "../controllers/room.controller.js";
import multer from "multer";


const roomRouter = Router();

roomRouter.use(authenticate);

roomRouter.get("/", requirePermission("rooms.read"), listRooms);
roomRouter.get("/:id", requirePermission("rooms.read"), getRoom);
roomRouter.post("/", requirePermission("rooms.manage"), createRoom);
roomRouter.patch("/:id", requirePermission("rooms.manage"), updateRoom);
roomRouter.delete("/:id", requirePermission("rooms.manage"), deleteRoom);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
      callback(new Error("Only .xlsx files are supported."));
      return;
    }

    callback(null, true);
  },
});

roomRouter.post("/import", requirePermission("rooms.manage"), upload.single("file"), importRoomsFromExcel,);

export default roomRouter;