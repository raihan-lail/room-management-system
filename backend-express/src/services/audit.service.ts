import type { Request } from "express";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma.js";

interface CreateAuditLogInput {
  actorUserId?: string | null;
  actorName?: string | null;

  action: string;
  resource: string;
  resourceId?: string | null;
  description?: string | null;

  before?: unknown;
  after?: unknown;

  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function createAuditLog(
  tx: Prisma.TransactionClient,
  input: CreateAuditLogInput
) {
  return tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorName: input.actorName ?? null,

      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      description: input.description ?? null,

      before: toAuditJson(input.before),
      after: toAuditJson(input.after),

      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

type AuditActorLike = {
  userId?: string | null;
  name?: string | null;
} | null | undefined;

/**
 * Best-effort audit log for the acting user (outside a transaction).
 * Never throws: failures are logged so the main operation still succeeds.
 */
export async function auditActor(
  req: Request & { userId?: string },
  actor: AuditActorLike,
  input: Omit<CreateAuditLogInput, "actorUserId" | "actorName" | "ipAddress" | "userAgent">
): Promise<void> {
  try {
    const meta = getRequestMeta(req);
    await prisma.auditLog.create({
      data: {
        actorUserId: req.userId ?? actor?.userId ?? null,
        actorName: actor?.name ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        description: input.description ?? null,
        before: toAuditJson(input.before),
        after: toAuditJson(input.after),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

/**
 * Best-effort audit log inside a `$transaction` callback.
 * Never throws the outer transaction: logs the error instead.
 */
export async function auditInTransaction(
  tx: Prisma.TransactionClient,
  req: Request & { userId?: string },
  actor: AuditActorLike,
  input: Omit<CreateAuditLogInput, "actorUserId" | "actorName" | "ipAddress" | "userAgent">
): Promise<void> {
  try {
    const meta = getRequestMeta(req);
    await createAuditLog(tx, {
      ...input,
      actorUserId: req.userId ?? actor?.userId ?? null,
      actorName: actor?.name ?? null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

export function getRequestMeta(req: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : undefined;

  const ipAddress =
    forwardedIp || req.ip || req.socket?.remoteAddress || null;

  const userAgent =
    typeof req.headers["user-agent"] === "string"
      ? (req.headers["user-agent"] as string)
      : null;

  return { ipAddress, userAgent };
}

const SENSITIVE_KEYS = new Set(["password", "passwordHash", "token", "access_token"]);

function stripSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSensitive);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(record)) {
      if (SENSITIVE_KEYS.has(key)) continue;
      cleaned[key] = stripSensitive(val);
    }
    return cleaned;
  }
  return value;
}

/**
 * Convert arbitrary values (incl. Dates) to Prisma JSON-safe input,
 * stripping sensitive keys such as passwords.
 */
export function toAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  try {
    const cleaned = stripSensitive(value);
    return JSON.parse(JSON.stringify(cleaned)) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}
