import type { Prisma } from "../generated/prisma/client.js";
import { isGlobalSuperadmin, NO_MATCHING_ID } from "../utils/actor.js";

export function allocationSiteFilter(actor: {
  siteId: string | null;
  roles: Array<{ role: { name: string; siteId: string | null } }>;
}): Prisma.RoomAllocationWhereInput {
  if (isGlobalSuperadmin(actor)) return {};

  return {
    room: {
      floor: {
        location: {
          siteId: actor.siteId ?? NO_MATCHING_ID,
        },
      },
    },
  };
}

export function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const allocationInclude = {
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
} satisfies Prisma.RoomAllocationInclude;
