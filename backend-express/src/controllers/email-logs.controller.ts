import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import {
  getActorOrRespond,
  isGlobalSuperadmin,
  NO_MATCHING_ID,
} from "../utils/actor.js";
import { auditActor } from "../services/audit.service.js";
import { notifyActor } from "../services/notification.service.js";
import {
  EMAIL_ENABLED_KEY,
  isEmailEnabled,
  setBooleanSetting,
} from "../services/setting.service.js";

const EMAIL_STATUSES = ["PENDING", "SENT", "FAILED"] as const;

export async function listEmailLogs(
  req: AuthRequest,
  res: Response
) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 10)
    );

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const status =
      typeof req.query.status === "string"
        ? req.query.status.toUpperCase()
        : undefined;

    const type =
      typeof req.query.type === "string"
        ? req.query.type
        : undefined;

    if (
      status &&
      !EMAIL_STATUSES.includes(status as (typeof EMAIL_STATUSES)[number])
    ) {
      return res.status(400).json({
        message: "Invalid email status.",
      });
    }

    const where = {
      ...(isGlobalSuperadmin(actor)
        ? {}
        : {
            siteId: actor.siteId ?? NO_MATCHING_ID,
          }),

      ...(status && {
        status: status as (typeof EMAIL_STATUSES)[number],
      }),

      ...(type && { type }),

      ...(search && {
        OR: [
          {
            recipient: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
          {
            subject: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
        ],
      }),
    };

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          booking: {
            select: {
              id: true,
              bookingNumber: true,
            },
          },
          site: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),

      prisma.emailLog.count({ where }),
    ]);

    return res.status(200).json({
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("listEmailLogs:", error);

    return res.status(500).json({
      message: "Failed to retrieve email logs.",
    });
  }
}

export async function getEmailSettings(
  req: AuthRequest,
  res: Response
) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const emailEnabled = await isEmailEnabled();

    return res.status(200).json({
      data: { emailEnabled },
    });
  } catch (error) {
    console.error("getEmailSettings:", error);

    return res.status(500).json({
      message: "Failed to retrieve email settings.",
    });
  }
}

export async function updateEmailSettings(
  req: AuthRequest,
  res: Response
) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const { emailEnabled } = req.body ?? {};

    if (typeof emailEnabled !== "boolean") {
      return res.status(400).json({
        message: "emailEnabled must be a boolean.",
      });
    }

    const previousValue = await isEmailEnabled();
    const emailEnabledValue = await setBooleanSetting(
      EMAIL_ENABLED_KEY,
      emailEnabled
    );

    await auditActor(req, actor, {
      action: "email_settings_updated",
      resource: "email_settings",
      resourceId: EMAIL_ENABLED_KEY,
      description: `Email sending was turned ${
        emailEnabledValue ? "on" : "off"
      }.`,
      before: { emailEnabled: previousValue },
      after: { emailEnabled: emailEnabledValue },
    });

    await notifyActor(req, {
      title: "Email settings updated",
      message: `Email sending is now ${
        emailEnabledValue ? "enabled" : "disabled"
      }.`,
      type: "SUCCESS",
    });

    return res.status(200).json({
      message: "Email settings updated successfully.",
      data: { emailEnabled: emailEnabledValue },
    });
  } catch (error) {
    console.error("updateEmailSettings:", error);

    return res.status(500).json({
      message: "Failed to update email settings.",
    });
  }
}