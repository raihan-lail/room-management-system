import { isGlobalSuperadmin, NO_MATCHING_ID } from "../utils/actor.js";
import type { Actor } from "../utils/actor.js";

export const BED_STATUSES = [
  "VACANT",
  "BOOKED",
  "OCCUPIED",
  "HOME_LEAVE",
] as const;

export type BedStatus = (typeof BED_STATUSES)[number];

export function singleParam(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function parseBoolean(value: unknown): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function bedSiteFilter(actor: Actor) {
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
