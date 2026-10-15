import type { Response } from "express";

import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";
import {
  getActorOrRespond,
  handlePrismaError,
  isGlobalSuperadmin,
} from "../utils/actor.js";
import { notifyActor } from "../services/notification.service.js";

type SiteInput = {
  name?: string;
  code?: string;
  description?: string | null;
};

// GET /api/sites
export async function listSites(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const where = isGlobalSuperadmin(actor)
      ? {}
      : actor.siteId
        ? { id: actor.siteId }
        : { id: "__no_matching_site__" };

    const sites = await prisma.site.findMany({
      where,
      orderBy: { name: "asc" },
    });

    res.json({ data: sites });
  } catch (error) {
    handlePrismaError(error, res, {
      duplicate: "Site name or code already exists",
      notFound: "Site not found",
    });
  }
}

export async function getSite(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const where = isGlobalSuperadmin(actor)
      ? { id: req.params.id as string }
      : { id: req.params.id as string, siteId: actor.siteId ?? "__no_matching_site__" };

    const site = await prisma.site.findFirst({ where });

    if (!site) {
      res.status(404).json({ message: "Site not found" });
      return;
    }

    res.json({ data: site });
  } catch (error) {
    handlePrismaError(error, res, {
      duplicate: "Site name or code already exists",
      notFound: "Site not found",
    });
  }
}

// POST /api/sites
// Only global Superadmin can create a site.
export async function createSite(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    if (!isGlobalSuperadmin(actor)) {
      res.status(403).json({
        message: "Only the global Superadmin can create sites",
      });
      return;
    }

    const { name, code, description } = req.body as SiteInput;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof code !== "string" ||
      !code.trim()
    ) {
      res.status(400).json({
        message: "Name and code are required",
      });
      return;
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      res.status(400).json({
        message: "Description must be a string or null",
      });
      return;
    }

    const site = await prisma.site.create({
      data: {
        name: name.trim(),
        code: code.trim(),
        description: description?.trim() || null,
      },
    });

    await notifyActor(req, {
      title: "Site Created",
      message: `Site ${site.name} was created successfully.`,
      type: "SUCCESS",
    });

    res.status(201).json({
      message: "Site created successfully",
      data: site,
    });
  } catch (error) {
    handlePrismaError(error, res, {
      duplicate: "Site name or code already exists",
      notFound: "Site not found",
    });
  }
}


export async function updateSite(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const superadmin = isGlobalSuperadmin(actor);

    if (!superadmin && actor.siteId !== req.params.id) {
      res.status(403).json({
        message: "You can only update your own site",
      });
      return;
    }

    const { name, code, description } = req.body as SiteInput;

    const data: {
      name?: string;
      code?: string;
      description?: string | null;
    } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        res.status(400).json({ message: "Name cannot be empty" });
        return;
      }
      data.name = name.trim();
    }

    if (code !== undefined) {
      if (typeof code !== "string" || !code.trim()) {
        res.status(400).json({ message: "Code cannot be empty" });
        return;
      }
      data.code = code.trim();
    }

    if (description !== undefined) {
      if (
        description !== null &&
        typeof description !== "string"
      ) {
        res.status(400).json({
          message: "Description must be a string or null",
        });
        return;
      }
      data.description = description?.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({
        message: "Provide at least one field to update",
      });
      return;
    }

    const existingSite = await prisma.site.findUnique({
      where: { id: req.params.id as string },
    });

    if (!existingSite) {
      res.status(404).json({ message: "Site not found" });
      return;
    }

    const site = await prisma.site.update({
      where: { id: req.params.id as string },
      data,
    });

    await notifyActor(req, {
      title: "Site Updated",
      message: `Site ${site.name} was updated successfully.`,
      type: "INFO",
    });

    res.json({
      message: "Site updated successfully",
      data: site,
    });
  } catch (error) {
    handlePrismaError(error, res, {
      duplicate: "Site name or code already exists",
      notFound: "Site not found",
    });
  }
}


export async function deleteSite(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    if (!isGlobalSuperadmin(actor)) {
      res.status(403).json({
        message: "Only the global Superadmin can delete sites",
      });
      return;
    }

    const site = await prisma.site.findUnique({
      where: { id: req.params.id as string },
      include: {
        _count: {
          select: {
            employees: true,
            roles: true,
          },
        },
      },
    });

    if (!site) {
      res.status(404).json({ message: "Site not found" });
      return;
    }

    if (
      site._count.employees > 0 ||
      site._count.roles > 0
    ) {
      res.status(409).json({
        message:
          "Cannot delete a site that still has employees or roles assigned",
        employees: site._count.employees,
        roles: site._count.roles,
      });
      return;
    }

    await prisma.site.delete({
      where: { id: site.id },
    });

    await notifyActor(req, {
      title: "Site Deleted",
      message: `Site ${site.name} was deleted successfully.`,
      type: "WARNING",
    });

    res.json({ message: "Site deleted successfully" });
  } catch (error) {
    handlePrismaError(error, res, {
      duplicate: "Site name or code already exists",
      notFound: "Site not found",
    });
  }
}