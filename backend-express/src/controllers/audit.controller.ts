import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import type { Prisma } from "../generated/prisma/client";

function singleParam(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function listParam(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : [value];
  const list = raw
    .flatMap((entry) =>
      typeof entry === "string" ? entry.split(",") : []
    )
    .map((entry) => entry.trim())
    .filter(Boolean);
  return list.length > 0 ? [...new Set(list)] : undefined;
}

export async function getAuditLogs(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const page = Math.max(
      1,
      Number.parseInt(String(req.query.page ?? "1"), 10) || 1
    );

    const pageSize = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(String(req.query.pageSize ?? "20"), 10) || 20
      )
    );

    const actorUserId = singleParam(req.query.actorUserId);
    const actorName = singleParam(req.query.actorName);
    const resourceId = singleParam(req.query.resourceId);
    const description = singleParam(req.query.description);

    const actions = listParam(req.query.action);
    const resources = listParam(req.query.resource);

    const search = singleParam(req.query.search);

    const where: Prisma.AuditLogWhereInput = {
      ...(actorUserId ? { actorUserId } : {}),
      ...(actorName
        ? { actorName: { contains: actorName, mode: "insensitive" as const } }
        : {}),
      ...(actions
        ? actions.length === 1
          ? { action: actions[0] }
          : { action: { in: actions } }
        : {}),
      ...(resources
        ? resources.length === 1
          ? { resource: resources[0] }
          : { resource: { in: resources } }
        : {}),
      ...(resourceId ? { resourceId } : {}),
      ...(description
        ? { description: { contains: description, mode: "insensitive" as const } }
        : {}),
      ...(search
        ? {
            OR: [
              {
                actorUserId: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                actorName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                action: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                resource: {
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
                resourceId: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),

      prisma.auditLog.count({ where }),
    ]);

    return res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
}