import {
  ComplaintStatus,
  ComplaintPriority,
  Prisma,
} from "../generated/prisma/client.js";

import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import {
  getActorOrRespond,
  isGlobalSuperadmin,
} from "../utils/actor.js";
import { prisma } from "../lib/prisma.js";
import { auditActor } from "../services/audit.service.js";
import { notifyComplaintStaff, notifyUsers } from "../services/notification.service.js";

function getSiteComplaintFilter(
  actor: Awaited<ReturnType<typeof getActorOrRespond>> & {}
): Prisma.ComplaintWhereInput {
  if (isGlobalSuperadmin(actor)) {
    return {};
  }

  return {
    booking: {
      bed: {
        room: {
          floor: {
            location: {
              siteId: actor.siteId ?? "__no_matching_record__",
            },
          },
        },
      },
    },
  };
}

export async function listComplaints(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const page = Math.max(
      1,
      Number.parseInt(String(req.query.page ?? "1"), 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(String(req.query.limit ?? "10"), 10) || 10
      )
    );

    const where: Prisma.ComplaintWhereInput = {
      AND: [getSiteComplaintFilter(actor)],
    };

    if (req.query.status !== undefined) {
      if (
        typeof req.query.status !== "string" ||
        !Object.values(ComplaintStatus).includes(
          req.query.status as ComplaintStatus
        )
      ) {
        res.status(400).json({ message: "Invalid complaint status." });
        return;
      }

      where.status = req.query.status as ComplaintStatus;
    }

    if (req.query.priority !== undefined) {
      if (
        typeof req.query.priority !== "string" ||
        !Object.values(ComplaintPriority).includes(
          req.query.priority as ComplaintPriority
        )
      ) {
        res.status(400).json({ message: "Invalid complaint priority." });
        return;
      }

      where.priority = req.query.priority as ComplaintPriority;
    }

    if (req.query.category !== undefined) {
      if (
        typeof req.query.category !== "string" ||
        !req.query.category.trim()
      ) {
        res.status(400).json({ message: "Invalid complaint category." });
        return;
      }

      where.category = {
        equals: req.query.category.trim(),
        mode: "insensitive",
      };
    }

    if (req.query.assignedToId !== undefined) {
      if (typeof req.query.assignedToId !== "string") {
        res.status(400).json({ message: "Invalid assignedToId." });
        return;
      }

      where.assignedToId = req.query.assignedToId;
    }

    if (req.query.unassigned === "true") {
      where.assignedToId = null;
    }

    const [total, complaints] = await prisma.$transaction([
      prisma.complaint.count({ where }),
      prisma.complaint.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { priority: "desc" },
          { createdAt: "desc" },
        ],
        include: {
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              startedAt: true,
              endedAt: true,
              resident: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                },
              },
              bed: {
                select: {
                  name: true,
                  room: {
                    select: { name: true },
                  },
                },
              },
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    res.status(200).json({
      data: complaints,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List complaints error:", error);
    res.status(500).json({
      message: "Failed to retrieve complaints.",
    });
  }
}

export async function getComplaintById(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const complaint = await prisma.complaint.findFirst({
      where: {
        id: req.params.id as string,
        ...getSiteComplaintFilter(actor),
      },
      include: {
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            startedAt: true,
            endedAt: true,
            resident: { select: { id: true, fullName: true, phone: true } },
            bed: {
              select: {
                name: true,
                room: { select: { name: true } },
              },
            },
          },
        },
        assignedTo: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                employee: { select: { name: true } },
                resident: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });

    if (!complaint) {
      res.status(404).json({ message: "Complaint not found." });
      return;
    }

    res.status(200).json({ data: complaint });
  } catch (error) {
    console.error("Get complaint error:", error);
    res.status(500).json({ message: "Failed to retrieve complaint." });
  }
}

export async function assignComplaint(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  const { assignedToId } = req.body;

  if (
    assignedToId !== null &&
    (typeof assignedToId !== "string" || !assignedToId.trim())
  ) {
    res.status(400).json({
      message: "Invalid employee ID.",
    });
    return;
  }

  try {
    const scope = getSiteComplaintFilter(actor);

    const complaint = await prisma.complaint.findFirst({
      where: {
        id: req.params.id as string,
        ...scope,
      },
      select: {
        id: true,
        assignedToId: true,
        booking: { select: { resident: { select: { userId: true, siteId: true } } } },
      },
    });

    if (!complaint) {
      res.status(404).json({ message: "Complaint not found." });
      return;
    }

    if (assignedToId !== null) {
      const employee = await prisma.employee.findFirst({
        where: {
          id: assignedToId,
          ...(isGlobalSuperadmin(actor)
            ? {}
            : { siteId: actor.siteId ?? "__no_matching_record__" }),
          user: { isActive: true },
        },
        select: { id: true },
      });

      if (!employee) {
        res.status(400).json({
          message: "Employee not found or outside your permitted site.",
        });
        return;
      }
    }

    const updated = await prisma.complaint.update({
      where: { id: complaint.id },
      data: { assignedToId },
      include: {
        assignedTo: {
          select: { id: true, name: true },
        },
      },
    });

    await auditActor(req, actor, {
      action: "update",
      resource: "complaint",
      resourceId: updated.id,
      description: `Complaint assignment updated for ${updated.id}`,
      before: { assignedToId: complaint.assignedToId },
      after: { assignedToId: updated.assignedToId },
    });
    await notifyUsers([complaint.booking.resident.userId], {
      title: "Complaint updated",
      message: "Your complaint assignment has been updated.",
      type: "INFO",
      link: `/resident/complaints/${updated.id}`,
    });

    res.status(200).json({
      message: "Complaint assignment updated.",
      data: updated,
    });
  } catch (error) {
    console.error("Assign complaint error:", error);
    res.status(500).json({
      message: "Failed to assign complaint.",
    });
  }
}


export async function updateComplaintStatus(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  const { status, resolution } = req.body;

  if (
    typeof status !== "string" ||
    !Object.values(ComplaintStatus).includes(status as ComplaintStatus)
  ) {
    res.status(400).json({ message: "Invalid complaint status." });
    return;
  }

  if (
    status === ComplaintStatus.RESOLVED &&
    (typeof resolution !== "string" || !resolution.trim())
  ) {
    res.status(400).json({
      message: "A resolution description is required.",
    });
    return;
  }

  try {
    const scope = getSiteComplaintFilter(actor);

    const complaint = await prisma.complaint.findFirst({
      where: {
        id: req.params.id as string,
        ...scope,
      },
      include: {
        booking: { select: { resident: { select: { userId: true, siteId: true } } } },
      },
    });

    if (!complaint) {
      res.status(404).json({ message: "Complaint not found." });
      return;
    }

    if (
      complaint.status === ComplaintStatus.CLOSED ||
      complaint.status === ComplaintStatus.REJECTED
    ) {
      res.status(400).json({
        message: "This complaint is already closed or rejected.",
      });
      return;
    }

    if (
      complaint.status === ComplaintStatus.RESOLVED &&
      status !== ComplaintStatus.CLOSED
    ) {
      res.status(400).json({
        message: "A resolved complaint can only be closed.",
      });
      return;
    }

    const allowedTransitions: Record<string, string[]> = {
      OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"],
      IN_PROGRESS: ["RESOLVED", "CLOSED", "REJECTED"],
      RESOLVED: ["CLOSED"],
    };

    if (!allowedTransitions[complaint.status]?.includes(status)) {
      res.status(400).json({
        message: `Cannot change complaint from ${complaint.status} to ${status}.`,
      });
      return;
    }

    const updated = await prisma.complaint.update({
      where: { id: complaint.id },
      data: {
        status: status as ComplaintStatus,
        ...(status === ComplaintStatus.RESOLVED
          ? {
              resolution: resolution.trim(),
              resolvedAt: new Date(),
            }
          : {}),
        ...(status === ComplaintStatus.CLOSED
          ? { closedAt: new Date() }
          : {}),
        ...(status === ComplaintStatus.REJECTED
          ? {
              resolution:
                typeof resolution === "string"
                  ? resolution.trim()
                  : complaint.resolution,
              closedAt: new Date(),
            }
          : {}),
      },
    });

    await auditActor(req, actor, {
      action: "update",
      resource: "complaint",
      resourceId: updated.id,
      description: `Complaint status changed from ${complaint.status} to ${updated.status}`,
      before: complaint,
      after: updated,
    });
    await notifyUsers([complaint.booking.resident.userId], {
      title: "Complaint status updated",
      message: `Your complaint status is now ${updated.status.replaceAll("_", " ").toLowerCase()}.`,
      type: "INFO",
      link: `/resident/complaints/${updated.id}`,
    });

    res.status(200).json({
      message: "Complaint status updated successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("Update complaint status error:", error);
    res.status(500).json({
      message: "Failed to update complaint status.",
    });
  }
}

export async function createComplaintMessage(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  const { message, isInternal = false } = req.body;

  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({ message: "Message is required." });
    return;
  }

  if (typeof isInternal !== "boolean") {
    res.status(400).json({ message: "Invalid message visibility." });
    return;
  }

  try {
    const complaint = await prisma.complaint.findFirst({
      where: {
        id: req.params.id as string,
        ...getSiteComplaintFilter(actor),
      },
      select: {
        id: true,
        status: true,
        booking: { select: { resident: { select: { userId: true, siteId: true } } } },
      },
    });

    if (!complaint) {
      res.status(404).json({ message: "Complaint not found." });
      return;
    }

    if (
      complaint.status === ComplaintStatus.CLOSED ||
      complaint.status === ComplaintStatus.REJECTED
    ) {
      res.status(400).json({
        message: "This complaint no longer accepts messages.",
      });
      return;
    }

    const result = await prisma.complaintMessage.create({
      data: {
        complaintId: complaint.id,
        userId: req.userId!,
        message: message.trim(),
        isInternal,
      },
    });

    await auditActor(req, actor, {
      action: "create",
      resource: "complaint_message",
      resourceId: result.id,
      description: `Staff replied to complaint ${complaint.id}${isInternal ? " with an internal note" : ""}`,
      after: result,
    });
    await notifyComplaintStaff(
      complaint.booking.resident.siteId,
      {
        title: "New complaint conversation message",
        message: `A staff member replied to complaint ${complaint.id}.`,
        type: "INFO",
        link: `/bookings/complains/${complaint.id}`,
      },
      req.userId
    );
    if (!isInternal) {
      await notifyUsers([complaint.booking.resident.userId], {
        title: "New complaint reply",
        message: "The care team replied to your complaint.",
        type: "INFO",
        link: `/resident/complaints/${complaint.id}`,
      });
    }

    res.status(201).json({
      message: "Message added successfully.",
      data: result,
    });
  } catch (error) {
    console.error("Create complaint message error:", error);
    res.status(500).json({
      message: "Failed to add complaint message.",
    });
  }
}
