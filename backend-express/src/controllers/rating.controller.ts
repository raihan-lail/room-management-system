import type { Request, Response } from "express";
import * as XLSX from "xlsx";
import { FeedbackTokenType } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { auditActor } from "../services/audit.service.js";
import { notifyActor, notifyUsers } from "../services/notification.service.js";
import { hashFeedbackToken } from "../services/feedback-token.service.js";
import {
  getActorOrRespond,
  isGlobalSuperadmin,
  NO_MATCHING_ID,
} from "../utils/actor.js";
import { formatTimestamp } from "../helpers/date.helper.js";

const RATING_BOOKING_STATUSES = ["CHECKED_OUT", "ARCHIVED"];
const MAX_RATING_REVIEW_LENGTH = 2000;

export async function listRatings(
  req: AuthRequest,
  res: Response
) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 10)
    );

    const skip = (page - 1) * limit;

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const score =
      req.query.score !== undefined
        ? Number(req.query.score)
        : undefined;

    const dateFrom =
      typeof req.query.dateFrom === "string"
        ? new Date(req.query.dateFrom)
        : undefined;

    const dateTo =
      typeof req.query.dateTo === "string"
        ? new Date(req.query.dateTo)
        : undefined;
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.dateTo))) {
      dateTo.setUTCHours(23, 59, 59, 999);
    }

    const sort =
      req.query.sort === "oldest" ? "asc" : "desc";

    // Validate score
    if (
      score !== undefined &&
      (!Number.isInteger(score) || score < 1 || score > 5)
    ) {
      return res.status(400).json({
        message: "Score must be between 1 and 5.",
      });
    }

    // Validate dates
    if (
      (dateFrom && Number.isNaN(dateFrom.getTime())) ||
      (dateTo && Number.isNaN(dateTo.getTime()))
    ) {
      return res.status(400).json({
        message: "Invalid date filter.",
      });
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
      return res.status(400).json({
        message: "dateFrom cannot be later than dateTo.",
      });
    }

    // Site-level access
    const siteFilter = isGlobalSuperadmin(actor)
      ? {}
      : {
          booking: {
            bed: {
              room: {
                floor: {
                  location: {
                    siteId: actor.siteId ?? NO_MATCHING_ID,
                  },
                },
              },
            },
          },
        };

    const where = {
      ...siteFilter,

      ...(score !== undefined && { score }),

      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && {
                gte: dateFrom,
              }),
              ...(dateTo && {
                lte: dateTo,
              }),
            },
          }
        : {}),

      ...(search && {
        OR: [
          {
            booking: {
              bookingNumber: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          },
          {
            booking: {
              resident: {
                fullName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            },
          },
        ],
      }),
    };

    const [ratings, total] = await Promise.all([
      prisma.bookingRating.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              startedAt: true,
              endedAt: true,
              status: true,

              resident: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                  user: {
                    select: {
                      email: true,
                    },
                  },
                },
              },

              bed: {
                select: {
                  id: true,
                  name: true,
                  room: {
                    select: {
                      id: true,
                      name: true,
                      floor: {
                        select: {
                          name: true,
                          location: {
                            select: {
                              name: true,
                              site: {
                                select: {
                                  id: true,
                                  name: true,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },

        orderBy: {
          createdAt: sort,
        },

        skip,
        take: limit,
      }),

      prisma.bookingRating.count({ where }),
    ]);

    return res.status(200).json({
      data: ratings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("listRatings:", error);

    return res.status(500).json({
      message: "Failed to retrieve booking ratings.",
    });
  }
}

export async function exportRatingsToExcel(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const score = req.query.score !== undefined ? Number(req.query.score) : undefined;
    const dateFrom = typeof req.query.dateFrom === "string" ? new Date(req.query.dateFrom) : undefined;
    const dateTo = typeof req.query.dateTo === "string" ? new Date(req.query.dateTo) : undefined;
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.dateTo))) {
      dateTo.setUTCHours(23, 59, 59, 999);
    }

    if (score !== undefined && (!Number.isInteger(score) || score < 1 || score > 5)) {
      return res.status(400).json({ message: "Score must be between 1 and 5." });
    }
    if ((dateFrom && Number.isNaN(dateFrom.getTime())) || (dateTo && Number.isNaN(dateTo.getTime()))) {
      return res.status(400).json({ message: "Invalid date filter." });
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return res.status(400).json({ message: "dateFrom cannot be later than dateTo." });
    }

    const siteFilter = isGlobalSuperadmin(actor)
      ? {}
      : {
          booking: {
            bed: {
              room: {
                floor: {
                  location: {
                    siteId: actor.siteId ?? NO_MATCHING_ID,
                  },
                },
              },
            },
          },
        };
    const where = {
      ...siteFilter,
      ...(score !== undefined ? { score } : {}),
      ...(dateFrom || dateTo
        ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
      ...(search
        ? {
            OR: [
              { booking: { bookingNumber: { contains: search, mode: "insensitive" as const } } },
              { booking: { resident: { fullName: { contains: search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    };

    const ratings = await prisma.bookingRating.findMany({
      where,
      include: {
        booking: {
          select: {
            bookingNumber: true,
            resident: { select: { fullName: true } },
            bed: {
              select: {
                name: true,
                room: {
                  select: {
                    name: true,
                    floor: {
                      select: {
                        name: true,
                        location: { select: { name: true, site: { select: { name: true } } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: req.query.sort === "oldest" ? "asc" : "desc" },
    });

    if (ratings.length === 0) {
      return res.status(400).json({ message: "No ratings match the selected filters. Nothing to export." });
    }

    const rows = ratings.map((rating) => ({
      "Rating ID": rating.id,
      "Booking ID": rating.booking.bookingNumber,
      Site: rating.booking.bed.room.floor.location.site.name,
      Location: rating.booking.bed.room.floor.location.name,
      Floor: rating.booking.bed.room.floor.name,
      Room: rating.booking.bed.room.name,
      Bed: rating.booking.bed.name,
      Resident: rating.booking.resident.fullName,
      Score: rating.score,
      Details: rating.details ?? "",
      "Submitted At": formatTimestamp(rating.createdAt),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 28 }, { wch: 20 }, { wch: 24 }, { wch: 24 }, { wch: 18 },
      { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 48 }, { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ratings");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const filename = `ratings-${new Date().toISOString().slice(0, 10)}.xlsx`;

    await notifyActor(req, {
      title: "Rating data export successfully",
      message: `${ratings.length} ratings exported successfully`,
      type: "SUCCESS",
    });
    await auditActor(req, actor, {
      action: "Export",
      resource: "rating",
      description: `Exported ${ratings.length} ratings to an Excel file.`,
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("exportRatingsToExcel:", error);
    if (res.headersSent) return;
    return res.status(500).json({ message: "Failed to export ratings." });
  }
}

async function findBookingByRatingToken(bookingId: string, token: string) {
  if (!bookingId || !token) return null;

  const feedbackToken = await prisma.feedbackToken.findFirst({
    where: {
      bookingId,
      type: FeedbackTokenType.RATING,
      tokenHash: hashFeedbackToken(token),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      id: true,
      usedAt: true,
      booking: {
        select: {
          id: true,
          bookingNumber: true,
          status: true,
          rating: { select: { id: true } },
          resident: {
            select: {
              userId: true,
              fullName: true,
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

  return feedbackToken;
}

export async function getRatingFeedback(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const feedbackToken = await findBookingByRatingToken(
      String(req.params.bookingId ?? ""),
      String(req.params.token ?? "")
    );

    if (!feedbackToken) {
      res.status(404).json({
        message: "This rating link is invalid or has expired.",
      });
      return;
    }

    const booking = feedbackToken.booking;

    res.status(200).json({
      data: {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        roomName: booking.bed.room.name,
        bedName: booking.bed.name,
        status: booking.status,
        canRate: RATING_BOOKING_STATUSES.includes(booking.status),
        alreadyRated: feedbackToken.usedAt !== null || booking.rating !== null,
      },
    });
  } catch (error) {
    console.error("getRatingFeedback:", error);
    res.status(500).json({
      message: "Failed to load rating details.",
    });
  }
}

export async function submitRatingFeedback(
  req: Request,
  res: Response
): Promise<void> {
  const { score, details } = req.body ?? {};

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    res.status(400).json({
      message: "Score must be an integer between 1 and 5.",
    });
    return;
  }

  if (details !== undefined && details !== null && typeof details !== "string") {
    res.status(400).json({
      message: "Review details must be a string.",
    });
    return;
  }

  const review = typeof details === "string" ? details.trim() : null;

  if (review && review.length > MAX_RATING_REVIEW_LENGTH) {
    res.status(400).json({
      message: `Review details cannot exceed ${MAX_RATING_REVIEW_LENGTH} characters.`,
    });
    return;
  }

  try {
    const feedbackToken = await findBookingByRatingToken(
      String(req.params.bookingId ?? ""),
      String(req.params.token ?? "")
    );

    if (!feedbackToken) {
      res.status(404).json({
        message: "This rating link is invalid or has expired.",
      });
      return;
    }

    if (feedbackToken.usedAt !== null || feedbackToken.booking.rating !== null) {
      res.status(409).json({
        message: "This rating link has already been used.",
      });
      return;
    }

    if (!RATING_BOOKING_STATUSES.includes(feedbackToken.booking.status)) {
      res.status(400).json({
        message: "You can only rate a booking after checking out.",
      });
      return;
    }

    const rating = await prisma.$transaction(async (tx) => {
      const claimed = await tx.feedbackToken.updateMany({
        where: { id: feedbackToken.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw Object.assign(
          new Error("This rating link has already been used."),
          { statusCode: 409 }
        );
      }

      return tx.bookingRating.create({
        data: {
          bookingId: feedbackToken.booking.id,
          score,
          details: review || null,
        },
      });
    });

    await auditActor(
      req,
      {
        userId: feedbackToken.booking.resident.userId,
        name: feedbackToken.booking.resident.fullName,
      },
      {
        action: "create",
        resource: "rating",
        resourceId: rating.id,
        description: `Resident submitted a rating from the check-out feedback link`,
        after: rating,
      }
    );

    await notifyUsers([feedbackToken.booking.resident.userId], {
      title: "Rating received",
      message: "Thank you for rating your stay.",
      type: "SUCCESS",
    });

    res.status(201).json({
      message: "Booking rating submitted successfully.",
      data: rating,
    });
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 0;

    const isDuplicateRating =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002";

    if (statusCode) {
      res.status(statusCode).json({ message: (error as Error).message });
      return;
    }

    if (isDuplicateRating) {
      res.status(409).json({
        message: "This booking has already been rated.",
      });
      return;
    }

    console.error("submitRatingFeedback:", error);
    res.status(500).json({
      message: "Failed to submit booking rating.",
    });
  }
}

