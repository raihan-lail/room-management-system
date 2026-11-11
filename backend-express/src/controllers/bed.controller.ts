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
import * as XLSX from "xlsx";
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
    const isSingleDateStatusQuery = Boolean(dateParam);
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

    const dateStatusBookingStatuses: Record<Exclude<BedStatus, "VACANT">, Array<"CONFIRMED" | "IN_HOUSE" | "HOME_LEAVE">> = {
      BOOKED: ["CONFIRMED"],
      OCCUPIED: ["IN_HOUSE"],
      HOME_LEAVE: ["HOME_LEAVE"],
    };
    const occupiedOnDate: Prisma.BookingWhereInput = {
      status: { in: ["IN_HOUSE", "HOME_LEAVE"] },
      startedAt: { lt: dateEnd! },
      endedAt: { gt: dateStart! },
    };
    // A confirmed bed is BOOKED from its booking date through its start date.
    const bookedBeforeArrival: Prisma.BookingWhereInput = {
      status: "CONFIRMED",
      createdAt: { lt: dateEnd! },
      startedAt: { gte: dateStart! },
    };
    const singleDateBookingFilter: Prisma.BookingWhereInput = {
      OR: [occupiedOnDate, bookedBeforeArrival],
    };
    const statusFilteredBookingWhere: Prisma.BookingWhereInput | undefined =
      dateStart && statusParam && statusParam !== "VACANT"
        ? isSingleDateStatusQuery && statusParam === "BOOKED"
          ? bookedBeforeArrival
          : {
              status: {
                in: dateStatusBookingStatuses[
                  statusParam as Exclude<BedStatus, "VACANT">
                ],
              },
              startedAt: { lt: dateEnd! },
              endedAt: { gt: dateStart },
            }
        : undefined;

    const where: Prisma.BedWhereInput = {
      ...(!dateStart && statusParam
        ? { status: statusParam as BedStatus }
        : {}),
      ...(dateStart && statusParam === "VACANT"
        ? {
            bookings: {
              none: isSingleDateStatusQuery
                ? singleDateBookingFilter
                : {
                    status: { in: ["CONFIRMED", "IN_HOUSE", "HOME_LEAVE"] },
                    startedAt: { lt: dateEnd! },
                    endedAt: { gt: dateStart },
                  },
            },
          }
        : {}),
      ...(dateStart && statusParam && statusParam !== "VACANT"
        ? {
            bookings: {
              some: statusFilteredBookingWhere!,
              ...(statusParam === "BOOKED" ? { none: occupiedOnDate } : {}),
            },
          }
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

    const beds = await prisma.bed.findMany({
        where,
        include: {
          bookings: {
            where:
              statusFilteredBookingWhere ??
              (isSingleDateStatusQuery
                ? singleDateBookingFilter
                : {
                    status: { in: ["CONFIRMED", "IN_HOUSE", "HOME_LEAVE"] },
                    ...(dateStart ? { startedAt: { lt: dateEnd! }, endedAt: { gt: dateStart } } : {}),
                  }),
            orderBy: { startedAt: isSingleDateStatusQuery ? "asc" : "desc" },
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
    });
    const total = await prisma.bed.count({ where });

    const responseBeds = dateStart ? beds.map((bed) => {
      const activeStay = bed.bookings.find((booking) =>
        booking.status === "IN_HOUSE" || booking.status === "HOME_LEAVE",
      );
      const confirmedUpcoming = bed.bookings.find((booking) => booking.status === "CONFIRMED");
      const status: BedStatus = activeStay?.status === "IN_HOUSE"
        ? "OCCUPIED"
        : activeStay?.status === "HOME_LEAVE"
          ? "HOME_LEAVE"
          : confirmedUpcoming
            ? "BOOKED"
            : "VACANT";
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

const BOOKING_STATUS_BY_BED_STATUS = {
  BOOKED: "CONFIRMED",
  OCCUPIED: "IN_HOUSE",
  HOME_LEAVE: "HOME_LEAVE",
} as const;

export async function exportBedsToExcel(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const getParam = (...names: string[]) => {
      for (const name of names) {
        const value = req.query[name];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return "";
    };

    const statusInput = getParam("status").toUpperCase();
    if (statusInput && !BED_STATUSES.includes(statusInput as BedStatus)) {
      return res.status(400).json({
        message: "Invalid bed status filter",
        allowedStatuses: BED_STATUSES,
      });
    }

    const requestedSiteId = getParam("siteId", "site_id");
    if (requestedSiteId && !isGlobalSuperadmin(actor) && requestedSiteId !== actor.siteId) {
      return res.status(403).json({
        message: "You cannot export beds from another site.",
      });
    }

    const isActiveInput = getParam("isActive", "is_active").toLowerCase();
    if (isActiveInput && isActiveInput !== "true" && isActiveInput !== "false") {
      return res.status(400).json({
        message: "Invalid active filter. Use true or false.",
      });
    }

    const locationId = getParam("locationId", "location_id");
    const floorId = getParam("floorId", "floor_id");
    const roomId = getParam("roomId", "room_id");
    const roomName = getParam("roomName", "room_name", "room");
    const bedName = getParam("bedName", "bed_name", "bed");
    const search = getParam("search");
    const nationality = getParam("nationality", "country");

    const where: Prisma.BedWhereInput = {
      ...(statusInput ? { status: statusInput as BedStatus } : {}),
      ...(roomId ? { roomId } : {}),
      ...(isActiveInput ? { isActive: isActiveInput === "true" } : {}),
      ...(bedName
        ? { name: { contains: bedName, mode: "insensitive" } }
        : {}),
      ...(nationality
        ? {
            bookings: {
              some: {
                status: { in: ["CONFIRMED", "IN_HOUSE", "HOME_LEAVE"] },
                resident: {
                  nationality: { equals: nationality, mode: "insensitive" },
                },
              },
            },
          }
        : {}),
      room: {
        ...(roomName
          ? { name: { contains: roomName, mode: "insensitive" } }
          : {}),
        floor: {
          ...(floorId ? { id: floorId } : {}),
          location: {
            ...(locationId ? { id: locationId } : {}),
            ...(isGlobalSuperadmin(actor)
              ? requestedSiteId
                ? { siteId: requestedSiteId }
                : {}
              : { siteId: actor.siteId ?? NO_MATCHING_ID }),
          },
        },
      },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              {
                room: {
                  name: { contains: search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };

    const beds = await prisma.bed.findMany({
      where,
      include: {
        room: {
          include: {
            allocation: true,
            floor: {
              include: {
                location: {
                  include: { site: true },
                },
              },
            },
          },
        },
        bookings: {
          where: {
            status: { in: ["CONFIRMED", "IN_HOUSE", "HOME_LEAVE"] },
          },
          orderBy: { startedAt: "desc" },
          include: {
            resident: {
              include: { user: { select: { email: true } } },
            },
          },
        },
      },
      orderBy: [{ room: { name: "asc" } }, { name: "asc" }],
    });

    if (beds.length === 0) {
      return res.status(400).json({
        message: "No beds match the selected filters. Nothing to export.",
      });
    }

    const rows = beds.map((bed) => {
      const expectedBookingStatus =
        bed.status === "VACANT"
          ? null
          : BOOKING_STATUS_BY_BED_STATUS[bed.status];
      const bookingCandidates = expectedBookingStatus
        ? bed.bookings.filter(
            (booking) => booking.status === expectedBookingStatus,
          )
        : [];
      const booking =
        expectedBookingStatus === "CONFIRMED"
          ? bookingCandidates[bookingCandidates.length - 1]
          : bookingCandidates[0];
      const allocation = bed.room.allocation;
      const exportedBedStatus = allocation ? "ALLOCATED" : bed.status;

      return {
        "Site": bed.room.floor.location.site.name,
        "Location": bed.room.floor.location.name,
        "Floor": bed.room.floor.name,
        "Room": bed.room.name,
        "Room Type": bed.room.type,
        "Bed": bed.name,
        "Bed Status": exportedBedStatus,
        "Active": bed.isActive ? "Yes" : "No",
        "Booking ID": booking?.bookingNumber ?? "",
        "Booking Status": booking?.status ?? "",
        "Resident Name": booking?.resident.fullName ?? "",
        "Nationality": booking?.resident.nationality ?? "",
        "Meal Type": booking?.resident.mealType ?? "",
        "Gender": booking?.resident.gender ?? "",
        "Company": booking?.resident.company ?? "",
        "Department": booking?.resident.department ?? "",
        "Title": booking?.resident.title ?? "",
        "Email": booking?.resident.user.email ?? "",
        "Phone": booking?.resident.phone ?? "",
        "Start Date": booking?.startedAt.toDateString() ?? "",
        "End Date": booking?.endedAt.toDateString() ?? "",
        "Checked In At": booking?.checkedInAt?.toDateString() ?? "",
        "Checked Out At": booking?.checkedOutAt?.toDateString() ?? "",
        "Allocation Purpose": allocation?.purpose ?? "",
        "Allocation Description": allocation?.description ?? "",
        "Allocation Notes": allocation?.notes ?? "",
        "Allocated At": allocation?.createdAt.toDateString() ?? "",
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 20 },
      { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
      { wch: 20 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 14 },
      { wch: 12 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 28 },
      { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
      { wch: 24 }, { wch: 32 }, { wch: 32 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Beds");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const filename = `beds-${new Date().toISOString().slice(0, 10)}.xlsx`;

    await notifyActor(req, {
      title: "Bed data export successfully",
      message: `${beds.length} beds exported successfully`,
      type: "SUCCESS",
    });
    await auditActor(req, actor, {
      action: "Export",
      resource: "bed",
      description: `Exported ${beds.length} beds to an Excel file.`,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");

    res.status(200).send(buffer);
  } catch (error) {
    console.error("Export beds error:", error);

    if (res.headersSent) return;

    res.status(500).json({ message: "Failed to export beds." });
  }
}

