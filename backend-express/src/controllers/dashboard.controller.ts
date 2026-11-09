import type { Response } from "express";
import { BookingStatus, HomeLeaveStatus, Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { getSiteBookingFilter } from "../helpers/booking.helper.js";
import { roomSiteFilter } from "../helpers/room.helper.js";
import { getActorOrRespond } from "../utils/actor.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_MONTHS = 12;
const BED_STATUS_ORDER = ["Booked", "Occupied", "Home Leave", "Vacant", "Allocated"];
const BOOKING_STATUS_ORDER = [BookingStatus.CONFIRMED, BookingStatus.IN_HOUSE, BookingStatus.HOME_LEAVE, BookingStatus.CHECKED_OUT, BookingStatus.ARCHIVED];

function parseDateParam(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

function dayEnd(date: Date) {
  return new Date(date.getTime() + DAY_MS - 1);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en", { month: "short", year: "numeric", timeZone: "UTC" });
}

export async function getDashboardData(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const defaultStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (TREND_MONTHS - 1), 1));
    const requestedStart = parseDateParam(req.query.startDate);
    const requestedEnd = parseDateParam(req.query.endDate);
    const requestedStatusDate = parseDateParam(req.query.statusDate);

    if (requestedStart === null || requestedEnd === null || requestedStatusDate === null) {
      return res.status(400).json({ message: "Dates must use YYYY-MM-DD format." });
    }

    const startDate = requestedStart ?? defaultStart;
    const endDate = requestedEnd ?? today;
    const statusDate = requestedStatusDate ?? today;
    if (startDate > endDate) {
      return res.status(400).json({ message: "startDate cannot be later than endDate." });
    }

    const selectedDayEnd = dayEnd(statusDate);
    const trendStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    const trendEnd = dayEnd(endDate > today ? today : endDate);
    const trendMonthCount = Math.max(1, (endDate.getUTCFullYear() - trendStart.getUTCFullYear()) * 12 + endDate.getUTCMonth() - trendStart.getUTCMonth() + 1);
    const bookingSiteFilter = getSiteBookingFilter(actor);
    const roomFilter: Prisma.RoomWhereInput = roomSiteFilter(actor);
    const bedFilter: Prisma.BedWhereInput = {
      isActive: true,
      room: roomSiteFilter(actor),
    };

    const [totalRooms, totalBeds, occupiedBeds, totalCheckIns, totalCheckOuts, trendBookings, snapshotRooms, bookingStatusCounts] = await Promise.all([
      prisma.room.count({ where: roomFilter }),
      prisma.bed.count({ where: bedFilter }),
      prisma.bed.count({
        where: {
          ...bedFilter,
          status: { in: ["OCCUPIED", "HOME_LEAVE"] },
        },
      }),
      prisma.booking.count({
        where: {
          ...bookingSiteFilter,
          checkedInAt: { gte: today, lt: new Date(today.getTime() + DAY_MS) },
        },
      }),
      prisma.booking.count({
        where: {
          ...bookingSiteFilter,
          checkedOutAt: { gte: today, lt: new Date(today.getTime() + DAY_MS) },
        },
      }),
      prisma.booking.findMany({
        where: {
          ...bookingSiteFilter,
          checkedInAt: { not: null, lte: trendEnd },
          OR: [{ checkedOutAt: null }, { checkedOutAt: { gt: trendStart } }],
          status: { not: BookingStatus.CANCELLED },
        },
        select: {
          bedId: true,
          checkedInAt: true,
          checkedOutAt: true,
          status: true,
          bed: { select: { roomId: true } },
          homeLeaves: {
            where: { status: { in: [HomeLeaveStatus.ACTIVE, HomeLeaveStatus.RETURNED] } },
            select: { startedAt: true, returnedAt: true },
          },
        },
      }),
      prisma.room.findMany({
        where: roomFilter,
        select: {
          id: true,
          allocation: { select: { id: true } },
          beds: {
            where: { isActive: true },
            select: {
              bookings: {
                where: {
                  status: { not: BookingStatus.CANCELLED },
                  startedAt: { lte: selectedDayEnd },
                  OR: [
                    { endedAt: { gte: statusDate } },
                    { checkedOutAt: { gte: statusDate } },
                    { status: { in: [BookingStatus.IN_HOUSE, BookingStatus.HOME_LEAVE] } },
                  ],
                },
                select: {
                  status: true,
                  startedAt: true,
                  endedAt: true,
                  checkedInAt: true,
                  checkedOutAt: true,
                  homeLeaves: {
                    where: {
                      status: { in: [HomeLeaveStatus.ACTIVE, HomeLeaveStatus.RETURNED] },
                      startedAt: { lte: selectedDayEnd },
                      OR: [{ returnedAt: null }, { returnedAt: { gte: statusDate } }],
                    },
                    select: { startedAt: true, returnedAt: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.booking.groupBy({
        by: ["status"],
        where: {
          ...bookingSiteFilter,
          status: { not: BookingStatus.CANCELLED },
        },
        _count: { _all: true },
      }),
    ]);

    const trend = Array.from({ length: trendMonthCount }, (_, index) => {
      const month = new Date(Date.UTC(trendStart.getUTCFullYear(), trendStart.getUTCMonth() + index, 1));
      const monthEnd = dayEnd(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)));
      const asOf = monthEnd > trendEnd ? trendEnd : monthEnd;
      const active = trendBookings.filter((booking) =>
        booking.checkedInAt && booking.checkedInAt <= asOf &&
        (!booking.checkedOutAt || booking.checkedOutAt > asOf),
      );
      const occupiedBedIds = new Set(active.map((booking) => booking.bedId));
      return { month: monthLabel(month), occupancyRate: totalBeds ? Number(((occupiedBedIds.size / totalBeds) * 100).toFixed(1)) : 0 };
    });

    const bedStatuses: Record<string, number> = Object.fromEntries(BED_STATUS_ORDER.map((status) => [status, 0]));
    for (const room of snapshotRooms) {
      for (const bed of room.beds) {
        const roomBookings = bed.bookings;
        const isHomeLeave = roomBookings.some((booking) =>
        (booking.status === BookingStatus.HOME_LEAVE && booking.homeLeaves.length === 0 &&
          booking.checkedInAt && booking.checkedInAt <= selectedDayEnd &&
          (!booking.checkedOutAt || booking.checkedOutAt >= statusDate)) || booking.homeLeaves.some((leave) =>
          leave.startedAt <= selectedDayEnd && (!leave.returnedAt || leave.returnedAt >= statusDate),
        ),
      );
        const isOccupied = roomBookings.some((booking) =>
        booking.checkedInAt && booking.checkedInAt <= selectedDayEnd &&
        (!booking.checkedOutAt || booking.checkedOutAt >= statusDate),
      );
        const isBooked = roomBookings.some((booking) =>
        booking.startedAt <= selectedDayEnd && booking.endedAt >= statusDate &&
        (!booking.checkedInAt || booking.checkedInAt > selectedDayEnd) &&
        (!booking.checkedOutAt || booking.checkedOutAt >= statusDate),
      );
        const status = isOccupied ? (isHomeLeave ? "Home Leave" : "Occupied")
          : isBooked ? "Booked"
            : room.allocation ? "Allocated" : "Vacant";
        bedStatuses[status] += 1;
      }
    }

    return res.status(200).json({
      filters: {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        statusDate: statusDate.toISOString().slice(0, 10),
      },
      summary: {
        totalRooms,
        totalBeds,
        availableBeds: bedStatuses.Vacant,
        totalCheckIns,
        totalCheckOuts,
        occupiedBeds,
        occupancyRate: totalBeds ? Number(((occupiedBeds / totalBeds) * 100).toFixed(1)) : 0,
      },
      trend,
      bedStatuses: BED_STATUS_ORDER.map((status) => ({ status, count: bedStatuses[status] })),
      bookingStatuses: BOOKING_STATUS_ORDER.map((status) => ({ status, count: bookingStatusCounts.find((entry) => entry.status === status)?._count._all ?? 0 })),
    });
  } catch (error) {
    console.error("getDashboardData:", error);
    return res.status(500).json({ message: "Failed to load dashboard data." });
  }
}
