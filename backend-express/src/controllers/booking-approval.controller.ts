import type { Response } from "express";
import { BookingChangeStatus, BookingChangeType, BookingStatus } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { getActorOrRespond, isGlobalSuperadmin, NO_MATCHING_ID } from "../utils/actor.js";
import { auditActor } from "../services/audit.service.js";
import { notifyActor, notifyUsers } from "../services/notification.service.js";
import { getSiteBookingFilter, getSiteBedFilter, getSiteResidentFilter, parseDate, refreshBedStatus, validateBookingDates, validateResidentBookingDates } from "../helpers/booking.helper.js";

const includeRequest = { booking: { include: { resident: true, bed: { include: { room: true } } } }, requestedBy: { select: { id: true, name: true } }, reviewedBy: { select: { id: true, name: true } } } as const;

export async function listBookingChangeRequests(req: AuthRequest, res: Response): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;
  try {
    const requests = await prisma.bookingChangeRequest.findMany({
      where: { booking: getSiteBookingFilter(actor), ...(typeof req.query.status === "string" ? { status: req.query.status as BookingChangeStatus } : {}) },
      include: includeRequest,
      orderBy: { requestedAt: "desc" },
    });
    const requestedBedIds = requests.flatMap((request) => {
      const bedId = (request.requestedData as Record<string, unknown>).bedId;
      return typeof bedId === "string" ? [bedId] : [];
    });
    const requestedBeds = requestedBedIds.length
      ? await prisma.bed.findMany({
          where: { id: { in: requestedBedIds }, ...getSiteBedFilter(actor) },
          select: { id: true, name: true, room: { select: { name: true } } },
        })
      : [];
    const requestedBedsById = new Map(requestedBeds.map((bed) => [bed.id, bed]));
    res.json({ data: requests.map((request) => {
      const bedId = (request.requestedData as Record<string, unknown>).bedId;
      return { ...request, requestedBed: typeof bedId === "string" ? requestedBedsById.get(bedId) ?? null : null };
    }) });
  } catch (error) {
    console.error("List booking change requests error:", error);
    res.status(500).json({ message: "Failed to load booking change requests." });
  }
}

export async function createBookingChangeRequest(req: AuthRequest, res: Response): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;
  try {
    const { bookingId, type, requestedData, reason } = req.body ?? {};
    if (typeof bookingId !== "string" || !bookingId || !["CHANGE_DATES", "EXTEND", "CANCEL", "OTHER"].includes(type)) {
      res.status(400).json({ message: "bookingId and a valid change type are required." }); return;
    }
    if (!requestedData || typeof requestedData !== "object" || Array.isArray(requestedData)) {
      res.status(400).json({ message: "requestedData must be an object." }); return;
    }
    const allowed = new Set(["residentId", "bedId", "startedAt", "endedAt", "notes", "operation"]);
    if ((Object.keys(requestedData).length === 0 && type !== "CANCEL") || Object.keys(requestedData).some((key) => !allowed.has(key)) || (requestedData.operation !== undefined && (type !== "OTHER" || requestedData.operation !== "ARCHIVE"))) {
      res.status(400).json({ message: "Requested booking changes contain unsupported fields." }); return;
    }
    if (type === "EXTEND" && (typeof requestedData.endedAt !== "string" || !parseDate(requestedData.endedAt))) { res.status(400).json({ message: "A valid new endedAt date is required." }); return; }
    for (const field of ["startedAt", "endedAt"] as const) {
      if (requestedData[field] !== undefined && (typeof requestedData[field] !== "string" || !parseDate(requestedData[field]))) { res.status(400).json({ message: `${field} must be a valid date.` }); return; }
    }
    for (const field of ["residentId", "bedId"] as const) {
      if (requestedData[field] !== undefined && (typeof requestedData[field] !== "string" || !requestedData[field])) { res.status(400).json({ message: `${field} must be a non-empty string.` }); return; }
    }
    if (requestedData.notes !== undefined && requestedData.notes !== null && typeof requestedData.notes !== "string") { res.status(400).json({ message: "notes must be a string or null." }); return; }
    if (reason !== undefined && typeof reason !== "string") { res.status(400).json({ message: "reason must be a string." }); return; }
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, ...getSiteBookingFilter(actor) } });
    if (!booking) { res.status(404).json({ message: "Booking not found." }); return; }
    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.IN_HOUSE) { res.status(409).json({ message: "Only confirmed or in-house bookings can be changed." }); return; }
    const pending = await prisma.bookingChangeRequest.findFirst({ where: { bookingId, status: BookingChangeStatus.PENDING } });
    if (pending) { res.status(409).json({ message: "This booking already has a pending change request." }); return; }
    const oldData = { residentId: booking.residentId, bedId: booking.bedId, startedAt: booking.startedAt.toISOString(), endedAt: booking.endedAt.toISOString(), notes: booking.notes };
    const created = await prisma.bookingChangeRequest.create({ data: { bookingId, requestedById: actor.id, type: type as BookingChangeType, reason: typeof reason === "string" ? reason.trim() || null : null, oldData, requestedData }, include: includeRequest });
    await auditActor(req, actor, { action: "booking_change_requested", resource: "BookingChangeRequest", resourceId: created.id, description: `Booking change requested for ${booking.bookingNumber}.` });
    await notifyActor(req, { title: "Booking Change Requested", message: `A change request was submitted for booking ${booking.bookingNumber}.`, type: "INFO" });
    res.status(201).json({ message: "Booking change request submitted.", data: created });
  } catch (error) {
    console.error("Create booking change request error:", error);
    res.status(500).json({ message: "Failed to submit booking change request." });
  }
}

export async function reviewBookingChangeRequest(req: AuthRequest, res: Response): Promise<void> {
  const actor = await getActorOrRespond(req, res);
  if (!actor) return;
  const { decision, rejectionReason } = req.body ?? {};
  if (!["APPROVED", "REJECTED"].includes(decision)) { res.status(400).json({ message: "decision must be APPROVED or REJECTED." }); return; }
  if (decision === "REJECTED" && rejectionReason !== undefined && typeof rejectionReason !== "string") { res.status(400).json({ message: "rejectionReason must be a string." }); return; }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.bookingChangeRequest.findFirst({ where: { id: req.params.id as string, booking: getSiteBookingFilter(actor) }, include: { booking: true, requestedBy: { select: { userId: true } } } });
      if (!request) throw Object.assign(new Error("Change request not found."), { statusCode: 404 });
      if (request.status !== BookingChangeStatus.PENDING) throw Object.assign(new Error("This request has already been reviewed."), { statusCode: 409 });
      let updatedBooking = null;
      if (decision === "APPROVED" && request.type === BookingChangeType.CANCEL) {
        updatedBooking = await tx.booking.update({ where: { id: request.bookingId }, data: { status: BookingStatus.CANCELLED, cancelledAt: new Date(), cancellationReason: request.reason } });
        await refreshBedStatus(tx, request.booking.bedId);
      } else if (decision === "APPROVED" && request.type === BookingChangeType.OTHER && (request.requestedData as Record<string, unknown>).operation === "ARCHIVE") {
        updatedBooking = await tx.booking.update({ where: { id: request.bookingId }, data: { status: BookingStatus.ARCHIVED, archivedAt: new Date() } });
        await refreshBedStatus(tx, request.booking.bedId);
      } else if (decision === "APPROVED") {
        const oldData = request.oldData as Record<string, unknown>;
        if (oldData.residentId !== request.booking.residentId || oldData.bedId !== request.booking.bedId || oldData.startedAt !== request.booking.startedAt.toISOString() || oldData.endedAt !== request.booking.endedAt.toISOString() || oldData.notes !== request.booking.notes) throw Object.assign(new Error("Booking changed after this request was submitted. Review it again against the current booking."), { statusCode: 409 });
        const data = request.requestedData as Record<string, unknown>;
        const residentId = data.residentId === undefined ? request.booking.residentId : data.residentId;
        const bedId = data.bedId === undefined ? request.booking.bedId : data.bedId;
        const startedAt = data.startedAt === undefined ? request.booking.startedAt : parseDate(data.startedAt);
        const endedAt = data.endedAt === undefined ? request.booking.endedAt : parseDate(data.endedAt);
        if (typeof residentId !== "string" || typeof bedId !== "string" || !startedAt || !endedAt || startedAt >= endedAt) throw Object.assign(new Error("Requested booking details are invalid."), { statusCode: 400 });
        if (data.residentId !== undefined && !await tx.resident.findFirst({ where: { id: residentId, ...getSiteResidentFilter(actor), user: { isActive: true } }, select: { id: true } })) throw Object.assign(new Error("Requested resident is unavailable."), { statusCode: 409 });
        if (data.bedId !== undefined && !await tx.bed.findFirst({ where: { id: bedId, isActive: true, ...getSiteBedFilter(actor), room: { isBookable: true, floor: { location: { siteId: isGlobalSuperadmin(actor) ? undefined : actor.siteId ?? NO_MATCHING_ID } } } }, select: { id: true } })) throw Object.assign(new Error("Requested bed is unavailable."), { statusCode: 409 });
        const conflict = await validateBookingDates(tx, { bedId, startedAt, endedAt, excludeBookingId: request.bookingId });
        if (conflict) throw Object.assign(new Error(conflict), { statusCode: 409 });
        const residentConflict = await validateResidentBookingDates(tx, { residentId, startedAt, endedAt, excludeBookingId: request.bookingId });
        if (residentConflict) throw Object.assign(new Error(residentConflict), { statusCode: 409 });
        updatedBooking = await tx.booking.update({ where: { id: request.bookingId }, data: { residentId, bedId, startedAt, endedAt, ...(data.notes !== undefined ? { notes: typeof data.notes === "string" ? data.notes.trim() || null : null } : {}) } });
        if (request.booking.bedId !== bedId) { await refreshBedStatus(tx, request.booking.bedId); await refreshBedStatus(tx, bedId); }
        else if (+request.booking.startedAt !== +startedAt || +request.booking.endedAt !== +endedAt) await refreshBedStatus(tx, bedId);
      }
      const reviewedRequest = await tx.bookingChangeRequest.update({ where: { id: request.id }, data: { status: decision as BookingChangeStatus, reviewedById: actor.id, reviewedAt: new Date(), rejectionReason: decision === "REJECTED" ? (rejectionReason?.trim() || null) : null }, include: includeRequest });
      return { reviewedRequest, requesterUserId: request.requestedBy.userId, bookingNumber: request.booking.bookingNumber };
    });
    await auditActor(req, actor, { action: `booking_change_${decision.toLowerCase()}`, resource: "BookingChangeRequest", resourceId: result.reviewedRequest.id, description: `Booking change request ${decision.toLowerCase()}.` });
    await notifyActor(req, { title: "Booking Change Reviewed", message: `A booking change request was ${decision.toLowerCase()}.`, type: "INFO" });
    await notifyUsers([result.requesterUserId], {
      title: `Booking Change ${decision === "APPROVED" ? "Approved" : "Rejected"}`,
      message: `Your change request for booking ${result.bookingNumber} was ${decision.toLowerCase()}.${decision === "REJECTED" && rejectionReason?.trim() ? ` Reason: ${rejectionReason.trim()}` : ""}`,
      type: decision === "APPROVED" ? "SUCCESS" : "WARNING",
      link: "/bookings/table",
    });
    res.json({ message: `Booking change request ${decision.toLowerCase()}.`, data: result.reviewedRequest });
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
    if (statusCode) { res.status(statusCode).json({ message: (error as Error).message }); return; }
    console.error("Review booking change request error:", error);
    res.status(500).json({ message: "Failed to review booking change request." });
  }
}

export async function requestBookingCancellation(req: AuthRequest, res: Response): Promise<void> {
  req.body = { bookingId: req.params.id, type: "CANCEL", reason: req.body?.reason ?? req.body?.cancellationReason, requestedData: {} };
  await createBookingChangeRequest(req, res);
}

export async function requestBookingExtension(req: AuthRequest, res: Response): Promise<void> {
  req.body = { bookingId: req.params.id, type: "EXTEND", reason: req.body?.reason ?? "Stay extension requested", requestedData: { endedAt: req.body?.endedAt } };
  await createBookingChangeRequest(req, res);
}

export async function requestBookingArchive(req: AuthRequest, res: Response): Promise<void> {
  req.body = { bookingId: req.params.id, type: "OTHER", reason: req.body?.reason ?? "Booking archive requested", requestedData: { operation: "ARCHIVE" } };
  await createBookingChangeRequest(req, res);
}
