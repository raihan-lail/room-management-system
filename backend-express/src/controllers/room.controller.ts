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

function roomSiteFilter(actor: Actor) {
  if (isGlobalSuperadmin(actor)) return {};

  return {
    floor: {
      location: {
        siteId: actor.siteId ?? NO_MATCHING_ID,
      },
    },
  };
}

export async function listRooms(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const rooms = await prisma.room.findMany({
      where: {
        ...roomSiteFilter(actor),
        ...(typeof req.query.floorId === "string"
          ? { floorId: req.query.floorId }
          : {}),
      },
      include: {
        floor: {
          include: {
            location: {
              include: { site: true },
            },
          },
        },
        beds: true,
        _count: { select: { beds: true } },
      },
      orderBy: [{ name: "asc" }],
    });

    return res.json({ rooms });
  } catch (error) {
    return handlePrismaError(error, res);
  }
}

export async function getRoom(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const room = await prisma.room.findFirst({
      where: {
        id: req.params.id as string,
        ...roomSiteFilter(actor),
      },
      include: {
        floor: {
          include: {
            location: {
              include: { site: true },
            },
          },
        },
        beds: true,
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    return res.json({ room });
  } catch (error) {
    return handlePrismaError(error, res);
  }
}

export async function createRoom(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const {
      floorId,
      name,
      description,
      row,
      isBookable,
      numberOfBeds = 1,
    } = req.body;

    if (
      typeof floorId !== "string" ||
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        message: "floorId and name are required",
      });
    }

    if (
      !Number.isInteger(numberOfBeds) ||
      numberOfBeds < 1 ||
      numberOfBeds > 100
    ) {
      return res.status(400).json({
        message: "numberOfBeds must be an integer between 1 and 100",
      });
    }

    if (isBookable !== undefined && typeof isBookable !== "boolean") {
      return res.status(400).json({
        message: "isBookable must be a boolean",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        message: "description must be a string",
      });
    }

    if (row !== undefined && row !== null && typeof row !== "string") {
      return res.status(400).json({
        message: "row must be a string",
      });
    }

    const floor = await prisma.floor.findFirst({
      where: {
        id: floorId,
        ...(isGlobalSuperadmin(actor)
          ? {}
          : {
              location: {
                siteId: actor.siteId ?? NO_MATCHING_ID,
              },
            }),
      },
      select: { id: true },
    });

    if (!floor) {
      return res.status(404).json({
        message: "Floor not found or access denied",
      });
    }

    const room = await prisma.room.create({
      data: {
        floorId,
        name: name.trim(),
        description:
          typeof description === "string" ? description.trim() || null : null,
        row: typeof row === "string" ? row.trim() || null : null,
        isBookable: isBookable ?? true,

        beds: {
          create: Array.from({ length: numberOfBeds }, (_, index) => ({
            name: `Bed ${index + 1}`,
          })),
        },
      },
      include: {
        floor: true,
        beds: true,
      },
    });

    return res.status(201).json({ room });
  } catch (error) {
    return handlePrismaError(error, res, {
      duplicate: "A room with this name already exists on this floor",
    });
  }
}

export async function updateRoom(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const id = req.params.id as string;
    const { floorId, name, description, row, isBookable } = req.body;

    const existing = await prisma.room.findFirst({
      where: {
        id,
        ...roomSiteFilter(actor),
      },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (floorId !== undefined) {
      if (typeof floorId !== "string") {
        return res.status(400).json({ message: "Invalid floorId" });
      }

      const floor = await prisma.floor.findFirst({
        where: {
          id: floorId,
          ...(isGlobalSuperadmin(actor)
            ? {}
            : {
                location: {
                  siteId: actor.siteId ?? NO_MATCHING_ID,
                },
              }),
        },
        select: { id: true },
      });

      if (!floor) {
        return res.status(404).json({
          message: "Floor not found or access denied",
        });
      }
    }

    const data: {
      floorId?: string;
      name?: string;
      description?: string | null;
      row?: string | null;
      isBookable?: boolean;
    } = {};

    if (floorId !== undefined) data.floorId = floorId;

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Invalid room name" });
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

    if (row !== undefined) {
      if (row !== null && typeof row !== "string") {
        return res.status(400).json({ message: "Invalid row" });
      }
      data.row = typeof row === "string" ? row.trim() || null : null;
    }

    if (isBookable !== undefined) {
      if (typeof isBookable !== "boolean") {
        return res.status(400).json({ message: "Invalid isBookable" });
      }
      data.isBookable = isBookable;
    }

    const room = await prisma.room.update({
      where: { id },
      data,
      include: { beds: true },
    });

    return res.json({ room });
  } catch (error) {
    return handlePrismaError(error, res, {
      duplicate: "A room with this name already exists on this floor",
      notFound: "Room not found",
    });
  }
}

export async function deleteRoom(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const id = req.params.id as string;

    const room = await prisma.room.findFirst({
      where: {
        id,
        ...roomSiteFilter(actor),
      },
      select: {
        id: true,
        _count: { select: { beds: true } },
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (room._count.beds > 0) {
      return res.status(409).json({
        message:
          "Cannot delete a room that still has beds. Remove its beds first if they have no dependent bookings.",
      });
    }

    await prisma.room.delete({ where: { id } });

    return res.json({ message: "Room deleted successfully" });
  } catch (error) {
    return handlePrismaError(error, res, {
      conflict: "Cannot delete a room with dependent records",
      notFound: "Room not found",
    });
  }
}
