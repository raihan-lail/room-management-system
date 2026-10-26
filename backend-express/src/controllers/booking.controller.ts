import type { Response } from "express";
import {
  BookingStatus,
  Prisma,
} from "../generated/prisma/client.js";

import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

import { getActorOrRespond } from "../utils/actor.js";
import {
  DEFAULT_PAGE_SIZE,
  IN_HOUSE_STATUSES,
  MAX_PAGE_SIZE,
  getSiteBookingFilter,
  getSiteDateRange,
  parseDate,
  parsePositiveInteger,
  sendError,
  type BookingTab,
} from "../helpers/booking.helper.js";

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
          where.status = BookingStatus.CONFIRMED;
          where.startedAt = { gte: start, lt: end };
          break;

        case "in-house":
          where.status = { in: IN_HOUSE_STATUSES };
          break;

        case "home-leave":
          where.status = BookingStatus.HOME_LEAVE;
          break;

        case "near-end": {
          const twoDaysLater = new Date(start);
          twoDaysLater.setUTCDate(twoDaysLater.getUTCDate() + 3);

          where.status = { in: IN_HOUSE_STATUSES };
          where.endedAt = {
            gte: start,
            lt: twoDaysLater,
          };
          break;
        }

        case "departure":
          where.status = { in: IN_HOUSE_STATUSES };
          where.endedAt = { gte: start, lt: end };
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

