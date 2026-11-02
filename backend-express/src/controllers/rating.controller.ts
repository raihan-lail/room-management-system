import type { Response } from "express";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { auditActor } from "../services/audit.service.js";
import { notifyActor } from "../services/notification.service.js";
import {
  getActorOrRespond,
  isGlobalSuperadmin,
  NO_MATCHING_ID,
} from "../utils/actor.js";

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
      "Submitted At": rating.createdAt.toISOString(),
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
