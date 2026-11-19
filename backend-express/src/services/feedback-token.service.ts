import { createHash, randomBytes } from "node:crypto";
import {
  FeedbackTokenType,
  type Prisma,
} from "../generated/prisma/client.js";

export function hashFeedbackToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function createFeedbackToken(
  tx: Prisma.TransactionClient,
  bookingId: string,
  type: FeedbackTokenType
): Promise<string> {
  const token = randomBytes(32).toString("hex");

  await tx.feedbackToken.create({
    data: {
      bookingId,
      type,
      tokenHash: hashFeedbackToken(token),
    },
  });

  return token;
}

/**
 * Creates a complaint feedback token for a booking and returns the raw token.
 * Only the hash is persisted, so the link cannot be recovered from the database.
 */
export function createComplaintFeedbackToken(
  tx: Prisma.TransactionClient,
  bookingId: string
): Promise<string> {
  return createFeedbackToken(tx, bookingId, FeedbackTokenType.COMPLAINT);
}

/**
 * Creates a single-use rating feedback token for a booking.
 */
export function createRatingFeedbackToken(
  tx: Prisma.TransactionClient,
  bookingId: string
): Promise<string> {
  return createFeedbackToken(tx, bookingId, FeedbackTokenType.RATING);
}

function buildFeedbackUrl(
  bookingId: string,
  token: string,
  feedbackType: string
): string | undefined {
  const origin =
    process.env.APP_URL?.trim() ||
    process.env.CORS_ORIGINS?.split(",")[0]?.trim();

  if (!origin) return undefined;

  return `${origin.replace(/\/+$/, "")}/booking/${encodeURIComponent(bookingId)}/${feedbackType}/${encodeURIComponent(token)}`;
}

export function buildComplaintFeedbackUrl(
  bookingId: string,
  token: string
): string | undefined {
  return buildFeedbackUrl(bookingId, token, "complaint");
}

export function buildRatingFeedbackUrl(
  bookingId: string,
  token: string
): string | undefined {
  return buildFeedbackUrl(bookingId, token, "rating");
}
