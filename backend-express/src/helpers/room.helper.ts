import { isGlobalSuperadmin, NO_MATCHING_ID } from "../utils/actor.js";
import type { Actor } from "../utils/actor.js";

export function roomSiteFilter(actor: Actor) {
  if (isGlobalSuperadmin(actor)) return {};

  return {
    floor: {
      location: {
        siteId: actor.siteId ?? NO_MATCHING_ID,
      },
    },
  };
}

export function singleParam(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function listParam(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : [value];
  const list = raw
    .flatMap((entry) => (typeof entry === "string" ? entry.split(",") : []))
    .map((entry) => entry.trim())
    .filter(Boolean);
  return list.length > 0 ? [...new Set(list)] : undefined;
}

export function booleanParam(value: unknown): boolean | undefined {
  const raw = singleParam(value)?.toLowerCase();

  if (raw === "true") return true;
  if (raw === "false") return false;

  return undefined;
}
