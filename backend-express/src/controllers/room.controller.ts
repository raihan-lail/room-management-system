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

import type { Actor } from "../utils/actor.js";
import { notifyActor } from "../services/notification.service.js";
import { auditActor, auditInTransaction } from "../services/audit.service.js";

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

function singleParam(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function listParam(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : [value];
  const list = raw
    .flatMap((entry) => (typeof entry === "string" ? entry.split(",") : []))
    .map((entry) => entry.trim())
    .filter(Boolean);
  return list.length > 0 ? [...new Set(list)] : undefined;
}

function booleanParam(value: unknown): boolean | undefined {
  const raw = singleParam(value)?.toLowerCase();

  if (raw === "true") return true;
  if (raw === "false") return false;

  return undefined;
}

export async function listRooms(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const page = Math.max(
      1,
      Number.parseInt(String(req.query.page ?? "1"), 10) || 1,
    );

    const pageSize = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(String(req.query.pageSize ?? "20"), 10) || 20,
      ),
    );

    const floorId = singleParam(req.query.floorId);
    const name = singleParam(req.query.name);
    const description = singleParam(req.query.description);
    const row = singleParam(req.query.row);

    const types = listParam(req.query.type);
    const isBookable = booleanParam(req.query.isBookable);

    const search = singleParam(req.query.search);

    const where: Prisma.RoomWhereInput = {
      ...roomSiteFilter(actor),
      ...(floorId ? { floorId } : {}),
      ...(name
        ? { name: { contains: name, mode: "insensitive" as const } }
        : {}),
      ...(description
        ? {
            description: {
              contains: description,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(row
        ? { row: { contains: row, mode: "insensitive" as const } }
        : {}),
      ...(types
        ? types.length === 1
          ? { type: types[0] }
          : { type: { in: types } }
        : {}),
      ...(isBookable !== undefined ? { isBookable } : {}),
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                description: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                type: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                row: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const [rooms, total] = await prisma.$transaction([
      prisma.room.findMany({
        where,
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
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),

      prisma.room.count({ where }),
    ]);

    return res.json({
      rooms,
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

    const room = await prisma.$transaction(async (tx) => {
      const created = await tx.room.create({
        data: {
          floorId,
          name: name.trim(),
          description:
            typeof description === "string"
              ? description.trim() || null
              : null,
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

      await auditInTransaction(tx, req, actor, {
        action: "create",
        resource: "room",
        resourceId: created.id,
        description: `Room ${created.name} created`,
        after: created,
      });

      return created;
    });

    await notifyActor(req, {
      title: "Room Created",
      message: `Room ${room.name} was created successfully.`,
      type: "SUCCESS",
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

    await notifyActor(req, {
      title: "Room Updated",
      message: `Room ${room.name} was updated successfully.`,
      type: "INFO",
    });

    await auditActor(req, actor, {
      action: "update",
      resource: "room",
      resourceId: room.id,
      description: `Room ${room.name} updated`,
      before: existing,
      after: room,
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
      include: {
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

    await notifyActor(req, {
      title: "Room Deleted",
      message: `Room ${room.name} was deleted successfully.`,
      type: "WARNING",
    });

    await auditActor(req, actor, {
      action: "delete",
      resource: "room",
      resourceId: room.id,
      description: `Room ${room.name} deleted`,
      before: room,
    });

    return res.json({ message: "Room deleted successfully" });
  } catch (error) {
    return handlePrismaError(error, res, {
      conflict: "Cannot delete a room with dependent records",
      notFound: "Room not found",
    });
  }
}
