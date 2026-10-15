import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth.middleware.js";

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
  return prisma.notification.create({
    data: {
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type ?? "INFO",
      link: data.link,
    },
  });
}