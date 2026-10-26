import type { Response } from "express";
import {
  BookingStatus,
  BedStatus,
  Prisma,
} from "../generated/prisma/client.js";

import type { AuthRequest } from "../middleware/auth.middleware.js";
import {
  isGlobalSuperadmin,
  NO_MATCHING_ID,
  type Actor,
} from "../utils/actor.js";
import { auditActor } from "../services/audit.service.js";

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.IN_HOUSE,
  BookingStatus.HOME_LEAVE,
];

export const IN_HOUSE_STATUSES: BookingStatus[] = [
  BookingStatus.IN_HOUSE,
  BookingStatus.HOME_LEAVE,
];

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type BookingTab =
  | "arrival"
  | "in-house"
  | "near-end"
  | "departure"
  | "home-leave";

export function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function parsePositiveInteger(
  value: unknown,
  fallback: number,
  max?: number
): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return max ? Math.min(parsed, max) : parsed;
}

export function getSiteBookingFilter(
  actor: Actor
): Prisma.BookingWhereInput {
  if (isGlobalSuperadmin(actor)) {
    return {};
  }

  return {
    bed: {
      room: {
        floor: {
          location: {
            siteId: actor.siteId ?? NO_MATCHING_ID,
          },
        },
      },
    },
  };
}

export function getSiteResidentFilter(
  actor: Actor
): Prisma.ResidentWhereInput {
  if (isGlobalSuperadmin(actor)) {
    return {};
  }

  return {
    siteId: actor.siteId ?? NO_MATCHING_ID,
  };
}

export function getSiteBedFilter(
  actor: Actor
): Prisma.BedWhereInput {
  if (isGlobalSuperadmin(actor)) {
    return {};
  }

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

export function getSiteDateRange(
  dateString: string
): { start: Date; end: Date } | null {

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return null;
  }

  const start = new Date(`${dateString}T00:00:00.000Z`);

  if (
    Number.isNaN(start.getTime()) ||
    start.toISOString().slice(0, 10) !== dateString
  ) {
    return null;
  }

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

export function overlaps(
  existingStart: Date,
  existingEnd: Date,
  requestedStart: Date,
  requestedEnd: Date
): boolean {
  return (
    existingStart < requestedEnd &&
    requestedStart < existingEnd
  );
}

export function sendError(
  res: Response,
  status: number,
  message: string
): void {
  res.status(status).json({ message });
}

export async function refreshBedStatus(
  tx: Prisma.TransactionClient,
  bedId: string
): Promise<void> {
  const currentStay = await tx.booking.findFirst({
    where: {
      bedId,
      status: {
        in: IN_HOUSE_STATUSES,
      },
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  if (currentStay?.status === BookingStatus.HOME_LEAVE) {
    await tx.bed.update({
      where: { id: bedId },
      data: { status: BedStatus.HOME_LEAVE },
    });
    return;
  }

  if (currentStay?.status === BookingStatus.IN_HOUSE) {
    await tx.bed.update({
      where: { id: bedId },
      data: { status: BedStatus.OCCUPIED },
    });
    return;
  }

  const futureBooking = await tx.booking.findFirst({
    where: {
      bedId,
      status: BookingStatus.CONFIRMED,
    },
    orderBy: {
      startedAt: "asc",
    },
  });

  await tx.bed.update({
    where: { id: bedId },
    data: {
      status: futureBooking
        ? BedStatus.BOOKED
        : BedStatus.VACANT,
    },
  });
}

export async function createBookingEvent(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    actorUserId: string;
    action: string;
    description?: string;
    metadata?: Prisma.InputJsonValue;
  }
): Promise<void> {
  await tx.bookingEvent.create({
    data: {
      bookingId: input.bookingId,
      actorUserId: input.actorUserId,
      action: input.action,
      description: input.description,
      metadata: input.metadata,
    },
  });
}

export async function validateBookingDates(
  tx: Prisma.TransactionClient,
  input: {
    bedId: string;
    startedAt: Date;
    endedAt: Date;
    excludeBookingId?: string;
  }
): Promise<string | null> {
  if (input.startedAt >= input.endedAt) {
    return "The end date must be after the start date.";
  }

  const conflict = await tx.booking.findFirst({
    where: {
      bedId: input.bedId,
      status: {
        in: ACTIVE_BOOKING_STATUSES,
      },
      startedAt: {
        lt: input.endedAt,
      },
      endedAt: {
        gt: input.startedAt,
      },
      ...(input.excludeBookingId
        ? { id: { not: input.excludeBookingId } }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (conflict) {
    return "This bed is already booked for some or all of the requested dates.";
  }

  return null;
}

export async function auditBooking(
  req: AuthRequest,
  actor: Actor,
  input: {
    bookingId: string;
    action: string;
    description: string;
  }
): Promise<void> {
  await auditActor(
    req,
    {
      userId: req.userId!,
      name:
        (actor as unknown as { name?: string }).name ?? null,
    },
    {
      action: input.action,
      resource: "booking",
      resourceId: input.bookingId,
      description: input.description,
    }
  );
}
