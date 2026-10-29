import type { Response } from "express";
import {
  BookingStatus,
  Gender,
  HomeLeaveStatus,
  Prisma,
} from "../generated/prisma/client.js";
import * as XLSX from "xlsx";

import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

import { getActorOrRespond, isGlobalSuperadmin, NO_MATCHING_ID } from "../utils/actor.js";
import {
  DEFAULT_PAGE_SIZE,
  IN_HOUSE_STATUSES,
  MAX_PAGE_SIZE,
  auditBooking,
  createBookingEvent,
  getSiteBedFilter,
  getSiteBookingFilter,
  getSiteDateRange,
  getSiteResidentFilter,
  parseDate,
  parsePositiveInteger,
  refreshBedStatus,
  sendError,
  validateBookingDates,
  type BookingTab,
} from "../helpers/booking.helper.js";
import { notifyActor } from "../services/notification.service.js";
import { auditActor } from "../services/audit.service.js";



function getHistoricalFrontDeskTabFilter(
  tab: string,
  start: Date,
  end: Date,
): Prisma.BookingWhereInput | null {
  const stayedDuringDate: Prisma.BookingWhereInput = {
    checkedInAt: { lt: end },
    OR: [{ checkedOutAt: null }, { checkedOutAt: { gte: start } }],
  };

  switch (tab) {
    case "arrival":
      return {
        OR: [
          { status: BookingStatus.CONFIRMED, startedAt: { lt: end } },
          { checkedInAt: { gte: start, lt: end } },
        ],
      };
    case "in-house":
      return stayedDuringDate;
    case "near-end": {
      const threeDaysLater = new Date(start);
      threeDaysLater.setUTCDate(threeDaysLater.getUTCDate() + 3);
      return {
        AND: [stayedDuringDate, { endedAt: { gte: start, lt: threeDaysLater } }],
      };
    }
    case "departure":
      return {
        OR: [
          {
            AND: [stayedDuringDate, { endedAt: { gte: start, lt: end } }],
          },
          { checkedOutAt: { gte: start, lt: end } },
        ],
      };
    case "home-leave":
    case "home_leave":
      return {
        homeLeaves: {
          some: {
            status: { in: [HomeLeaveStatus.ACTIVE, HomeLeaveStatus.RETURNED] },
            startedAt: { lt: end },
            OR: [{ returnedAt: null }, { returnedAt: { gte: start } }],
          },
        },
      };
    default:
      return null;
  }
}

export async function listBookings(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const page = parsePositiveInteger(req.query.page, 1);
    const limit = parsePositiveInteger(
      req.query.limit,
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );

    const skip = (page - 1) * limit;
    const tab = req.query.tab;
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const where: Prisma.BookingWhereInput = {
      AND: [getSiteBookingFilter(actor)],
    };

    if (tab !== undefined) {
      if (
        typeof tab !== "string" ||
        ![
          "arrival",
          "in-house",
          "near-end",
          "departure",
          "home-leave",
        ].includes(tab)
      ) {
        sendError(res, 400, "Invalid booking tab.");
        return;
      }

      const todayString =
        typeof req.query.date === "string"
          ? req.query.date
          : new Date().toISOString().slice(0, 10);

      const today = getSiteDateRange(todayString);

      if (!today) {
        sendError(res, 400, "Invalid date. Use YYYY-MM-DD.");
        return;
      }

      const { start, end } = today;

      switch (tab as BookingTab) {
        case "arrival":
          if (req.query.history === "true") {
            where.AND = [
              getSiteBookingFilter(actor),
              getHistoricalFrontDeskTabFilter("arrival", start, end)!,
            ];
          } else {
            where.status = BookingStatus.CONFIRMED;
            where.startedAt = { lt: end };
          }
          break;

        case "in-house":
          if (req.query.history === "true") {
            where.AND = [
              getSiteBookingFilter(actor),
              getHistoricalFrontDeskTabFilter("in-house", start, end)!,
            ];
          } else {
            where.status = { in: IN_HOUSE_STATUSES };
          }
          break;

        case "home-leave":
          where.status = BookingStatus.HOME_LEAVE;
          break;

        case "near-end": {
          if (req.query.history === "true") {
            where.AND = [
              getSiteBookingFilter(actor),
              getHistoricalFrontDeskTabFilter("near-end", start, end)!,
            ];
          } else {
            const twoDaysLater = new Date(start);
            twoDaysLater.setUTCDate(twoDaysLater.getUTCDate() + 3);

            where.status = { in: IN_HOUSE_STATUSES };
            where.endedAt = { gte: start, lt: twoDaysLater };
          }
          break;
        }

        case "departure":
          if (req.query.history === "true") {
            where.AND = [
              getSiteBookingFilter(actor),
              getHistoricalFrontDeskTabFilter("departure", start, end)!,
            ];
          } else {
            where.status = { in: IN_HOUSE_STATUSES };
            where.endedAt = { gte: start, lt: end };
          }
          break;
      }
    }

    if (req.query.status !== undefined) {
      const requestedStatus = req.query.status;

      if (
        typeof requestedStatus !== "string" ||
        !Object.values(BookingStatus).includes(
          requestedStatus as BookingStatus
        )
      ) {
        sendError(res, 400, "Invalid booking status.");
        return;
      }

      where.status = requestedStatus as BookingStatus;
    }

    if (req.query.startedAtFrom || req.query.startedAtTo) {
      const from = req.query.startedAtFrom
        ? parseDate(req.query.startedAtFrom)
        : null;
      const to = req.query.startedAtTo
        ? parseDate(req.query.startedAtTo)
        : null;

      if (
        (req.query.startedAtFrom && !from) ||
        (req.query.startedAtTo && !to)
      ) {
        sendError(res, 400, "Invalid startedAt filter.");
        return;
      }

      where.startedAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    if (req.query.endedAtFrom || req.query.endedAtTo) {
      const from = req.query.endedAtFrom
        ? parseDate(req.query.endedAtFrom)
        : null;
      const to = req.query.endedAtTo
        ? parseDate(req.query.endedAtTo)
        : null;

      if (
        (req.query.endedAtFrom && !from) ||
        (req.query.endedAtTo && !to)
      ) {
        sendError(res, 400, "Invalid endedAt filter.");
        return;
      }

      where.endedAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    if (req.query.overlapStart !== undefined || req.query.overlapEnd !== undefined) {
      const overlapStart = parseDate(req.query.overlapStart);
      const overlapEnd = parseDate(req.query.overlapEnd);
      if (!overlapStart || !overlapEnd || overlapStart >= overlapEnd) {
        sendError(res, 400, "Valid overlapStart and overlapEnd dates are required.");
        return;
      }
      where.startedAt = { lt: overlapEnd };
      where.endedAt = { gt: overlapStart };
    }

    if (req.query.residentId) {
      if (typeof req.query.residentId !== "string") {
        sendError(res, 400, "Invalid residentId.");
        return;
      }

      where.residentId = req.query.residentId;
    }

    if (req.query.bedId) {
      if (typeof req.query.bedId !== "string") {
        sendError(res, 400, "Invalid bedId.");
        return;
      }

      where.bedId = req.query.bedId;
    }

    if (search) {
      where.AND = [
        getSiteBookingFilter(actor),
        {
          OR: [
            {
              bookingNumber: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              resident: {
                fullName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              resident: {
                phone: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              resident: {
                user: {
                  email: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              bed: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              bed: {
                room: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        },
      ];
    }

    const [total, bookings] = await prisma.$transaction([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { startedAt: "asc" },
          { createdAt: "desc" },
        ],
        include: {
          resident: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              gender: true,
              nationality: true,
              mealType: true,
              company: true,
              department: true,
              title: true,
              user: {
                select: {
                  email: true,
                  isActive: true,
                },
              },
            },
          },
          bed: {
            include: {
              room: {
                include: {
                  floor: {
                    include: {
                      location: {
                        include: {
                          site: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          homeLeaves: {
            orderBy: { startedAt: "desc" },
          },
        },
      }),
    ]);

    res.status(200).json({
      data: bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List bookings error:", error);
    sendError(res, 500, "Failed to retrieve bookings.");
  }
}

export async function exportBookingsToExcel(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const getParam = (...names: string[]) => {
      for (const name of names) {
        const value = req.query[name];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return "";
    };

    const dateRange = (fromValue: string, toValue: string) => {
      const fromIsDay = /^\d{4}-\d{2}-\d{2}$/.test(fromValue);
      const toIsDay = /^\d{4}-\d{2}-\d{2}$/.test(toValue);
      const fromRange = fromIsDay
        ? getSiteDateRange(fromValue)
        : null;
      const toRange = toIsDay
        ? getSiteDateRange(toValue)
        : null;
      const from = fromValue
        ? (fromRange?.start ?? (fromIsDay ? null : parseDate(fromValue)))
        : null;
      const to = toValue
        ? (toRange?.end ?? (toIsDay ? null : parseDate(toValue)))
        : null;
      if ((fromValue && !from) || (toValue && !to)) return null;
      return {
        ...(from ? { gte: from } : {}),
        ...(to ? (toRange ? { lt: to } : { lte: to }) : {}),
      };
    };

    const requestedSiteId = getParam("siteId", "site_id");
    if (requestedSiteId && !isGlobalSuperadmin(actor) && requestedSiteId !== actor.siteId) {
      sendError(res, 403, "You cannot export bookings from another site.");
      return;
    }

    const bookedAtExact = getParam("bookedAt", "booked_at", "bookedDate");
    const bookedAtFrom = getParam("bookedAtFrom", "booked_at_from", "createdAtFrom") || bookedAtExact;
    const bookedAtTo = getParam("bookedAtTo", "booked_at_to", "createdAtTo") || bookedAtExact;
    const startedAtExact = getParam("startedAt", "started_at", "startedDate");
    const startedAtFrom = getParam("startedAtFrom", "started_at_from") || startedAtExact;
    const startedAtTo = getParam("startedAtTo", "started_at_to") || startedAtExact;
    const bookedAtFilter = dateRange(bookedAtFrom, bookedAtTo);
    const startedAtFilter = dateRange(startedAtFrom, startedAtTo);
    if (bookedAtFilter === null || startedAtFilter === null) {
      sendError(res, 400, "Invalid date filter. Use YYYY-MM-DD or a valid date-time.");
      return;
    }

    const genderInput = getParam("gender").toUpperCase();
    if (genderInput && !Object.values(Gender).includes(genderInput as Gender)) {
      sendError(res, 400, "Invalid gender filter.");
      return;
    }
    const statusInput = getParam("status").toUpperCase();
    if (statusInput && !Object.values(BookingStatus).includes(statusInput as BookingStatus)) {
      sendError(res, 400, "Invalid booking status filter.");
      return;
    }

    const residentFilters: Prisma.ResidentWhereInput = {};
    const residentName = getParam("residentName", "resident_name", "name");
    const nationality = getParam("country", "nationality");
    const company = getParam("company");
    const title = getParam("title");
    const mealType = getParam("mealType", "meal_type");
    const department = getParam("department");
    if (residentName) residentFilters.fullName = { contains: residentName, mode: "insensitive" };
    if (nationality) residentFilters.nationality = { contains: nationality, mode: "insensitive" };
    if (company) residentFilters.company = { contains: company, mode: "insensitive" };
    if (title) residentFilters.title = { contains: title, mode: "insensitive" };
    if (mealType) residentFilters.mealType = { contains: mealType, mode: "insensitive" };
    if (department) residentFilters.department = { contains: department, mode: "insensitive" };
    if (genderInput) residentFilters.gender = genderInput as Gender;

    const roomName = getParam("roomName", "room_name", "room");
    const bedName = getParam("bedName", "bed_name", "bed");
    const bedFilters: Prisma.BedWhereInput = {};
    if (roomName) bedFilters.room = { name: { contains: roomName, mode: "insensitive" } };
    if (bedName) bedFilters.name = { contains: bedName, mode: "insensitive" };

    const search = getParam("search");
    const frontdeskTab = getParam("frontdeskTab");
    const frontdeskDate = getParam("date");
    const frontdeskRange = frontdeskDate ? getSiteDateRange(frontdeskDate) : null;
    if (frontdeskTab && !["arrival", "in-house", "home_leave", "near-end", "departure"].includes(frontdeskTab)) {
      sendError(res, 400, "Invalid frontdesk tab.");
      return;
    }
    if (frontdeskDate && !frontdeskRange) {
      sendError(res, 400, "Invalid frontdesk date. Use YYYY-MM-DD.");
      return;
    }
    const tabFilters: Prisma.BookingWhereInput[] = [];
    if (frontdeskTab && frontdeskRange) {
      const { start, end } = frontdeskRange;
      switch (frontdeskTab) {
        case "arrival":
          if (req.query.frontdeskHistory === "true") {
            tabFilters.push(getHistoricalFrontDeskTabFilter("arrival", start, end)!);
          } else {
            tabFilters.push({ status: BookingStatus.CONFIRMED }, { startedAt: { lt: end } });
          }
          break;
        case "in-house":
          tabFilters.push(req.query.frontdeskHistory === "true"
            ? getHistoricalFrontDeskTabFilter("in-house", start, end)!
            : { status: { in: IN_HOUSE_STATUSES } });
          break;
        case "home_leave":
          if (req.query.frontdeskHistory === "true") {
            tabFilters.push(getHistoricalFrontDeskTabFilter("home_leave", start, end)!);
          } else {
            tabFilters.push(
              { status: BookingStatus.HOME_LEAVE },
              { startedAt: { lte: end } },
              { endedAt: { gte: start } },
            );
          }
          break;
        case "near-end": {
          if (req.query.frontdeskHistory === "true") {
            tabFilters.push(getHistoricalFrontDeskTabFilter("near-end", start, end)!);
          } else {
            const threeDaysLater = new Date(start);
            threeDaysLater.setUTCDate(threeDaysLater.getUTCDate() + 3);
            tabFilters.push({ status: { in: IN_HOUSE_STATUSES } }, { endedAt: { gte: start, lt: threeDaysLater } });
          }
          break;
        }
        case "departure":
          if (req.query.frontdeskHistory === "true") {
            tabFilters.push(getHistoricalFrontDeskTabFilter("departure", start, end)!);
          } else {
            tabFilters.push({ status: { in: IN_HOUSE_STATUSES } }, { endedAt: { gte: start, lt: end } });
          }
          break;
      }
    }
    const siteFilter: Prisma.BookingWhereInput = requestedSiteId
      ? {
          bed: {
            room: {
              floor: {
                location: {
                  siteId: requestedSiteId,
                },
              },
            },
          },
        }
      : {};
    const searchFilter: Prisma.BookingWhereInput | null = search
      ? {
          OR: [
            {
              resident: {
                fullName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              resident: {
                nationality: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              resident: {
                company: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              resident: {
                title: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              bed: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              bed: {
                room: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : null;

    const andFilters: Prisma.BookingWhereInput[] = [
      getSiteBookingFilter(actor),
      ...tabFilters,
      siteFilter,
      ...(bookedAtFilter ? [{ createdAt: bookedAtFilter }] : []),
      ...(startedAtFilter ? [{ startedAt: startedAtFilter }] : []),
      ...(statusInput ? [{ status: statusInput as BookingStatus }] : []),
      ...(Object.keys(residentFilters).length
        ? [{ resident: residentFilters }]
        : []),
      ...(Object.keys(bedFilters).length ? [{ bed: bedFilters }] : []),
      ...(searchFilter ? [searchFilter] : []),
    ];

    const bookings = await prisma.booking.findMany({
      where: { AND: andFilters },
      include: {
        resident: {
          select: {
            fullName: true,
            nationality: true,
            mealType: true,
            gender: true,
            company: true,
            department: true,
            title: true,
          },
        },
        bed: { include: { room: { select: { name: true } } } },
      },
      orderBy: [{ createdAt: "desc" }, { startedAt: "asc" }],
    });

    if (bookings.length === 0) {
      sendError(res, 400, "No bookings match the selected filters. Nothing to export.");
      return;
    }

    const rows = bookings.map((booking) => ({
      "Booking ID": booking.bookingNumber,
      "Room": booking.bed.room.name,
      "Bed": booking.bed.name,
      "Booking Status": booking.status,
      "Resident Name": booking.resident.fullName,
      Nationality: booking.resident.nationality ?? "",
      "Meal Type": booking.resident.mealType,
      Gender: booking.resident.gender,
      Company: booking.resident.company ?? "",
      Department: booking.resident.department,
      Title: booking.resident.title ?? "",
      "Started At": booking.startedAt.toDateString(),
      "Ended At": booking.endedAt.toDateString(),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 20 },
      { wch: 18 }, { wch: 14 }, { wch: 25 }, { wch: 20 }, { wch: 24 }, { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bookings");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const filename = `bookings-${new Date().toISOString().slice(0, 10)}.xlsx`;

    await notifyActor(req, {
      title: "Booking data export successfully",
      message: `${bookings.length} bookings exported successfully`,
      type: "SUCCESS",
    });
    await auditActor(req, actor, {
      action: "Export",
      resource: "booking",
      description: `Exported ${bookings.length} bookings to an Excel file.`,
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");

    res.status(200).send(buffer);
  } catch (error) {
    console.error("Export bookings error:", error);

    if (res.headersSent) return;

    sendError(res, 500, "Failed to export bookings.");
  }
}

export async function getBookingById(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const booking = await prisma.booking.findFirst({
      where: {
        id: req.params.id as string,
        ...getSiteBookingFilter(actor),
      },
      include: {
        resident: {
          include: {
            user: {
              select: {
                email: true,
                isActive: true,
              },
            },
            site: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        bed: {
          include: {
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
        },
        homeLeaves: {
          orderBy: { startedAt: "desc" },
        },
        complaints: {
          orderBy: { createdAt: "desc" },
        },
        events: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!booking) {
      sendError(res, 404, "Booking not found.");
      return;
    }

    res.status(200).json({ data: booking });
  } catch (error) {
    console.error("Get booking error:", error);
    sendError(res, 500, "Failed to retrieve booking.");
  }
}

export async function createBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const {
      residentId,
      bedId,
      startedAt: startedAtInput,
      endedAt: endedAtInput,
      notes,
    } = req.body;

    if (
      typeof residentId !== "string" ||
      typeof bedId !== "string"
    ) {
      sendError(res, 400, "residentId and bedId are required.");
      return;
    }

    const startedAt = parseDate(startedAtInput);
    const endedAt = parseDate(endedAtInput);

    if (!startedAt || !endedAt || startedAt >= endedAt) {
      sendError(
        res,
        400,
        "Valid startedAt and endedAt dates are required; endedAt must be after startedAt."
      );
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const resident = await tx.resident.findFirst({
        where: {
          id: residentId,
          ...getSiteResidentFilter(actor),
          user: { isActive: true },
        },
      });
      const bed = await tx.bed.findFirst({
        where: {
          id: bedId,
          isActive: true,
          ...getSiteBedFilter(actor),
          room: {
            isBookable: true,
            floor: {
              location: {
                siteId: isGlobalSuperadmin(actor)
                  ? undefined
                  : actor.siteId ?? NO_MATCHING_ID,
              },
            },
          },
        },
      });

      if (!resident) {
        throw Object.assign(new Error("Resident not found or not accessible."), {
          statusCode: 404,
        });
      }

      if (!bed) {
        throw Object.assign(new Error("Bed not found, inactive, or not bookable."), {
          statusCode: 404,
        });
      }

      const conflict = await validateBookingDates(tx, {
        bedId,
        startedAt,
        endedAt,
      });

      if (conflict) {
        throw Object.assign(new Error(conflict), {
          statusCode: 409,
        });
      }

      const booking = await tx.booking.create({
        data: {
          residentId,
          bedId,
          startedAt,
          endedAt,
          status: BookingStatus.CONFIRMED,
          notes:
            typeof notes === "string" && notes.trim()
              ? notes.trim()
              : null,
        },
        include: {
          resident: true,
          bed: {
            include: { room: true },
          },
        },
      });

      await refreshBedStatus(tx, bedId);

      await createBookingEvent(tx, {
        bookingId: booking.id,
        actorUserId: req.userId!,
        action: "booking_created",
        description: "Booking confirmed by receptionist.",
        metadata: {
          residentId,
          bedId,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
        },
      });

      return booking;
    });

    await auditBooking(req, actor, {
      bookingId: result.bookingNumber,
      action: "booking_created",
      description: `Booking ${result.bookingNumber} created for resident ${result.resident.fullName}.`,
    });

    await notifyActor(req, {
      title: "Booking Successfully Created",
      message:`Booking ${result.bookingNumber} successfully created for resident ${result.resident.fullName}`,
      type: "SUCCESS"
    })


    res.status(201).json({
      message: "Booking created successfully.",
      data: result,
    });
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 0;

    if (statusCode) {
      sendError(res, statusCode, (error as Error).message);
      return;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      sendError(res, 409, "A conflicting booking already exists.");
      return;
    }

    console.error("Create booking error:", error);
    sendError(res, 500, "Failed to create booking.");
  }
}

export async function checkInBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findFirst({
        where: {
          id: req.params.id as string,
          ...getSiteBookingFilter(actor),
        },
      });

      if (!existing) {
        throw Object.assign(new Error("Booking not found."), {
          statusCode: 404,
        });
      }

      if (existing.status !== BookingStatus.CONFIRMED) {
        throw Object.assign(
          new Error("Only confirmed bookings can be checked in."),
          { statusCode: 409 }
        );
      }

      const updated = await tx.booking.updateMany({
        where: {
          id: existing.id,
          status: BookingStatus.CONFIRMED,
        },
        data: {
          status: BookingStatus.IN_HOUSE,
          checkedInAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        throw Object.assign(
          new Error("The booking was changed by another request."),
          { statusCode: 409 }
        );
      }

      const result = await tx.booking.findUniqueOrThrow({
        where: { id: existing.id },
        include: {
          resident: true,
          bed: { include: { room: true } },
        },
      });

      await refreshBedStatus(tx, existing.bedId);

      await createBookingEvent(tx, {
        bookingId: existing.id,
        actorUserId: req.userId!,
        action: "checked_in",
        description: "Resident checked in.",
      });

      return result;
    });

    await auditBooking(req, actor, {
      bookingId: booking.bookingNumber,
      action: "booking_checked_in",
      description: "Resident checked in.",
    })

    await notifyActor(req, {
      title: "Resident checked in",
      message: `Resident ${booking.resident.fullName} with booking id ${booking.bookingNumber} successfully checked in`,
      type: "SUCCESS"
    })

    res.status(200).json({
      message: "Resident checked in successfully.",
      data: booking,
    });
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 0;

    if (statusCode) {
      sendError(res, statusCode, (error as Error).message);
      return;
    }

    console.error("Check-in error:", error);
    sendError(res, 500, "Failed to check in resident.");
  }
}

export async function cancelBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const reason =
      typeof req.body.reason === "string"
        ? req.body.reason.trim()
        : "Cancelled by receptionist";

    const booking = await prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findFirst({
        where: {
          id: req.params.id as string,
          ...getSiteBookingFilter(actor),
        },
      });

      if (!existing) {
        throw Object.assign(new Error("Booking not found."), {
          statusCode: 404,
        });
      }

      if (existing.status !== BookingStatus.CONFIRMED) {
        throw Object.assign(
          new Error("Only confirmed bookings can be cancelled using this endpoint."),
          { statusCode: 409 }
        );
      }

      const updated = await tx.booking.updateMany({
        where: {
          id: existing.id,
          status: BookingStatus.CONFIRMED,
        },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });

      if (updated.count !== 1) {
        throw Object.assign(
          new Error("The booking was changed by another request."),
          { statusCode: 409 }
        );
      }

      await refreshBedStatus(tx, existing.bedId);

      await createBookingEvent(tx, {
        bookingId: existing.id,
        actorUserId: req.userId!,
        action: "booking_cancelled",
        description: reason,
      });

      return tx.booking.findUniqueOrThrow({
        where: { id: existing.id },
        include: { resident: true, bed: true },
      });
    });

    await auditBooking(req, actor, {
      bookingId: booking.bookingNumber,
      action: "booking_cancelled",
      description: reason,
    });

    await notifyActor( req, {
      title: "Booking cancelled",
      message: `Booking ${booking.bookingNumber} cancelled`
    })

    res.status(200).json({
      message: "Booking cancelled successfully.",
      data: booking,
    });
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 0;

    if (statusCode) {
      sendError(res, statusCode, (error as Error).message);
      return;
    }

    console.error("Cancel booking error:", error);
    sendError(res, 500, "Failed to cancel booking.");
  }
}

export async function startHomeLeave(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const expectedReturnAt = parseDate(req.body.expectedReturnAt);

    if (!expectedReturnAt || expectedReturnAt <= new Date()) {
      sendError(
        res,
        400,
        "expectedReturnAt must be a valid future date."
      );
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: {
          id: req.params.id as string,
          ...getSiteBookingFilter(actor),
        },
      });

      if (!booking) {
        throw Object.assign(new Error("Booking not found."), {
          statusCode: 404,
        });
      }

      if (booking.status !== BookingStatus.IN_HOUSE) {
        throw Object.assign(
          new Error("Only in-house residents can start home leave."),
          { statusCode: 409 }
        );
      }

      if (expectedReturnAt > booking.endedAt) {
        throw Object.assign(
          new Error("Expected return cannot be later than the booking end date."),
          { statusCode: 400 }
        );
      }

      const updated = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: BookingStatus.IN_HOUSE,
        },
        data: {
          status: BookingStatus.HOME_LEAVE,
        },
      });

      if (updated.count !== 1) {
        throw Object.assign(
          new Error("The booking was changed by another request."),
          { statusCode: 409 }
        );
      }

      const homeLeave = await tx.homeLeave.create({
        data: {
          bookingId: booking.id,
          startedAt: new Date(),
          expectedReturnAt,
          reason:
            typeof req.body.reason === "string"
              ? req.body.reason.trim() || null
              : null,
          status: HomeLeaveStatus.ACTIVE,
        },
      });

      await refreshBedStatus(tx, booking.bedId);

      await createBookingEvent(tx, {
        bookingId: booking.id,
        actorUserId: req.userId!,
        action: "home_leave_started",
        description: "Resident started home leave.",
        metadata: {
          homeLeaveId: homeLeave.id,
          expectedReturnAt: expectedReturnAt.toISOString(),
        },
      });

      return { bookingId: booking.id, homeLeave };
    });

    await auditBooking(req, actor, {
      bookingId: result.bookingId,
      action: "home_leave_started",
      description: "Resident started home leave.",
    });

    await notifyActor(req, {
      title:" Resident started home leave",
      message: `Resident with booking id ${result.bookingId} started home leave`
    })

    res.status(201).json({
      message: "Home leave recorded successfully.",
      data: result.homeLeave,
    });
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 0;

    if (statusCode) {
      sendError(res, statusCode, (error as Error).message);
      return;
    }

    console.error("Start home leave error:", error);
    sendError(res, 500, "Failed to record home leave.");
  }
}

export async function returnFromHomeLeave(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: {
          id: req.params.id as string,
          ...getSiteBookingFilter(actor),
        },
      });

      if (!booking) {
        throw Object.assign(new Error("Booking not found."), {
          statusCode: 404,
        });
      }

      if (booking.status !== BookingStatus.HOME_LEAVE) {
        throw Object.assign(
          new Error("This booking is not currently on home leave."),
          { statusCode: 409 }
        );
      }

      const activeLeave = await tx.homeLeave.findFirst({
        where: {
          bookingId: booking.id,
          status: HomeLeaveStatus.ACTIVE,
        },
        orderBy: { startedAt: "desc" },
      });

      if (!activeLeave) {
        throw Object.assign(
          new Error("Active home leave record not found."),
          { statusCode: 409 }
        );
      }

      const leaveUpdated = await tx.homeLeave.updateMany({
        where: {
          id: activeLeave.id,
          status: HomeLeaveStatus.ACTIVE,
        },
        data: {
          status: HomeLeaveStatus.RETURNED,
          returnedAt: new Date(),
        },
      });

      if (leaveUpdated.count !== 1) {
        throw Object.assign(
          new Error("Home leave was changed by another request."),
          { statusCode: 409 }
        );
      }

      const bookingUpdated = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: BookingStatus.HOME_LEAVE,
        },
        data: {
          status: BookingStatus.IN_HOUSE,
        },
      });

      if (bookingUpdated.count !== 1) {
        throw Object.assign(
          new Error("The booking was changed by another request."),
          { statusCode: 409 }
        );
      }

      await refreshBedStatus(tx, booking.bedId);

      await createBookingEvent(tx, {
        bookingId: booking.id,
        actorUserId: req.userId!,
        action: "home_leave_returned",
        description: "Resident returned from home leave.",
        metadata: { homeLeaveId: activeLeave.id },
      });

      return tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { resident: true, bed: true, homeLeaves: true },
      });
    });

    await auditBooking(req, actor, {
      bookingId: result.id,
      action: "home_leave_returned",
      description: "Resident returned from home leave.",
    });

    await notifyActor(req, {
      title:"Resident returned from home leave",
      message:`Resident ${result.resident.fullName} with booking id ${result.id} returned from home leave`,
    })

    res.status(200).json({
      message: "Resident return recorded successfully.",
      data: result,
    });
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 0;

    if (statusCode) {
      sendError(res, statusCode, (error as Error).message);
      return;
    }

    console.error("Return from home leave error:", error);
    sendError(res, 500, "Failed to record resident return.");
  }
}

export async function listHomeLeaves(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const page = parsePositiveInteger(req.query.page, 1);
    const limit = parsePositiveInteger(
      req.query.limit,
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";
    const status = req.query.status;

    const where: Prisma.HomeLeaveWhereInput = {
      booking: getSiteBookingFilter(actor),
    };

    if (status !== undefined) {
      if (
        typeof status !== "string" ||
        !Object.values(HomeLeaveStatus).includes(status as HomeLeaveStatus)
      ) {
        sendError(res, 400, "Invalid home leave status.");
        return;
      }

      where.status = status as HomeLeaveStatus;
    }

    if (search) {
      where.OR = [
        { reason: { contains: search, mode: "insensitive" } },
        {
          booking: {
            bookingNumber: { contains: search, mode: "insensitive" },
          },
        },
        {
          booking: {
            resident: {
              fullName: { contains: search, mode: "insensitive" },
            },
          },
        },
        {
          booking: {
            bed: {
              room: {
                name: { contains: search, mode: "insensitive" },
              },
            },
          },
        },
      ];
    }

    const [total, homeLeaves] = await prisma.$transaction([
      prisma.homeLeave.count({ where }),
      prisma.homeLeave.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: "desc" },
        include: {
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              status: true,
              resident: {
                select: { fullName: true },
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
        },
      }),
    ]);

    res.status(200).json({
      data: homeLeaves,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List home leaves error:", error);
    sendError(res, 500, "Failed to retrieve home leaves.");
  }
}

export async function updateBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const { residentId, bedId, startedAt: startedAtInput, endedAt: endedAtInput, notes } = req.body ?? {};
    const allowedFields = new Set(["residentId", "bedId", "startedAt", "endedAt", "notes"]);
    const unsupportedField = Object.keys(req.body ?? {}).find((field) => !allowedFields.has(field));
    if (unsupportedField) {
      sendError(res, 400, `Unsupported booking field: ${unsupportedField}.`);
      return;
    }
    if (Object.keys(req.body ?? {}).length === 0) {
      sendError(res, 400, "At least one booking field must be provided.");
      return;
    }
    if (residentId !== undefined && (typeof residentId !== "string" || !residentId.trim())) {
      sendError(res, 400, "residentId must be a non-empty string.");
      return;
    }
    if (bedId !== undefined && (typeof bedId !== "string" || !bedId.trim())) {
      sendError(res, 400, "bedId must be a non-empty string.");
      return;
    }
    if (startedAtInput !== undefined && !parseDate(startedAtInput)) {
      sendError(res, 400, "startedAt must be a valid date.");
      return;
    }
    if (endedAtInput !== undefined && !parseDate(endedAtInput)) {
      sendError(res, 400, "endedAt must be a valid date.");
      return;
    }
    if (notes !== undefined && notes !== null && typeof notes !== "string") {
      sendError(res, 400, "notes must be a string or null.");
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.booking.findFirst({
        where: { id: req.params.id as string, ...getSiteBookingFilter(actor) },
        include: { resident: true, bed: { include: { room: true } } },
      });
      if (!before) {
        throw Object.assign(new Error("Booking not found."), { statusCode: 404 });
      }
      if (before.status !== BookingStatus.CONFIRMED) {
        throw Object.assign(new Error("Only confirmed bookings can be edited."), { statusCode: 409 });
      }

      const targetResidentId = residentId ?? before.residentId;
      const targetBedId = bedId ?? before.bedId;
      const targetStartedAt = startedAtInput !== undefined ? parseDate(startedAtInput)! : before.startedAt;
      const targetEndedAt = endedAtInput !== undefined ? parseDate(endedAtInput)! : before.endedAt;

      if (residentId !== undefined) {
        const resident = await tx.resident.findFirst({
          where: { id: targetResidentId, ...getSiteResidentFilter(actor), user: { isActive: true } },
          select: { id: true },
        });
        if (!resident) {
          throw Object.assign(new Error("Resident not found or not accessible."), { statusCode: 404 });
        }
      }
      if (bedId !== undefined) {
        const bed = await tx.bed.findFirst({
          where: {
            id: targetBedId,
            isActive: true,
            ...getSiteBedFilter(actor),
            room: {
              isBookable: true,
              floor: {
                location: {
                  siteId: isGlobalSuperadmin(actor) ? undefined : actor.siteId ?? NO_MATCHING_ID,
                },
              },
            },
          },
          select: { id: true },
        });
        if (!bed) {
          throw Object.assign(new Error("Bed not found, inactive, or not bookable."), { statusCode: 404 });
        }
      }

      const conflict = await validateBookingDates(tx, {
        bedId: targetBedId,
        startedAt: targetStartedAt,
        endedAt: targetEndedAt,
        excludeBookingId: before.id,
      });
      if (conflict) {
        throw Object.assign(new Error(conflict), { statusCode: 409 });
      }

      const after = await tx.booking.update({
        where: { id: before.id },
        data: {
          ...(residentId !== undefined ? { residentId: targetResidentId } : {}),
          ...(bedId !== undefined ? { bedId: targetBedId } : {}),
          ...(startedAtInput !== undefined ? { startedAt: targetStartedAt } : {}),
          ...(endedAtInput !== undefined ? { endedAt: targetEndedAt } : {}),
          ...(notes !== undefined ? { notes: typeof notes === "string" ? notes.trim() || null : null } : {}),
        },
        include: { resident: true, bed: { include: { room: true } } },
      });

      if (before.bedId !== after.bedId) {
        await refreshBedStatus(tx, before.bedId);
        await refreshBedStatus(tx, after.bedId);
      } else if (before.startedAt.getTime() !== after.startedAt.getTime() || before.endedAt.getTime() !== after.endedAt.getTime()) {
        await refreshBedStatus(tx, after.bedId);
      }

      await createBookingEvent(tx, {
        bookingId: after.id,
        actorUserId: req.userId!,
        action: "booking_updated",
        description: "Booking details updated.",
        metadata: {
          previous: {
            residentId: before.residentId,
            bedId: before.bedId,
            startedAt: before.startedAt.toISOString(),
            endedAt: before.endedAt.toISOString(),
            notes: before.notes,
          },
          updated: {
            residentId: after.residentId,
            bedId: after.bedId,
            startedAt: after.startedAt.toISOString(),
            endedAt: after.endedAt.toISOString(),
            notes: after.notes,
          },
        },
      });
      return after;
    });

    await auditBooking(req, actor, {
      bookingId: result.id,
      action: "booking_updated",
      description: `Booking details updated for resident ${result.resident.fullName}.`,
    });
    await notifyActor(req, {
      title: "Booking Updated",
      message: `Booking for ${result.resident.fullName} was updated successfully.`,
      type: "INFO",
    });
    res.status(200).json({ message: "Booking updated successfully.", data: result });
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 0;
    if (statusCode) {
      sendError(res, statusCode, (error as Error).message);
      return;
    }
    console.error("Update booking error:", error);
    sendError(res, 500, "Failed to update booking.");
  }
}

export async function extendBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const newEndedAt = parseDate(req.body.endedAt);

    if (!newEndedAt) {
      sendError(res, 400, "A valid endedAt date is required.");
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: {
          id: req.params.id as string,
          ...getSiteBookingFilter(actor),
        },
      });

      if (!booking) {
        throw Object.assign(new Error("Booking not found."), {
          statusCode: 404,
        });
      }

      if (!IN_HOUSE_STATUSES.includes(booking.status)) {
        throw Object.assign(
          new Error("Only current stays can be extended."),
          { statusCode: 409 }
        );
      }

      if (newEndedAt <= booking.endedAt) {
        throw Object.assign(
          new Error("The new end date must be later than the current end date."),
          { statusCode: 400 }
        );
      }

      const conflict = await validateBookingDates(tx, {
        bedId: booking.bedId,
        startedAt: booking.startedAt,
        endedAt: newEndedAt,
        excludeBookingId: booking.id,
      });

      if (conflict) {
        throw Object.assign(new Error(conflict), {
          statusCode: 409,
        });
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { endedAt: newEndedAt },
        include: { resident: true, bed: true },
      });

      await createBookingEvent(tx, {
        bookingId: booking.id,
        actorUserId: req.userId!,
        action: "booking_extended",
        description: "Booking end date extended.",
        metadata: {
          previousEndedAt: booking.endedAt.toISOString(),
          newEndedAt: newEndedAt.toISOString(),
        },
      });

      return updated;
    });

    await auditBooking(req, actor, {
      bookingId: result.id,
      action: "booking_extended",
      description: `Booking extended until ${newEndedAt.toISOString()}.`,
    });

    await notifyActor(req, {
      title:"Booking Extended",
      message: `Booking ${result.bookingNumber} for resident ${result.resident.fullName} successfully extended`
    })

    res.status(200).json({
      message: "Booking extended successfully.",
      data: result,
    });
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 0;

    if (statusCode) {
      sendError(res, statusCode, (error as Error).message);
      return;
    }

    console.error("Extend booking error:", error);
    sendError(res, 500, "Failed to extend booking.");
  }
}

export async function checkOutBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findFirst({
        where: {
          id: req.params.id as string,
          ...getSiteBookingFilter(actor),
        },
      });

      if (!existing) {
        throw Object.assign(new Error("Booking not found."), {
          statusCode: 404,
        });
      }

      if (!IN_HOUSE_STATUSES.includes(existing.status)) {
        throw Object.assign(
          new Error("Only in-house or home-leave bookings can be checked out."),
          { statusCode: 409 }
        );
      }

      const updated = await tx.booking.updateMany({
        where: {
          id: existing.id,
          status: existing.status,
        },
        data: {
          status: BookingStatus.CHECKED_OUT,
          checkedOutAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        throw Object.assign(
          new Error("The booking was changed by another request."),
          { statusCode: 409 }
        );
      }

      // Close any active home-leave record if the resident checks
      // out while still on leave.
      await tx.homeLeave.updateMany({
        where: {
          bookingId: existing.id,
          status: HomeLeaveStatus.ACTIVE,
        },
        data: {
          status: HomeLeaveStatus.RETURNED,
          returnedAt: new Date(),
        },
      });

      await refreshBedStatus(tx, existing.bedId);

      await createBookingEvent(tx, {
        bookingId: existing.id,
        actorUserId: req.userId!,
        action: "checked_out",
        description: "Resident checked out and returned the key.",
      });

      return tx.booking.findUniqueOrThrow({
        where: { id: existing.id },
        include: { resident: true, bed: true },
      });
    });

    await auditBooking(req, actor, {
      bookingId: booking.id,
      action: "booking_checked_out",
      description: "Resident checked out.",
    });

    await notifyActor(req, {
      title:"Resident checked out",
      message:`Resident ${booking.resident.fullName} with booking id ${booking.id} checked out`
    })

    res.status(200).json({
      message: "Resident checked out successfully.",
      data: booking,
    });
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 0;

    if (statusCode) {
      sendError(res, statusCode, (error as Error).message);
      return;
    }

    console.error("Checkout error:", error);
    sendError(res, 500, "Failed to check out resident.");
  }
}

export async function archiveBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: {
          id: req.params.id as string,
          ...getSiteBookingFilter(actor),
        },
      });

      if (!booking) {
        throw Object.assign(new Error("Booking not found."), {
          statusCode: 404,
        });
      }

      if (booking.status !== BookingStatus.CHECKED_OUT) {
        throw Object.assign(
          new Error("Only checked-out bookings can be archived."),
          { statusCode: 409 }
        );
      }

      const updated = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: BookingStatus.CHECKED_OUT,
        },
        data: {
          status: BookingStatus.ARCHIVED,
          archivedAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        throw Object.assign(
          new Error("The booking was changed by another request."),
          { statusCode: 409 }
        );
      }

      await createBookingEvent(tx, {
        bookingId: booking.id,
        actorUserId: req.userId!,
        action: "booking_archived",
        description: "Checked-out booking archived.",
      });

      return tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
      });
    });

    await auditBooking(req, actor, {
      bookingId: result.id,
      action: "booking_archived",
      description: "Booking archived.",
    });

    await notifyActor(req, {
      title:"Booking Archived",
      message: `Booking ${result.id} successfully archived`,
      type: "SUCCESS"
    })

    res.status(200).json({
      message: "Booking archived successfully.",
      data: result,
    });
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 0;

    if (statusCode) {
      sendError(res, statusCode, (error as Error).message);
      return;
    }

    console.error("Archive booking error:", error);
    sendError(res, 500, "Failed to archive booking.");
  }
}
