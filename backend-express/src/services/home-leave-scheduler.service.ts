import { BookingStatus, HomeLeaveStatus } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { createBookingEvent, refreshBedStatus } from "../helpers/booking.helper.js";

const SCHEDULER_INTERVAL_MS = 60_000;
let isProcessingDueLeaves = false;

export function startHomeLeaveScheduler(): void {
  const processDueLeaves = () => {
    void activateDueHomeLeaves();
  };

  processDueLeaves();
  const interval = setInterval(processDueLeaves, SCHEDULER_INTERVAL_MS);
  interval.unref?.();
}

async function activateDueHomeLeaves(): Promise<void> {
  if (isProcessingDueLeaves) return;
  isProcessingDueLeaves = true;

  try {
    const dueLeaves = await prisma.homeLeave.findMany({
      where: {
        status: HomeLeaveStatus.SCHEDULED,
        startedAt: { lte: new Date() },
      },
      select: {
        id: true,
        bookingId: true,
        startedAt: true,
        booking: { select: { bedId: true } },
      },
    });

    for (const leave of dueLeaves) {
      try {
        await prisma.$transaction(async (tx) => {
          const scheduled = await tx.homeLeave.updateMany({
            where: {
              id: leave.id,
              status: HomeLeaveStatus.SCHEDULED,
              startedAt: { lte: new Date() },
            },
            data: { status: HomeLeaveStatus.ACTIVE },
          });

          if (scheduled.count !== 1) return;

          const booking = await tx.booking.findUnique({
            where: { id: leave.bookingId },
            select: { status: true },
          });

          if (booking?.status !== BookingStatus.IN_HOUSE) {
            await tx.homeLeave.update({
              where: { id: leave.id },
              data: { status: HomeLeaveStatus.CANCELLED },
            });
            await createBookingEvent(tx, {
              bookingId: leave.bookingId,
              actorUserId: null,
              action: "home_leave_schedule_cancelled",
              description: "Scheduled home leave was cancelled because the booking is no longer in house.",
              metadata: { homeLeaveId: leave.id },
            });
            return;
          }

          const updated = await tx.booking.updateMany({
            where: {
              id: leave.bookingId,
              status: BookingStatus.IN_HOUSE,
            },
            data: { status: BookingStatus.HOME_LEAVE },
          });

          if (updated.count !== 1) {
            await tx.homeLeave.update({
              where: { id: leave.id },
              data: { status: HomeLeaveStatus.CANCELLED },
            });
            return;
          }

          await refreshBedStatus(tx, leave.booking.bedId);
          await createBookingEvent(tx, {
            bookingId: leave.bookingId,
            actorUserId: null,
            action: "home_leave_started",
            description: "Scheduled home leave started.",
            metadata: {
              homeLeaveId: leave.id,
              startedAt: leave.startedAt.toISOString(),
            },
          });
          await tx.auditLog.create({
            data: {
              actorName: "System",
              action: "Update",
              resource: "booking",
              resourceId: leave.bookingId,
              description: "Scheduled home leave started automatically.",
              before: { status: BookingStatus.IN_HOUSE },
              after: { status: BookingStatus.HOME_LEAVE },
            },
          });
        });
      } catch (error) {
        console.error(`Failed to activate scheduled home leave ${leave.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Home leave scheduler error:", error);
  } finally {
    isProcessingDueLeaves = false;
  }
}
