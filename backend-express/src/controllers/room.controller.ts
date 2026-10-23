import type { Response } from "express";

import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";


import {
  getActorOrRespond,
  isGlobalSuperadmin,
  handlePrismaError,
  NO_MATCHING_ID,
} from "../utils/actor.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

import type { Actor } from "../utils/actor.js";
import { notifyActor } from "../services/notification.service.js";
import { auditActor, auditInTransaction } from "../services/audit.service.js";
import * as XLSX from "xlsx";
import type { ImportRow, RowError } from "../types/room.type.js";
import { getSiteScope, normalizeHeader, parseBoolean, parseInteger, textValue } from "../utils/excel.js";

function roomSiteFilter(actor: Actor) {
  if (isGlobalSuperadmin(actor)) return {};

  return {
    floor: {
      location: {
        siteId: actor.siteId ?? NO_MATCHING_ID,
      },
    },
  };
}



function singleParam(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function listParam(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : [value];
  const list = raw
    .flatMap((entry) => (typeof entry === "string" ? entry.split(",") : []))
    .map((entry) => entry.trim())
    .filter(Boolean);
  return list.length > 0 ? [...new Set(list)] : undefined;
}

function booleanParam(value: unknown): boolean | undefined {
  const raw = singleParam(value)?.toLowerCase();

  if (raw === "true") return true;
  if (raw === "false") return false;

  return undefined;
}

export async function listRooms(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const page = Math.max(
      1,
      Number.parseInt(String(req.query.page ?? "1"), 10) || 1,
    );

    const pageSize = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(String(req.query.pageSize ?? "20"), 10) || 20,
      ),
    );

    const floorId = singleParam(req.query.floorId);
    const name = singleParam(req.query.name);
    const description = singleParam(req.query.description);
    const row = singleParam(req.query.row);

    const types = listParam(req.query.type);
    const isBookable = booleanParam(req.query.isBookable);

    const search = singleParam(req.query.search);

    const where: Prisma.RoomWhereInput = {
      ...roomSiteFilter(actor),
      ...(floorId ? { floorId } : {}),
      ...(name
        ? { name: { contains: name, mode: "insensitive" as const } }
        : {}),
      ...(description
        ? {
            description: {
              contains: description,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(row
        ? { row: { contains: row, mode: "insensitive" as const } }
        : {}),
      ...(types
        ? types.length === 1
          ? { type: types[0] }
          : { type: { in: types } }
        : {}),
      ...(isBookable !== undefined ? { isBookable } : {}),
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                description: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                type: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                row: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const [rooms, total] = await prisma.$transaction([
      prisma.room.findMany({
        where,
        include: {
          floor: {
            include: {
              location: {
                include: { site: true },
              },
            },
          },
          beds: true,
          _count: { select: { beds: true } },
        },
        orderBy: [{ name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),

      prisma.room.count({ where }),
    ]);

    return res.json({
      rooms,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return handlePrismaError(error, res);
  }
}

export async function getRoom(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const room = await prisma.room.findFirst({
      where: {
        id: req.params.id as string,
        ...roomSiteFilter(actor),
      },
      include: {
        floor: {
          include: {
            location: {
              include: { site: true },
            },
          },
        },
        beds: true,
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    return res.json({ room });
  } catch (error) {
    return handlePrismaError(error, res);
  }
}

export async function createRoom(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const {
      floorId,
      name,
      description,
      row,
      isBookable,
      numberOfBeds = 1,
    } = req.body;

    if (
      typeof floorId !== "string" ||
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        message: "floorId and name are required",
      });
    }

    if (
      !Number.isInteger(numberOfBeds) ||
      numberOfBeds < 1 ||
      numberOfBeds > 100
    ) {
      return res.status(400).json({
        message: "numberOfBeds must be an integer between 1 and 100",
      });
    }

    if (isBookable !== undefined && typeof isBookable !== "boolean") {
      return res.status(400).json({
        message: "isBookable must be a boolean",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        message: "description must be a string",
      });
    }

    if (row !== undefined && row !== null && typeof row !== "string") {
      return res.status(400).json({
        message: "row must be a string",
      });
    }

    const floor = await prisma.floor.findFirst({
      where: {
        id: floorId,
        ...(isGlobalSuperadmin(actor)
          ? {}
          : {
              location: {
                siteId: actor.siteId ?? NO_MATCHING_ID,
              },
            }),
      },
      select: { id: true },
    });

    if (!floor) {
      return res.status(404).json({
        message: "Floor not found or access denied",
      });
    }

    const room = await prisma.$transaction(async (tx) => {
      const created = await tx.room.create({
        data: {
          floorId,
          name: name.trim(),
          description:
            typeof description === "string"
              ? description.trim() || null
              : null,
          row: typeof row === "string" ? row.trim() || null : null,
          isBookable: isBookable ?? true,

          beds: {
            create: Array.from({ length: numberOfBeds }, (_, index) => ({
              name: `Bed ${index + 1}`,
            })),
          },
        },
        include: {
          floor: true,
          beds: true,
        },
      });

      await auditInTransaction(tx, req, actor, {
        action: "create",
        resource: "room",
        resourceId: created.id,
        description: `Room ${created.name} created`,
        after: created,
      });

      return created;
    });

    await notifyActor(req, {
      title: "Room Created",
      message: `Room ${room.name} was created successfully.`,
      type: "SUCCESS",
    });

    return res.status(201).json({ room });
  } catch (error) {
    return handlePrismaError(error, res, {
      duplicate: "A room with this name already exists on this floor",
    });
  }
}

export async function updateRoom(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const id = req.params.id as string;
    const { floorId, name, description, row, isBookable } = req.body;

    const existing = await prisma.room.findFirst({
      where: {
        id,
        ...roomSiteFilter(actor),
      },
    });

    if (!existing) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (floorId !== undefined) {
      if (typeof floorId !== "string") {
        return res.status(400).json({ message: "Invalid floorId" });
      }

      const floor = await prisma.floor.findFirst({
        where: {
          id: floorId,
          ...(isGlobalSuperadmin(actor)
            ? {}
            : {
                location: {
                  siteId: actor.siteId ?? NO_MATCHING_ID,
                },
              }),
        },
        select: { id: true },
      });

      if (!floor) {
        return res.status(404).json({
          message: "Floor not found or access denied",
        });
      }
    }

    const data: {
      floorId?: string;
      name?: string;
      description?: string | null;
      row?: string | null;
      isBookable?: boolean;
    } = {};

    if (floorId !== undefined) data.floorId = floorId;

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Invalid room name" });
      }
      data.name = name.trim();
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return res.status(400).json({ message: "Invalid description" });
      }
      data.description =
        typeof description === "string" ? description.trim() || null : null;
    }

    if (row !== undefined) {
      if (row !== null && typeof row !== "string") {
        return res.status(400).json({ message: "Invalid row" });
      }
      data.row = typeof row === "string" ? row.trim() || null : null;
    }

    if (isBookable !== undefined) {
      if (typeof isBookable !== "boolean") {
        return res.status(400).json({ message: "Invalid isBookable" });
      }

      if (isBookable) {
        const allocation = await prisma.roomAllocation.findUnique({
          where: { roomId: id },
          select: { id: true },
        });

        if (allocation) {
          return res.status(409).json({
            message:
              "Cannot make an allocated room bookable. Delete its allocation first.",
          });
        }
      }

      data.isBookable = isBookable;
    }

    const room = await prisma.room.update({
      where: { id },
      data,
      include: { beds: true },
    });

    await notifyActor(req, {
      title: "Room Updated",
      message: `Room ${room.name} was updated successfully.`,
      type: "INFO",
    });

    await auditActor(req, actor, {
      action: "update",
      resource: "room",
      resourceId: room.id,
      description: `Room ${room.name} updated`,
      before: existing,
      after: room,
    });

    return res.json({ room });
  } catch (error) {
    return handlePrismaError(error, res, {
      duplicate: "A room with this name already exists on this floor",
      notFound: "Room not found",
    });
  }
}

export async function deleteRoom(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const id = req.params.id as string;

    const room = await prisma.room.findFirst({
      where: {
        id,
        ...roomSiteFilter(actor),
      },
      include: {
        _count: { select: { beds: true } },
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (room._count.beds > 0) {
      return res.status(409).json({
        message:
          "Cannot delete a room that still has beds. Remove its beds first if they have no dependent bookings.",
      });
    }

    await prisma.room.delete({ where: { id } });

    await notifyActor(req, {
      title: "Room Deleted",
      message: `Room ${room.name} was deleted successfully.`,
      type: "WARNING",
    });

    await auditActor(req, actor, {
      action: "delete",
      resource: "room",
      resourceId: room.id,
      description: `Room ${room.name} deleted`,
      before: room,
    });

    return res.json({ message: "Room deleted successfully" });
  } catch (error) {
    return handlePrismaError(error, res, {
      conflict: "Cannot delete a room with dependent records",
      notFound: "Room not found",
    });
  }
}

export async function importRoomsFromExcel(
  req: AuthRequest,
  res: Response,
) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    if (!req.file) {
      return res.status(400).json({
        message: "Please upload an Excel file.",
      });
    }

    // Allow only Excel Open XML workbooks.
    if (
      !req.file.originalname.toLowerCase().endsWith(".xlsx")
    ) {
      return res.status(400).json({
        message: "Only .xlsx Excel files are supported.",
      });
    }

    let worksheet: XLSX.WorkSheet;
    let rawRows: Record<string, unknown>[];

    try {
      const workbook = XLSX.read(req.file.buffer, {
        type: "buffer",
        cellDates: false,
      });

      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        return res.status(400).json({
          message: "The Excel file does not contain a worksheet.",
        });
      }

      worksheet = workbook.Sheets[firstSheetName];

      rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet,
        { defval: "" },
      );
    } catch {
      return res.status(400).json({
        message: "Unable to read the Excel file.",
      });
    }

    if (rawRows.length === 0) {
      return res.status(400).json({
        message: "The Excel worksheet contains no data rows.",
      });
    }

    if (rawRows.length > 1000) {
      return res.status(400).json({
        message: "A maximum of 1,000 rooms can be imported per file.",
      });
    }

    // Normalize header names so "siteName" and "Site Name"
    // are both accepted.
    const normalizedRows = rawRows.map((raw) => {
      const normalized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(raw)) {
        normalized[normalizeHeader(key)] = value;
      }

      return normalized;
    });

    const requiredHeaders = [
      "sitename",
      "locationname",
      "floornumber",
      "roomname",
      "isbookable",
      "numberofbeds",
    ];

    const actualHeaders = new Set(
      Object.keys(normalizedRows[0] ?? {}),
    );

    const missingHeaders = requiredHeaders.filter(
      (header) => !actualHeaders.has(header),
    );

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        message: "The Excel file is missing required columns.",
        missingColumns: missingHeaders,
        requiredColumns: requiredHeaders,
      });
    }

    const errors: RowError[] = [];
    const parsedRows: ImportRow[] = [];
    const roomKeys = new Set<string>();

    for (let index = 0; index < normalizedRows.length; index++) {
      const raw = normalizedRows[index];
      const excelRow = index + 2;

      const siteName = textValue(raw.sitename);
      const locationName = textValue(raw.locationname);
      const floorNumber = parseInteger(raw.floornumber);
      const roomName = textValue(raw.roomname);
      const description = textValue(raw.description) || null;
      const roomRow = textValue(raw.row) || null;
      const isBookable = parseBoolean(raw.isbookable);
      const numberOfBeds = parseInteger(raw.numberofbeds);

      const bedNamesText = textValue(raw.bednames);
      const bedNames = bedNamesText
        ? bedNamesText.split(";").map((name) => name.trim())
        : [];

      const addError = (message: string) => {
        errors.push({
          row: excelRow,
          ...(roomName ? { roomName } : {}),
          message,
        });
      };

      if (!siteName) addError("siteName is required.");
      if (!locationName) addError("locationName is required.");

      if (floorNumber === null || floorNumber < 0) {
        addError("floorNumber must be a non-negative integer.");
      }

      if (!roomName) addError("roomName is required.");

      if (roomName.length > 100) {
        addError("roomName cannot exceed 100 characters.");
      }

      if (isBookable === null) {
        addError("isBookable must be TRUE or FALSE.");
      }

      if (
        numberOfBeds === null ||
        numberOfBeds < 0 ||
        numberOfBeds > 100
      ) {
        addError("numberOfBeds must be an integer from 0 to 100.");
      }

      if (
        isBookable === true &&
        numberOfBeds !== null &&
        numberOfBeds < 1
      ) {
        addError("Bookable rooms must have at least one bed.");
      }

      if (
        description !== null &&
        description.length > 2000
      ) {
        addError("description cannot exceed 2,000 characters.");
      }

      if (roomRow !== null && roomRow.length > 100) {
        addError("row cannot exceed 100 characters.");
      }

      if (
        bedNames.some((name) => !name) ||
        new Set(bedNames.map((name) => name.toLowerCase())).size !==
          bedNames.length
      ) {
        addError("bedNames cannot contain empty or duplicate names.");
      }

      if (
        numberOfBeds !== null &&
        bedNames.length > 0 &&
        bedNames.length !== numberOfBeds
      ) {
        addError(
          "The number of bedNames must match numberOfBeds.",
        );
      }

      if (errors.some((error) => error.row === excelRow)) {
        continue;
      }

      const roomKey = [
        siteName.toLowerCase(),
        locationName.toLowerCase(),
        String(floorNumber),
        roomName.toLowerCase(),
      ].join("|");

      if (roomKeys.has(roomKey)) {
        addError("Duplicate room name in this Excel file.");
        continue;
      }

      roomKeys.add(roomKey);

      parsedRows.push({
        siteName,
        locationName,
        floorNumber: floorNumber!,
        roomName,
        description,
        row: roomRow,
        isBookable: isBookable!,
        numberOfBeds: numberOfBeds!,
        bedNames,
        excelRow,
      });
    }

    // Resolve floor names and enforce site-level authorization.
    const floors = await prisma.floor.findMany({
      where: {
        ...getSiteScope(actor),
        location: {
          ...(isGlobalSuperadmin(actor)
            ? {}
            : {
                siteId: actor.siteId ?? NO_MATCHING_ID,
              }),
        },
      },
      include: {
        location: {
          include: { site: true },
        },
      },
    });

    const floorByKey = new Map<string, (typeof floors)[number]>();

    for (const floor of floors) {
      const key = [
        floor.location.site.name.toLowerCase(),
        floor.location.name.toLowerCase(),
        String(floor.floorNumber),
      ].join("|");

      // If this key occurs more than once, mark it ambiguous.
      if (floorByKey.has(key)) {
        floorByKey.set(key, null as never);
      } else {
        floorByKey.set(key, floor);
      }
    }

    const resolvedRows: Array<{
      row: ImportRow;
      floorId: string;
    }> = [];

    for (const row of parsedRows) {
      const key = [
        row.siteName.toLowerCase(),
        row.locationName.toLowerCase(),
        String(row.floorNumber),
      ].join("|");

      const floor = floorByKey.get(key);

      if (!floor) {
        errors.push({
          row: row.excelRow,
          roomName: row.roomName,
          message:
            "Floor not found, inaccessible, or ambiguous for this site and location.",
        });
        continue;
      }

      const existingRoom = await prisma.room.findFirst({
        where: {
          floorId: floor.id,
          name: { equals: row.roomName, mode: "insensitive" },
        },
        select: { id: true },
      });

      if (existingRoom) {
        errors.push({
          row: row.excelRow,
          roomName: row.roomName,
          message: "A room with this name already exists on this floor.",
        });
        continue;
      }

      resolvedRows.push({
        row,
        floorId: floor.id,
      });
    }

    // All-or-nothing behavior: don't import if any row is invalid.
    if (errors.length > 0) {
      return res.status(400).json({
        message:
          "Import validation failed. No rooms were created.",
        totalRows: rawRows.length,
        validRows: resolvedRows.length,
        errorCount: errors.length,
        errors,
      });
    }

    if (resolvedRows.length === 0) {
      return res.status(400).json({
        message: "There are no rooms to import.",
      });
    }

    // Create every room and its beds in one transaction.
    const createdRooms = await prisma.$transaction(
      async (tx) => {
        const created = [];

        for (const { row, floorId } of resolvedRows) {
          const room = await tx.room.create({
            data: {
              floorId,
              name: row.roomName,
              description: row.description,
              row: row.row,
              isBookable: row.isBookable,
              beds: {
                create: Array.from(
                  { length: row.numberOfBeds },
                  (_, index) => ({
                    name: row.bedNames[index] || `Bed ${index + 1}`,
                  }),
                ),
              },
            },
            include: {
              beds: true,
              floor: {
                include: {
                  location: {
                    include: { site: true },
                  },
                },
              },
            },
          });

          created.push(room);
        }

        return created;
      },
      { maxWait: 10000, timeout: 60000 },
    );

    // Notify and audit after the database transaction succeeds.
    await notifyActor(req, {
      title: "Room Import Completed",
      message: `${createdRooms.length} rooms were imported successfully.`,
      type: "SUCCESS",
    });

    await auditActor(req, actor, {
      action: "import",
      resource: "room",
      description: `Imported ${createdRooms.length} rooms from an Excel file`,
      after: {
        filename: req.file.originalname,
        totalRooms: createdRooms.length,
        totalBeds: createdRooms.reduce(
          (total, room) => total + room.beds.length,
          0,
        ),
      },
    });

    return res.status(201).json({
      message: "Rooms imported successfully.",
      importedRooms: createdRooms.length,
      importedBeds: createdRooms.reduce(
        (total, room) => total + room.beds.length,
        0,
      ),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return res.status(409).json({
          message:
            "Import conflicts with an existing room or bed. No rooms were imported.",
        });
      }
    }

    return handlePrismaError(error, res, {
      duplicate: "A room or bed with the same unique value already exists.",
      conflict: "Unable to import rooms because related records conflict.",
    });
  }
}
