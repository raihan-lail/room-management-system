import type { Prisma } from "../generated/prisma/client.js";
import { isGlobalSuperadmin, NO_MATCHING_ID } from "../utils/actor.js";

export function residentSiteFilter(actor: {
  siteId: string | null;
  roles: Array<{ role: { name: string; siteId: string | null } }>;
}): Prisma.ResidentWhereInput {
  if (isGlobalSuperadmin(actor)) return {};

  return {
    siteId: actor.siteId ?? NO_MATCHING_ID,
  };
}

export function residentSiteScope(actor: {
  siteId: string | null;
  roles: Array<{ role: { name: string; siteId: string | null } }>;
}): Prisma.SiteWhereInput {
  if (isGlobalSuperadmin(actor)) return {};

  return { id: actor.siteId ?? NO_MATCHING_ID };
}

export function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return value.trim() || null;
}
