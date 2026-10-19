import type { Request, Response } from "express";

import { prisma } from "../lib/prisma.js";
import {
  getActorOrRespond,
  isGlobalSuperadmin,
  handlePrismaError,
  NO_MATCHING_ID,
} from "../utils/actor.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import type { Actor } from "../utils/actor.js";

function bedSiteFilter(actor: Actor) {
  if (isGlobalSuperadmin(actor)) return {};

  return {
    room: {
      floor: {
        location: {
          siteId: actor.siteId ?? NO_MATCHING_ID,
        },
      },
    },
  };
}



export async function updateBed(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const id = req.params.id as string;
    const { roomId, name, description, isActive } = req.body;

    const existing = await prisma.bed.findFirst({
      where: {
        id,
        ...bedSiteFilter(actor),
      },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ message: "Bed not found" });
    }

    if (roomId !== undefined) {
      if (typeof roomId !== "string") {
        return res.status(400).json({ message: "Invalid roomId" });
      }

      const room = await prisma.room.findFirst({
        where: {
          id: roomId,
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
        select: { id: true, isBookable: true },
      });

      if (!room) {
        return res.status(404).json({
          message: "Room not found or access denied",
        });
      }

      if (!room.isBookable) {
        return res.status(409).json({
          message: "Cannot move a bed to a room that is not bookable",
        });
      }
    }

    const data: {
      roomId?: string;
      name?: string;
      description?: string | null;
      isActive?: boolean;
    } = {};

    if (roomId !== undefined) data.roomId = roomId;

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Invalid bed name" });
      }
      data.name = name.trim();
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return res.status(400).json({ message: "Invalid description" });
      }
      data.description =
        typeof description === "string" ? description.trim() || null : null;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "Invalid isActive" });
      }

      /*
      // Prevent deactivating a bed with an active booking.
      if (!isActive) {
        const activeBooking = await prisma.booking.findFirst({
          where: {
            bedId: id,
            status: "IN HOUSE",
          },
          select: { id: true },
        });

        if (activeBooking) {
          return res.status(409).json({
            message: "Cannot deactivate a bed with a resident currently in house",
          });
        }
      }
        */

      data.isActive = isActive;
    }

    const bed = await prisma.bed.update({
      where: { id },
      data,
      include: { room: true },
    });

    return res.json({ bed });
  } catch (error) {
    return handlePrismaError(error, res, {
      duplicate: "A bed with this name already exists in this room",
      notFound: "Bed not found",
    });
  }
}

export async function deleteBed(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const id = req.params.id as string;

    const bed = await prisma.bed.findFirst({
      where: {
        id,
        ...bedSiteFilter(actor),
      },
      select: {
        id: true,
        _count: { select: { bookings: true } },
      },
    });

    if (!bed) {
      return res.status(404).json({ message: "Bed not found" });
    }

    if (bed._count.bookings > 0) {
      return res.status(409).json({
        message: "Cannot delete a bed with booking records. Deactivate it instead.",
      });
    }

    await prisma.bed.delete({ where: { id } });

    return res.json({ message: "Bed deleted successfully" });
  } catch (error) {
    return handlePrismaError(error, res, {
      conflict: "Cannot delete a bed with dependent records",
      notFound: "Bed not found",
    });
  }
}