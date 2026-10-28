import type { Response } from "express";

import { prisma } from "../lib/prisma.js";

import {
  getActorOrRespond,
  isGlobalSuperadmin,
  handlePrismaError,
  NO_MATCHING_ID,
} from "../utils/actor.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { notifyActor } from "../services/notification.service.js";
import { auditActor } from "../services/audit.service.js";
import { Prisma } from "../generated/prisma/client.js";
import {
  BED_STATUSES,
  bedSiteFilter,
  singleParam,
  type BedStatus,
} from "../helpers/bed.helper.js";

export async function listBeds(req: AuthRequest, res: Response) {
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

    const search = singleParam(req.query.search);
    const roomId = singleParam(req.query.roomId);
    const floorId = singleParam(req.query.floorId);
    const locationId = singleParam(req.query.locationId);
    const requestedSiteId = singleParam(req.query.siteId);
    const statusParam = singleParam(req.query.status)?.toUpperCase();
    const dateParam = singleParam(req.query.date);
    const startDateParam = singleParam(req.query.startDate);
    const endDateParam = singleParam(req.query.endDate);

    if (
      statusParam &&
      !BED_STATUSES.includes(statusParam as BedStatus)
    ) {
      return res.status(400).json({
        message: "Invalid bed status",
        allowedStatuses: BED_STATUSES,
      });
    }

    let dateStart: Date | undefined;
    let dateEnd: Date | undefined;
    const parseDay = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
        ? parsed
        : undefined;
    };
    if (Boolean(startDateParam) !== Boolean(endDateParam) || (dateParam && startDateParam)) {
      return res.status(400).json({ message: "Provide date or both startDate and endDate." });
    }
    if (startDateParam && endDateParam) {
      dateStart = parseDay(startDateParam);
      const requestedEnd = parseDay(endDateParam);
      if (!dateStart || !requestedEnd || requestedEnd <= dateStart) {
        return res.status(400).json({ message: "Invalid date range. endDate must be after startDate." });
      }
      dateEnd = requestedEnd;
    } else if (dateParam) {
      dateStart = parseDay(dateParam);
      if (!dateStart) {
        return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD." });
      }
      dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);
    }

    // Non-global employees are always scoped to their own site.
    const siteFilter = isGlobalSuperadmin(actor)
      ? requestedSiteId
        ? { siteId: requestedSiteId }
        : {}
      : { siteId: actor.siteId ?? NO_MATCHING_ID };

    const where: Prisma.BedWhereInput = {
      ...(!dateStart && statusParam
        ? { status: statusParam as BedStatus }
        : {}),
      ...(dateStart && statusParam === "VACANT"
        ? { bookings: { none: { status: { in: ["CONFIRMED", "IN_HOUSE", "HOME_LEAVE"] }, startedAt: { lt: dateEnd! }, endedAt: { gt: dateStart } } } }
        : {}),
      ...(dateStart && statusParam && statusParam !== "VACANT"
        ? { bookings: { some: { status: statusParam === "BOOKED" ? "CONFIRMED" : statusParam, startedAt: { lt: dateEnd! }, endedAt: { gt: dateStart } } } }
        : {}),
      ...(roomId ? { roomId } : {}),
      room: {
        floor: {
          ...(floorId ? { id: floorId } : {}),
          location: {
            ...(locationId ? { id: locationId } : {}),
            ...siteFilter,
          },
        },
      },
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                room: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [beds, total] = await prisma.$transaction([
      prisma.bed.findMany({
        where,
        include: {
          bookings: {
            where: {
              status: { in: ["CONFIRMED", "IN_HOUSE", "HOME_LEAVE"] },
              ...(dateStart ? { startedAt: { lt: dateEnd! }, endedAt: { gt: dateStart } } : {}),
            },
            orderBy: { startedAt: "desc" },
            take: 1,
            include: {
              resident: { include: { user: { select: { email: true } } } },
              homeLeaves: { orderBy: { startedAt: "desc" } },
              complaints: { orderBy: { createdAt: "desc" } },
              events: { orderBy: { createdAt: "desc" } },
            },
          },
          room: {
            include: {
              floor: {
                include: {
                  location: {
                    include: { site: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { room: { name: "asc" } },
          { name: "asc" },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.bed.count({ where }),
    ]);

    const responseBeds = dateStart ? beds.map((bed) => {
      const activeBooking = bed.bookings[0];
      const status: BedStatus = !activeBooking
        ? "VACANT"
        : activeBooking.status === "IN_HOUSE"
          ? "OCCUPIED"
          : activeBooking.status === "HOME_LEAVE"
            ? "HOME_LEAVE"
            : "BOOKED";
      return { ...bed, status };
    }) : beds;

    return res.json({
      beds: responseBeds,
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

    await notifyActor(req, {
      title: "Bed Updated",
      message: `Bed ${bed.name} was updated successfully.`,
      type: "INFO",
    });

    await auditActor(req, actor, {
      action: "update",
      resource: "bed",
      resourceId: bed.id,
      description: `Bed ${bed.name} updated`,
      before: existing,
      after: bed,
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
        roomId: true,
        name: true,
        description: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
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

    await notifyActor(req, {
      title: "Bed Deleted",
      message: `Bed ${bed.name} was deleted successfully.`,
      type: "WARNING",
    });

    await auditActor(req, actor, {
      action: "delete",
      resource: "bed",
      resourceId: bed.id,
      description: `Bed ${bed.name} deleted`,
      before: bed,
    });

    return res.json({ message: "Bed deleted successfully" });
  } catch (error) {
    return handlePrismaError(error, res, {
      conflict: "Cannot delete a bed with dependent records",
      notFound: "Bed not found",
    });
  }
}
