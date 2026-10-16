
import { randomUUID } from "node:crypto";

interface Ticket {
  userId: string;
  expiresAt: number;
}

const tickets = new Map<string, Ticket>();

const TICKET_TTL_MS = 30_000;

export function createSocketTicket(userId: string) {
  const ticket = randomUUID();

  tickets.set(ticket, {
    userId,
    expiresAt: Date.now() + TICKET_TTL_MS,
  });

  return ticket;
}

export function consumeSocketTicket(ticket: string) {
  const entry = tickets.get(ticket);

  // A ticket can only be used once.
  tickets.delete(ticket);

  if (!entry || entry.expiresAt < Date.now()) {
    return null;
  }

  return entry.userId;
}
