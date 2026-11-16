import { BookingStatus, HomeLeaveStatus } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { createBookingEvent, refreshBedStatus } from "../helpers/booking.helper.js";

const PROCESS_INTERVAL_MS = 60_000;

export async function processScheduledHomeLeaves(now = new Date()): Promise<void> {
  const dueLeaves = await prisma.homeLeave.findMany({
    where: {
      status: HomeLeaveStatus.ACTIVE,
      startedAt: { lte: now },
      booking: { status: BookingStatus.IN_HOUSE },
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
        const updated = await tx.booking.updateMany({
          where: { id: leave.bookingId, status: BookingStatus.IN_HOUSE },
          data: { status: BookingStatus.HOME_LEAVE },
        });
        if (updated.count !== 1) return;

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
      });
    } catch (error) {
      console.error(`Failed to process scheduled home leave ${leave.id}:`, error);
    }
  }
}

export function startScheduledHomeLeaveProcessor(): void {
  const process = () => {
    void processScheduledHomeLeaves().catch((error) => {
      console.error("Scheduled home leave processing error:", error);
    });
  };

  process();
  const timer = setInterval(process, PROCESS_INTERVAL_MS);
  timer.unref();
}
