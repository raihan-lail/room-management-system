import { Router } from "express";
import { getMyNotifications, markAllNotificationsAsRead, markComplaintNotificationsAsRead, markNotificationAsRead } from "../controllers/notification.controller";
import { authenticate } from "../middleware/auth.middleware";
import { createSocketTicket } from "../websocket/socket-ticket";

const notificationRouter = Router();
notificationRouter.use(authenticate);

notificationRouter.get("/", getMyNotifications);
notificationRouter.patch("/read-all", markAllNotificationsAsRead);
notificationRouter.patch("/complaints/:complaintId/read", markComplaintNotificationsAsRead);
notificationRouter.patch("/:id/read", markNotificationAsRead);

// websocket
notificationRouter.post("/socket-ticket", authenticate, (req, res) => {
  const ticket = createSocketTicket(req.userId as string);

  return res.json({
    success: true,
    ticket,
  });
});
export default notificationRouter;
