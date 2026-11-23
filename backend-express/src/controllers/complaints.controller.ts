import {
  ComplaintStatus,
  ComplaintPriority,
  Prisma,
} from "../generated/prisma/client.js";

import type { Response } from "express";
import * as XLSX from "xlsx";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import {
  getActorOrRespond,
  isGlobalSuperadmin,
} from "../utils/actor.js";
import type { Actor } from "../utils/actor.js";
import { prisma } from "../lib/prisma.js";
import { auditActor } from "../services/audit.service.js";
import { notifyActor, notifyUsers } from "../services/notification.service.js";
import { formatTimestamp } from "../helpers/date.helper.js";

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

function buildComplaintWhere(
  actor: Actor,
  query: AuthRequest["query"]
): { where: Prisma.ComplaintWhereInput } | { error: string } {
  const where: Prisma.ComplaintWhereInput = {
    AND: [getSiteComplaintFilter(actor)],
  };

  if (query.status !== undefined) {
    if (
      typeof query.status !== "string" ||
      !Object.values(ComplaintStatus).includes(query.status as ComplaintStatus)
    ) {
      return { error: "Invalid complaint status." };
    }

    where.status = query.status as ComplaintStatus;
  }

  if (query.priority !== undefined) {
    if (
      typeof query.priority !== "string" ||
      !Object.values(ComplaintPriority).includes(
        query.priority as ComplaintPriority
      )
    ) {
      return { error: "Invalid complaint priority." };
    }

    where.priority = query.priority as ComplaintPriority;
  }

  if (query.category !== undefined) {
    if (typeof query.category !== "string" || !query.category.trim()) {
      return { error: "Invalid complaint category." };
    }

    where.category = {
      equals: query.category.trim(),
      mode: "insensitive",
    };
  }

  if (query.assignedToId !== undefined) {
    if (typeof query.assignedToId !== "string") {
      return { error: "Invalid assignedToId." };
    }

    where.assignedToId = query.assignedToId;
  }

  if (query.unassigned === "true") {
    where.assignedToId = null;
  }

  if (typeof query.search === "string" && query.search.trim()) {
    const search = query.search.trim();

    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
      { booking: { bookingNumber: { contains: search, mode: "insensitive" } } },
      {
        booking: {
          resident: { fullName: { contains: search, mode: "insensitive" } },
        },
      },
    ];
  }

  return { where };
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

    const filters = buildComplaintWhere(actor, req.query);

    if ("error" in filters) {
      res.status(400).json({ message: filters.error });
      return;
    }

    const where = filters.where;

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

export async function exportComplaints(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  const filters = buildComplaintWhere(actor, req.query);

  if ("error" in filters) {
    res.status(400).json({ message: filters.error });
    return;
  }

  try {
    const complaints = await prisma.complaint.findMany({
      where: filters.where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        booking: {
          select: {
            bookingNumber: true,
            resident: { select: { fullName: true } },
            bed: {
              select: {
                name: true,
                room: {
                  select: {
                    name: true,
                    floor: {
                      select: {
                        name: true,
                        location: {
                          select: {
                            name: true,
                            site: { select: { name: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        assignedTo: { select: { name: true } },
      },
    });

    if (complaints.length === 0) {
      res.status(400).json({
        message: "No complaints match the selected filters. Nothing to export.",
      });
      return;
    }

    const rows = complaints.map((complaint) => ({
      "Complaint ID": complaint.id,
      "Booking ID": complaint.booking.bookingNumber,
      Site: complaint.booking.bed.room.floor.location.site.name,
      Location: complaint.booking.bed.room.floor.location.name,
      Floor: complaint.booking.bed.room.floor.name,
      Room: complaint.booking.bed.room.name,
      Bed: complaint.booking.bed.name,
      Resident: complaint.booking.resident.fullName,
      Type: complaint.category,
      Title: complaint.title,
      Description: complaint.description,
      Status: complaint.status.replaceAll("_", " "),
      Priority: complaint.priority,
      "Assigned To": complaint.assignedTo?.name ?? "",
      Resolution: complaint.resolution ?? "",
      "Submitted At": formatTimestamp(complaint.createdAt),
      "Resolved At": formatTimestamp(complaint.resolvedAt),
      "Closed At": formatTimestamp(complaint.closedAt),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 28 }, { wch: 18 }, { wch: 24 }, { wch: 24 }, { wch: 18 },
      { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 20 }, { wch: 40 },
      { wch: 48 }, { wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 40 },
      { wch: 22 }, { wch: 22 }, { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Complaints");
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });
    const filename = `complaints-${new Date().toISOString().slice(0, 10)}.xlsx`;

    await notifyActor(req, {
      title: "Complaint data export successfully",
      message: `${complaints.length} complaints exported successfully`,
      type: "SUCCESS",
    });
    await auditActor(req, actor, {
      action: "Export",
      resource: "complaint",
      description: `Exported ${complaints.length} complaints to an Excel file.`,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(buffer);
  } catch (error) {
    console.error("exportComplaints:", error);
    if (res.headersSent) return;
    res.status(500).json({ message: "Failed to export complaints." });
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

export async function updateComplaintPriority(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  const { priority } = req.body;

  if (
    typeof priority !== "string" ||
    !Object.values(ComplaintPriority).includes(priority as ComplaintPriority)
  ) {
    res.status(400).json({ message: "Invalid complaint priority." });
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
        priority: true,
        booking: { select: { resident: { select: { userId: true } } } },
      },
    });

    if (!complaint) {
      res.status(404).json({ message: "Complaint not found." });
      return;
    }

    const updated = await prisma.complaint.update({
      where: { id: complaint.id },
      data: { priority: priority as ComplaintPriority },
    });

    await auditActor(req, actor, {
      action: "update",
      resource: "complaint",
      resourceId: updated.id,
      description: `Complaint priority changed from ${complaint.priority} to ${updated.priority}`,
      before: { priority: complaint.priority },
      after: { priority: updated.priority },
    });
    await notifyUsers([complaint.booking.resident.userId], {
      title: "Complaint updated",
      message: `Your complaint priority is now ${updated.priority.toLowerCase()}.`,
      type: "INFO",
      link: `/resident/complaints/${updated.id}`,
    });

    res.status(200).json({
      message: "Complaint priority updated successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("Update complaint priority error:", error);
    res.status(500).json({
      message: "Failed to update complaint priority.",
    });
  }
}
