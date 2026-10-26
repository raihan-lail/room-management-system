import type { Response } from "express";

import { prisma } from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import {
  getActorOrRespond,
  isGlobalSuperadmin,
  handlePrismaError,
  NO_MATCHING_ID,
} from "../utils/actor.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

import { notifyActor } from "../services/notification.service.js";
import { auditActor } from "../services/audit.service.js";
import {
  allocationInclude,
  allocationSiteFilter,
  parsePositiveInt,
} from "../helpers/room-allocation.helper.js";

// GET /api/room-allocations
export async function listRoomAllocations(
  req: AuthRequest,
  res: Response,
) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = Math.min(100, parsePositiveInt(req.query.pageSize, 20));
    const purpose =
      typeof req.query.purpose === "string"
        ? req.query.purpose.trim()
        : "";
    const roomId =
      typeof req.query.roomId === "string" ? req.query.roomId : "";
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const where: Prisma.RoomAllocationWhereInput = {
      ...allocationSiteFilter(actor),
      ...(purpose
        ? { purpose: { contains: purpose, mode: "insensitive" } }
        : {}),
      ...(roomId ? { roomId } : {}),
      ...(search
        ? {
            OR: [
              { purpose: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
              {
                room: {
                  name: { contains: search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };

    const [allocations, total] = await prisma.$transaction([
      prisma.roomAllocation.findMany({
        where,
        include: allocationInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.roomAllocation.count({ where }),
    ]);

    return res.json({
      allocations,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return handlePrismaError(error, res);
  }
}

// GET /api/room-allocations/:id
export async function getRoomAllocation(
  req: AuthRequest,
  res: Response,
) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const id = req.params.id as string;

    const allocation = await prisma.roomAllocation.findFirst({
      where: {
        id,
        ...allocationSiteFilter(actor),
      },
      include: allocationInclude,
    });

    if (!allocation) {
      return res.status(404).json({
        message: "Room allocation not found",
      });
    }

    return res.json({ allocation });
  } catch (error) {
    return handlePrismaError(error, res, {
      notFound: "Room allocation not found",
    });
  }
}

// POST /api/room-allocations
export async function createRoomAllocation(
  req: AuthRequest,
  res: Response,
) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const { roomId, purpose, description, notes } = req.body;

    if (
      typeof roomId !== "string" ||
      !roomId.trim() ||
      typeof purpose !== "string" ||
      !purpose.trim()
    ) {
      return res.status(400).json({
        message: "roomId and purpose are required",
      });
    }

    if (
      (description != null && typeof description !== "string") ||
      (notes != null && typeof notes !== "string")
    ) {
      return res.status(400).json({
        message: "description and notes must be strings",
      });
    }

    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        isBookable: false,
        ...(isGlobalSuperadmin(actor)
          ? {}
          : {
              floor: {
                location: {
                  siteId: actor.siteId ?? NO_MATCHING_ID,
                },
              },
            }),
      },
      select: {
        id: true,
        name: true,
        isBookable: true,
      },
    });

    if (!room) {
      return res.status(400).json({
        message:
          "Room not found, inaccessible, or bookable. Only non-bookable rooms can be allocated.",
      });
    }

    const allocation = await prisma.roomAllocation.create({
      data: {
        roomId: room.id,
        purpose: purpose.trim(),
        description: description?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: allocationInclude,
    });

    await notifyActor(req, {
      title: "Room Allocated",
      message: `Room ${room.name} was allocated for ${allocation.purpose}.`,
      type: "SUCCESS",
    });

    await auditActor(req, actor, {
      action: "create",
      resource: "room_allocation",
      resourceId: allocation.id,
      description: `Room ${room.name} allocated for ${allocation.purpose}`,
      after: allocation,
    });

    return res.status(201).json({
      message: "Room allocation created successfully",
      allocation,
    });
  } catch (error) {
    return handlePrismaError(error, res, {
      duplicate: "This room already has an allocation",
      conflict: "Cannot create an allocation for this room",
      notFound: "Room not found",
    });
  }
}

// PATCH /api/room-allocations/:id
export async function updateRoomAllocation(
  req: AuthRequest,
  res: Response,
) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const id = req.params.id as string;
    const { roomId, purpose, description, notes } = req.body;

    const before = await prisma.roomAllocation.findFirst({
      where: {
        id,
        ...allocationSiteFilter(actor),
      },
      include: allocationInclude,
    });

    if (!before) {
      return res.status(404).json({
        message: "Room allocation not found",
      });
    }

    if (
      roomId !== undefined &&
      (typeof roomId !== "string" || !roomId.trim())
    ) {
      return res.status(400).json({
        message: "roomId must be a non-empty string",
      });
    }

    if (
      purpose !== undefined &&
      (typeof purpose !== "string" || !purpose.trim())
    ) {
      return res.status(400).json({
        message: "purpose must be a non-empty string",
      });
    }

    if (
      (description !== undefined &&
        description !== null &&
        typeof description !== "string") ||
      (notes !== undefined && notes !== null && typeof notes !== "string")
    ) {
      return res.status(400).json({
        message: "description and notes must be strings or null",
      });
    }

    const targetRoomId: string = roomId ?? before.roomId;

    if (targetRoomId !== before.roomId) {
      const targetRoom = await prisma.room.findFirst({
        where: {
          id: targetRoomId,
          isBookable: false,
          ...(isGlobalSuperadmin(actor)
            ? {}
            : {
                floor: {
                  location: {
                    siteId: actor.siteId ?? NO_MATCHING_ID,
                  },
                },
              }),
        },
        select: { id: true, name: true },
      });

      if (!targetRoom) {
        return res.status(400).json({
          message:
            "Target room not found, inaccessible, or bookable. Only non-bookable rooms can be allocated.",
        });
      }
    }

    const allocation = await prisma.roomAllocation.update({
      where: { id },
      data: {
        ...(roomId !== undefined ? { roomId: targetRoomId } : {}),
        ...(purpose !== undefined ? { purpose: purpose.trim() } : {}),
        ...(description !== undefined
          ? { description: description?.trim() || null }
          : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      },
      include: allocationInclude,
    });

    await notifyActor(req, {
      title: "Room Allocation Updated",
      message: `Room allocation for ${allocation.room.name} was updated successfully.`,
      type: "INFO",
    });

    await auditActor(req, actor, {
      action: "update",
      resource: "room_allocation",
      resourceId: allocation.id,
      description: `Room allocation updated for room ${allocation.room.name}`,
      before,
      after: allocation,
    });

    return res.json({
      message: "Room allocation updated successfully",
      allocation,
    });
  } catch (error) {
    return handlePrismaError(error, res, {
      duplicate: "The target room already has an allocation",
      conflict: "Cannot update this room allocation",
      notFound: "Room allocation not found",
    });
  }
}

// DELETE /api/room-allocations/:id
export async function deleteRoomAllocation(
  req: AuthRequest,
  res: Response,
) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const id = req.params.id as string;

    const allocation = await prisma.roomAllocation.findFirst({
      where: {
        id,
        ...allocationSiteFilter(actor),
      },
      include: allocationInclude,
    });

    if (!allocation) {
      return res.status(404).json({
        message: "Room allocation not found",
      });
    }

    await prisma.roomAllocation.delete({
      where: { id: allocation.id },
    });

    await notifyActor(req, {
      title: "Room Allocation Deleted",
      message: `The ${allocation.purpose} allocation for room ${allocation.room.name} was deleted successfully.`,
      type: "WARNING",
    });

    await auditActor(req, actor, {
      action: "delete",
      resource: "room_allocation",
      resourceId: allocation.id,
      description: `Room allocation for ${allocation.room.name} (${allocation.purpose}) deleted`,
      before: allocation,
    });

    return res.json({
      message: "Room allocation deleted successfully",
    });
  } catch (error) {
    return handlePrismaError(error, res, {
      conflict: "Cannot delete this room allocation",
      notFound: "Room allocation not found",
    });
  }
}