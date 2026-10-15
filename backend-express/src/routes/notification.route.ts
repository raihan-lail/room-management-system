import { Router } from "express";
import { getMyNotifications, markAllNotificationsAsRead, markNotificationAsRead } from "../controllers/notification.controller";
import { authenticate } from "../middleware/auth.middleware";

const notificationRouter = Router();
notificationRouter.use(authenticate);

notificationRouter.get("/", getMyNotifications);
notificationRouter.patch("/read-all", markAllNotificationsAsRead);
notificationRouter.patch("/:id/read", markNotificationAsRead);

export default notificationRouter;
