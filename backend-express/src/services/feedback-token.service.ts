import { createHash, randomBytes } from "node:crypto";
import {
  FeedbackTokenType,
  type Prisma,
} from "../generated/prisma/client.js";

export function hashFeedbackToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a complaint feedback token for a booking and returns the raw token.
 * Only the hash is persisted, so the link cannot be recovered from the database.
 */
export async function createComplaintFeedbackToken(
  tx: Prisma.TransactionClient,
  bookingId: string
): Promise<string> {
  const token = randomBytes(32).toString("hex");

  await tx.feedbackToken.create({
    data: {
      bookingId,
      type: FeedbackTokenType.COMPLAINT,
      tokenHash: hashFeedbackToken(token),
    },
  });

  return token;
}

export function buildComplaintFeedbackUrl(
  bookingId: string,
  token: string
): string | undefined {
  const origin =
    process.env.APP_URL?.trim() ||
    process.env.CORS_ORIGINS?.split(",")[0]?.trim();

  if (!origin) return undefined;

  return `${origin.replace(/\/+$/, "")}/booking/${encodeURIComponent(bookingId)}/complaint/${encodeURIComponent(token)}`;
}
