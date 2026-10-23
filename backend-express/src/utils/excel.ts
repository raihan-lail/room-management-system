
import { Gender, Prisma } from "../generated/prisma/client.js";
import {
  getActorOrRespond,
  isGlobalSuperadmin,
  handlePrismaError,
  NO_MATCHING_ID,
} from "../utils/actor.js";
import multer from "multer";



export function textValue(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

export function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;

  const valueText = textValue(value).toLowerCase();

  if (["true", "1", "yes"].includes(valueText)) return true;
  if (["false", "0", "no"].includes(valueText)) return false;

  return null;
}

export function parseInteger(value: unknown): number | null {
  if (
    typeof value === "number" &&
    Number.isInteger(value)
  ) {
    return value;
  }

  const valueText = textValue(value);

  if (!/^\d+$/.test(valueText)) return null;

  const parsed = Number(valueText);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function normalizeHeader(header: string): string {
  return header.trim().replace(/\s+/g, "").toLowerCase();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function getSiteScope(actor: {
  siteId: string | null;
  roles: Array<{ role: { name: string; siteId: string | null } }>;
}): Prisma.FloorWhereInput {
  if (isGlobalSuperadmin(actor)) return {};

  return {
    location: {
      siteId: actor.siteId ?? NO_MATCHING_ID,
    },
  };
}

export function readString(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

export function parseGender(value: unknown): Gender | null {
  const normalized = readString(value).toUpperCase();

  if (Object.values(Gender).includes(normalized as Gender)) {
    return normalized as Gender;
  }

  return null;
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
      callback(new Error("Only .xlsx files are supported."));
      return;
    }

    callback(null, true);
  },
});