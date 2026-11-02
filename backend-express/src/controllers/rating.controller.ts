import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
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
