import type { Response } from "express";

import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

import type { LocationInput, FloorInput } from "../types/location.type.js";
import {
  canManageSite,
  getActorOrRespond,
  getSiteScopedFilter as locationScope,
  handlePrismaError,
  isGlobalSuperadmin,
} from "../utils/actor.js";

const LOCATION_ERROR_MESSAGES = {
  duplicate:
    "A location or floor with the same unique name or number already exists",
  notFound: "Record not found",
};

function validFloorInput(floor: FloorInput): boolean {
  return (
    typeof floor.name === "string" &&
    floor.name.trim().length > 0 &&
    Number.isInteger(floor.floorNumber) &&
    (floor.description === undefined ||
      floor.description === null ||
      typeof floor.description === "string") &&
    (floor.isActive === undefined ||
      typeof floor.isActive === "boolean")
  );
}

export async function listLocations(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const locations = await prisma.location.findMany({
  where: locationScope(actor),
  include: {
    site: {
      select: {
        id: true,
        name: true,
      },
    },
    floors: {
      orderBy: { floorNumber: "asc" },
    },
    _count: {
      select: { floors: true },
    },
  },
  orderBy: { name: "asc" },
});

    res.json({ data: locations });
  } catch (error) {
    handlePrismaError(error, res, LOCATION_ERROR_MESSAGES);
  }
}

// GET /api/locations/:id
export async function getLocation(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const location = await prisma.location.findFirst({
      where: {
        id: req.params.id as string,
        ...locationScope(actor),
      },
      include: {
        floors: {
          orderBy: { floorNumber: "asc" },
        },
      },
    });

    if (!location) {
      res.status(404).json({ message: "Location not found" });
      return;
    }

    res.json({ data: location });
  } catch (error) {
    handlePrismaError(error, res, LOCATION_ERROR_MESSAGES);
  }
}

// POST /api/locations
export async function createLocation(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const {
      siteId,
      name,
      description,
      floors = [],
    } = req.body as LocationInput;

    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ message: "Location name is required" });
      return;
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      res.status(400).json({
        message: "Description must be a string or null",
      });
      return;
    }

    if (!Array.isArray(floors) || !floors.every(validFloorInput)) {
      res.status(400).json({
        message: "Floors must contain valid names and integer floor numbers",
      });
      return;
    }

    const floorNumbers = floors.map((floor) => floor.floorNumber);

    if (new Set(floorNumbers).size !== floorNumbers.length) {
      res.status(400).json({
        message: "Floor numbers must be unique within this location",
      });
      return;
    }

    const assignedSiteId = isGlobalSuperadmin(actor)
      ? siteId
      : actor.siteId;

    if (!assignedSiteId) {
      res.status(400).json({
        message: "siteId is required for a global Superadmin",
      });
      return;
    }

    if (!canManageSite(actor, assignedSiteId)) {
      res.status(403).json({
        message: "You cannot create locations for this site",
      });
      return;
    }

    const site = await prisma.site.findUnique({
      where: { id: assignedSiteId },
      select: { id: true },
    });

    if (!site) {
      res.status(400).json({ message: "Invalid siteId" });
      return;
    }

    const location = await prisma.$transaction(async (tx) => {
      return tx.location.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          siteId: assignedSiteId,
          floors: {
            create: floors.map((floor) => ({
              name: floor.name.trim(),
              floorNumber: floor.floorNumber,
              description: floor.description?.trim() || null,
              isActive: floor.isActive ?? true,
            })),
          },
        },
        include: {
          floors: {
            orderBy: { floorNumber: "asc" },
          },
        },
      });
    });

    res.status(201).json({
      message: "Location created successfully",
      data: location,
    });
  } catch (error) {
    handlePrismaError(error, res, LOCATION_ERROR_MESSAGES);
  }
}

// PATCH /api/locations/:id
export async function updateLocation(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const existing = await prisma.location.findFirst({
      where: {
        id: req.params.id as string,
        ...locationScope(actor),
      },
    });

    if (!existing) {
      res.status(404).json({ message: "Location not found" });
      return;
    }

    const { name, description } = req.body as LocationInput;

    if (name !== undefined &&
        (typeof name !== "string" || !name.trim())) {
      res.status(400).json({ message: "Name cannot be empty" });
      return;
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      res.status(400).json({
        message: "Description must be a string or null",
      });
      return;
    }

    if (name === undefined && description === undefined) {
      res.status(400).json({
        message: "Provide name or description to update",
      });
      return;
    }

    const location = await prisma.location.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined
          ? { description: description?.trim() || null }
          : {}),
      },
      include: {
        floors: { orderBy: { floorNumber: "asc" } },
      },
    });

    res.json({
      message: "Location updated successfully",
      data: location,
    });
  } catch (error) {
    handlePrismaError(error, res, LOCATION_ERROR_MESSAGES);
  }
}

// DELETE /api/locations/:id
export async function deleteLocation(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const location = await prisma.location.findFirst({
      where: {
        id: req.params.id as string,
        ...locationScope(actor),
      },
      include: {
        _count: { select: { floors: true } },
      },
    });

    if (!location) {
      res.status(404).json({ message: "Location not found" });
      return;
    }

    if (location._count.floors > 0) {
      res.status(409).json({
        message: "Delete or move its floors before deleting this location",
      });
      return;
    }

    await prisma.location.delete({ where: { id: location.id } });

    res.json({ message: "Location deleted successfully" });
  } catch (error) {
    handlePrismaError(error, res, LOCATION_ERROR_MESSAGES);
  }
}

// POST /api/locations/:id/floors
export async function createFloor(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const location = await prisma.location.findFirst({
      where: {
        id: req.params.id as string,
        ...locationScope(actor),
      },
      select: { id: true },
    });

    if (!location) {
      res.status(404).json({ message: "Location not found" });
      return;
    }

    const floor = req.body as FloorInput;

    if (!validFloorInput(floor)) {
      res.status(400).json({
        message: "Provide a name and integer floorNumber",
      });
      return;
    }

    const created = await prisma.floor.create({
      data: {
        locationId: location.id,
        name: floor.name.trim(),
        floorNumber: floor.floorNumber,
        description: floor.description?.trim() || null,
        isActive: floor.isActive ?? true,
      },
    });

    res.status(201).json({
      message: "Floor created successfully",
      data: created,
    });
  } catch (error) {
    handlePrismaError(error, res, LOCATION_ERROR_MESSAGES);
  }
}

// PATCH /api/locations/:id/floors/:floorId
export async function updateFloor(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const floor = await prisma.floor.findFirst({
      where: {
        id: req.params.floorId as string,
        location: {
          is: {
            id: req.params.id as string,
            ...locationScope(actor),
          },
        },
      },
    });

    if (!floor) {
      res.status(404).json({ message: "Floor not found" });
      return;
    }

    const input = req.body as Partial<FloorInput>;

    if (input.name !== undefined &&
        (typeof input.name !== "string" || !input.name.trim())) {
      res.status(400).json({ message: "Floor name cannot be empty" });
      return;
    }

    if (
      input.floorNumber !== undefined &&
      !Number.isInteger(input.floorNumber)
    ) {
      res.status(400).json({
        message: "floorNumber must be an integer",
      });
      return;
    }

    if (
      input.description !== undefined &&
      input.description !== null &&
      typeof input.description !== "string"
    ) {
      res.status(400).json({
        message: "Description must be a string or null",
      });
      return;
    }

    if (
      input.isActive !== undefined &&
      typeof input.isActive !== "boolean"
    ) {
      res.status(400).json({
        message: "isActive must be a boolean",
      });
      return;
    }

    if (
      input.name === undefined &&
      input.floorNumber === undefined &&
      input.description === undefined &&
      input.isActive === undefined
    ) {
      res.status(400).json({
        message: "Provide at least one field to update",
      });
      return;
    }

    const updated = await prisma.floor.update({
      where: { id: floor.id },
      data: {
        ...(input.name !== undefined
          ? { name: input.name.trim() }
          : {}),
        ...(input.floorNumber !== undefined
          ? { floorNumber: input.floorNumber }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.isActive !== undefined
          ? { isActive: input.isActive }
          : {}),
      },
    });

    res.json({
      message: "Floor updated successfully",
      data: updated,
    });
  } catch (error) {
    handlePrismaError(error, res, LOCATION_ERROR_MESSAGES);
  }
}

// DELETE /api/locations/:id/floors/:floorId
export async function deleteFloor(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const floor = await prisma.floor.findFirst({
      where: {
        id: req.params.floorId as string,
        location: {
          is: {
            id: req.params.id as string,
            ...locationScope(actor),
          },
        },
      },
      include: {
        _count: { select: { rooms: true } },
      },
    });

    if (!floor) {
      res.status(404).json({ message: "Floor not found" });
      return;
    }

    if (floor._count.rooms > 0) {
      res.status(409).json({
        message: "Delete or move its rooms before deleting this floor",
      });
      return;
    }

    await prisma.floor.delete({ where: { id: floor.id } });

    res.json({ message: "Floor deleted successfully" });
  } catch (error) {
    handlePrismaError(error, res, LOCATION_ERROR_MESSAGES);
  }
}