import type { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";


export async function getMyNotifications(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    const unreadComplaintCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
        OR: [
          { link: { startsWith: "/resident/complaints" } },
          { link: { startsWith: "/bookings/complains" } },
        ],
      },
    });

    const unreadComplaintNotifications = await prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
        OR: [
          { link: { startsWith: "/resident/complaints/" } },
          { link: { startsWith: "/bookings/complains/" } },
        ],
      },
      select: { link: true },
    });
    const unreadComplaintIds = [...new Set(unreadComplaintNotifications
      .map(({ link }) => link?.split("/").at(-1))
      .filter((id): id is string => Boolean(id)))];

    res.json({
      success: true,
      data: notifications,
      unreadCount,
      unreadComplaintCount,
      unreadComplaintIds,
    });
  } catch (error) {
    next(error);
  }
}

export async function markComplaintNotificationsAsRead(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId;
    const complaintId = req.params.complaintId;

    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    if (!complaintId) {
      res.status(400).json({ success: false, message: "Complaint id is required" });
      return;
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        OR: [
          { link: `/resident/complaints/${complaintId}` },
          { link: `/bookings/complains/${complaintId}` },
        ],
      },
      data: { isRead: true },
    });

    res.json({ success: true, updatedCount: result.count });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationAsRead(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) {
      res.status(400).json({ success: false, message: "Notification id is required" });
      return;
    }

    const result = await prisma.notification.updateMany({
      where: {
        id,
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    if (result.count === 0) {
      const notification = await prisma.notification.findFirst({
        where: { id, userId },
        select: { id: true },
      });

      if (!notification) {
        res.status(404).json({
          success: false,
          message: "Notification not found",
        });
        return;
      }
    }

    res.json({
      success: true,
      message: "Notification marked as read",
    });

    
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsAsRead(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    res.json({
      success: true,
      message: "All notifications marked as read",
      updatedCount: result.count,
    });

    
  } catch (error) {
    next(error);
  }
}

export async function getRoleNotifications(){
  
}

