import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { sendNotificationToUser } from "../websocket/notification.socket";

interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: string;
  link?: string;
}

type ActorNotificationInput = Omit<CreateNotificationInput, "userId">;

/**
 * Best-effort notification for the acting user.
 * Never throws: skips when unauthenticated, logs on failure
 * so the main operation still succeeds.
 */
export async function notifyActor(
  req: AuthRequest,
  input: ActorNotificationInput
): Promise<void> {
  const userId = req.userId;
  if (!userId) return;

  try {
    await createNotification({ ...input, userId });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

export async function createNotification(
  data: CreateNotificationInput
) {
  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type ?? "INFO",
      link: data.link,
    },
  });

  sendNotificationToUser(data.userId, notification);
  return notification;
}

export async function notifyUsers(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">
): Promise<void> {
  const uniqueUserIds = [...new Set(userIds)];
  const results = await Promise.allSettled(
    uniqueUserIds.map((userId) => createNotification({ ...input, userId }))
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Failed to create notification:", result.reason);
    }
  }
}

export async function notifyComplaintStaff(
  siteId: string | null,
  input: Omit<CreateNotificationInput, "userId">,
  exceptUserId?: string
): Promise<void> {
  try {
    const employees = await prisma.employee.findMany({
      where: {
        user: { isActive: true },
        OR: [
          {
            AND: [
              ...(siteId ? [{ siteId }] : []),
              { permissions: { some: { permission: { name: "complaints" } } } },
            ],
          },
          {
            AND: [
              ...(siteId ? [{ siteId }] : []),
              {
                roles: {
                  some: {
                    role: {
                      permissions: { some: { permission: { name: "complaints" } } },
                    },
                  },
                },
              },
            ],
          },
          { roles: { some: { role: { name: "superadmin", siteId: null } } } },
        ],
      },
      select: { userId: true },
    });

    await notifyUsers(
      employees.map(({ userId }) => userId).filter((userId) => userId !== exceptUserId),
      input
    );
  } catch (error) {
    console.error("Failed to notify complaint staff:", error);
  }
}
