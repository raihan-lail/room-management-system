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
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    res.json({
      success: true,
      data: notifications,
      unreadCount,
    });
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

