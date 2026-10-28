import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { BookingStatus } from "../generated/prisma/client.js";


export async function getMyProfile(
  req: AuthRequest,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  try {
    const resident = await prisma.resident.findUnique({
      where: { userId: req.userId },
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
        status: true,
        createdAt: true,
        site: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        user: {
          select: {
            email: true,
            isActive: true,
          },
        },
      },
    });

    if (!resident) {
      res.status(403).json({
        message: "Resident account required.",
      });
      return;
    }

    if (!resident.user.isActive) {
      res.status(403).json({
        message: "Your account is inactive.",
      });
      return;
    }

    res.status(200).json({ data: resident });
  } catch (error) {
    console.error("Get resident profile error:", error);
    res.status(500).json({
      message: "Failed to retrieve resident profile.",
    });
  }
}

export async function getMyBookings(
  req: AuthRequest,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  try {
    const resident = await prisma.resident.findUnique({
      where: { userId: req.userId },
      select: { id: true, user: { select: { isActive: true } } },
    });

    if (!resident || !resident.user.isActive) {
      res.status(403).json({
        message: "Active resident account required.",
      });
      return;
    }

    const page = Math.max(
      1,
      Number.parseInt(String(req.query.page ?? "1"), 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(String(req.query.limit ?? "10"), 10) || 10
      )
    );

    const status = req.query.status;

    if (
      status !== undefined &&
      (typeof status !== "string" ||
        !Object.values(BookingStatus).includes(status as BookingStatus))
    ) {
      res.status(400).json({ message: "Invalid booking status." });
      return;
    }

    const where = {
      residentId: resident.id,
      ...(typeof status === "string"
        ? { status: status as BookingStatus }
        : {}),
    };

    const [total, bookings] = await prisma.$transaction([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          bookingNumber: true,
          startedAt: true,
          endedAt: true,
          status: true,
          checkedInAt: true,
          checkedOutAt: true,
          notes: true,
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
                              name: true,
                              code: true,
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
          homeLeaves: {
            orderBy: { startedAt: "desc" },
            select: {
              id: true,
              startedAt: true,
              expectedReturnAt: true,
              returnedAt: true,
              status: true,
              reason: true,
            },
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
    console.error("Get resident bookings error:", error);
    res.status(500).json({
      message: "Failed to retrieve resident bookings.",
    });
  }
}

export async function getMyBookingById(
  req: AuthRequest,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  try {
    const booking = await prisma.booking.findFirst({
      where: {
        id: req.params.id as string,
        resident: {
          userId: req.userId,
          user: { isActive: true },
        },
      },
      include: {
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
      },
    });

    if (!booking) {
      res.status(404).json({
        message: "Booking not found.",
      });
      return;
    }

    res.status(200).json({ data: booking });
  } catch (error) {
    console.error("Get resident booking error:", error);
    res.status(500).json({
      message: "Failed to retrieve booking.",
    });
  }
}

export async function getMyCurrentBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  try {
    const booking = await prisma.booking.findFirst({
      where: {
        resident: {
          userId: req.userId,
          user: { isActive: true },
        },
        status: {
          in: [
            BookingStatus.IN_HOUSE,
            BookingStatus.HOME_LEAVE,
          ],
        },
      },
      orderBy: { startedAt: "desc" },
      include: {
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
      },
    });

    res.status(200).json({ data: booking });
  } catch (error) {
    console.error("Get current booking error:", error);
    res.status(500).json({
      message: "Failed to retrieve current booking.",
    });
  }
}

export async function getMyHomeLeaves(
  req: AuthRequest,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  try {
    const resident = await prisma.resident.findUnique({
      where: { userId: req.userId },
      select: {
        id: true,
        user: { select: { isActive: true } },
      },
    });

    if (!resident || !resident.user.isActive) {
      res.status(403).json({
        message: "Active resident account required.",
      });
      return;
    }

    const homeLeaves = await prisma.homeLeave.findMany({
      where: {
        booking: {
          residentId: resident.id,
        },
      },
      orderBy: { startedAt: "desc" },
      include: {
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            status: true,
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
    });

    res.status(200).json({ data: homeLeaves });
  } catch (error) {
    console.error("Get resident home leaves error:", error);
    res.status(500).json({
      message: "Failed to retrieve home leave history.",
    });
  }
}