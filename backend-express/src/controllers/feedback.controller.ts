import type { Request, Response } from "express";
import {
  BookingStatus,
  FeedbackTokenType,
} from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { auditActor } from "../services/audit.service.js";
import { hashFeedbackToken } from "../services/feedback-token.service.js";
import { notifyComplaintStaff } from "../services/notification.service.js";

const ACTIVE_COMPLAINT_STATUSES: BookingStatus[] = [
  BookingStatus.IN_HOUSE,
  BookingStatus.HOME_LEAVE,
];

function getBookingId(req: Request): string {
  return String(req.params.bookingId ?? "");
}

function getToken(req: Request): string {
  return String(req.params.token ?? "");
}

async function findBookingByComplaintToken(bookingId: string, token: string) {
  if (!bookingId || !token) return null;

  const feedbackToken = await prisma.feedbackToken.findFirst({
    where: {
      bookingId,
      type: FeedbackTokenType.COMPLAINT,
      tokenHash: hashFeedbackToken(token),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      id: true,
      booking: {
        select: {
          id: true,
          bookingNumber: true,
          status: true,
          resident: {
            select: {
              fullName: true,
              siteId: true,
            },
          },
          bed: {
            select: {
              name: true,
              room: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return feedbackToken?.booking ?? null;
}

export async function getComplaintFeedback(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const booking = await findBookingByComplaintToken(
      getBookingId(req),
      getToken(req)
    );

    if (!booking) {
      res.status(404).json({
        message: "This complaint link is invalid or has expired.",
      });
      return;
    }

    res.status(200).json({
      data: {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        roomName: booking.bed.room.name,
        bedName: booking.bed.name,
        status: booking.status,
        acceptsComplaints: ACTIVE_COMPLAINT_STATUSES.includes(booking.status),
      },
    });
  } catch (error) {
    console.error("Get complaint feedback error:", error);
    res.status(500).json({
      message: "Failed to load complaint details.",
    });
  }
}

export async function submitComplaintFeedback(
  req: Request,
  res: Response
): Promise<void> {
  const { title, category, description } = req.body ?? {};

  if (
    typeof category !== "string" ||
    !category.trim() ||
    typeof description !== "string" ||
    !description.trim()
  ) {
    res.status(400).json({
      message: "Category and description are required.",
    });
    return;
  }

  if (title !== undefined && (typeof title !== "string" || !title.trim())) {
    res.status(400).json({ message: "Invalid complaint title." });
    return;
  }

  try {
    const booking = await findBookingByComplaintToken(
      getBookingId(req),
      getToken(req)
    );

    if (!booking) {
      res.status(404).json({
        message: "This complaint link is invalid or has expired.",
      });
      return;
    }

    if (!ACTIVE_COMPLAINT_STATUSES.includes(booking.status)) {
      res.status(400).json({
        message: "Complaints can only be submitted for a current stay.",
      });
      return;
    }

    const complaint = await prisma.complaint.create({
      data: {
        bookingId: booking.id,
        title:
          typeof title === "string" && title.trim()
            ? title.trim()
            : `${category.trim()} complaint`,
        category: category.trim(),
        description: description.trim(),
        status: "OPEN",
        priority: "MEDIUM",
      },
    });

    await auditActor(
      req,
      { name: booking.resident.fullName },
      {
        action: "create",
        resource: "complaint",
        resourceId: complaint.id,
        description: `Resident submitted complaint ${complaint.id} from the check-in feedback link`,
        after: complaint,
      }
    );

    await notifyComplaintStaff(booking.resident.siteId, {
      title: "New resident complaint",
      message: `${booking.resident.fullName} submitted a new complaint.`,
      type: "INFO",
      link: `/bookings/complains/${complaint.id}`,
    });

    res.status(201).json({
      message: "Complaint submitted successfully.",
      data: complaint,
    });
  } catch (error) {
    console.error("Submit complaint feedback error:", error);
    res.status(500).json({
      message: "Failed to submit complaint.",
    });
  }
}
