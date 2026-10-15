import type { Response } from "express";
import { Prisma } from "../generated/prisma/client";

import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";
import {
  getActorOrRespond,
  getEffectivePermissions,
  isGlobalSuperadmin,
} from "../utils/actor.js";
import { notifyActor } from "../services/notification.service.js";

type RoleInput = {
    name?: string;
    description?: string | null;
    siteId?: string | null;
}

export async function listRoles(
    req: AuthRequest, 
    res: Response
): Promise<void> {
    try {
        const actor = await getActorOrRespond(req, res);
        if (!actor) return;

        const globalAdmin = isGlobalSuperadmin(actor);

        const roles = await prisma.role.findMany({
            where: globalAdmin
                ? {}
                : actor.siteId
                    ? { siteId: actor.siteId}
                    : { id: "__no_matching_role__"},
            include: {
                permissions: {
                    include: { permission: true},
                },
                _count: {
                    select: {employees: true},
                },
            },
            orderBy: {name: "asc"},
        });

        res.json({ data: roles});
    } catch (error) {
        console.error("List roles error:", error);
        res.status(500).json({message: 'Failed to retrieve roles'});
    }
}

export async function getRole(
    req: AuthRequest,
    res: Response
): Promise<void> {
    try {
        const actor = await getActorOrRespond(req, res);
        if (!actor) return;

        const role = await prisma.role.findUnique({
            where: { id: req.params.id as string },
            include: {
                permissions: {
                    include: {permission: true},
                },
                _count: {
                    select: { employees: true },
                },
            },
        });

        if (!role) {
            res.status(404).json({ message: "Role not found"});
            return;
        }

        const globalAdmin = isGlobalSuperadmin(actor);

        if (!globalAdmin && (!actor.siteId || role.siteId !== actor.siteId)) {
            res.status(404).json({ message: "Role not found"});
            return;
        }
        res.json({ data: role});
    } catch (error) {
        console.error("Get role error:", error);
        res.status(500).json({ message: "Failed to retrieve role"});

    }
}

export async function createRole(
    req: AuthRequest,
    res: Response
): Promise<void> {
    try {
        const actor = await getActorOrRespond(req, res);
        if (!actor) return;

        const { name, description, siteId} = req.body as RoleInput;
        const globalAdmin = isGlobalSuperadmin(actor);

        if (typeof name !== "string" || !name.trim()) {
            res.status(400).json({message: "Role name is required"});
            return;
        }

        if (!globalAdmin && !actor.siteId) {
            res.status(403).json({
                message: "You cannot create roles without a state assignment",
            });
            return;
        }
        if (!globalAdmin && siteId && siteId !== actor.siteId) {
            res.status(403).json({
                message: "you cannot create roles for another site",
            });
            return;
        }

        const targetSiteId = globalAdmin ? siteId ?? null : actor.siteId;

        if (targetSiteId) {
            const site =  await prisma.site.findUnique({
                where: {id: targetSiteId},
                select: {id:true},
            });
            if (!site) {
                res.status(400).json({ message: "Invalid siteId"});
                return;
            }
        }

        const role =  await prisma.role.create({
            data: {
                name: name.trim(),
                description:
                    typeof description === "string" ? description.trim() || null : null,
                siteId: targetSiteId,
            },
        });

        await notifyActor(req, {
            title: "Role Created",
            message: `Role ${role.name} was created successfully.`,
            type: "SUCCESS",
        });

        res.status(201).json({
            message: "Role Created Successfully",
            data: role,
        });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        ) {
            res.status(409).json({
                message: "a role with that name already exists",
            });
            return;
        }

        console.error("create role error:", error);
        res.status(500).json({ message: "Filed to create role"});
    }
}

export async function updateRole(
  req: AuthRequest,
  res: Response  
): Promise<void> {
    try {
        const actor = await getActorOrRespond(req, res);
        if (!actor) return;

        const { name, description} = req.body as RoleInput;
        const globalAdmin = isGlobalSuperadmin(actor);

        const existing = await prisma.role.findUnique({
            where: { id: req.params.id as string },

        });
        if (!existing) {
            res.status(404).json({ message: 'Role not found'});
            return;
        }

        if (!globalAdmin && (!actor.siteId || existing.siteId !== actor.siteId)) {
            res.status(404).json({ message: "Role not found"});
            return;
        }

        if (existing.name === "superadmin" && existing.siteId === null) {
            res.status(403).json({ message: "The global superadmin role cannot be edited",});
            return;
        }
        if ( description !== undefined && description !== null && typeof description !== "string") {
            res.status(400).json({ message: "Invalid description"});
            return;
        }

        const role =  await prisma.role.update({
            where: { id: existing.id},
            data: {
                ...(name !== undefined ? {name: name.trim() }: {}),
                ...(description !== undefined ? { description: description?.trim() || null}:{}),

            },
        });

        await notifyActor(req, {
            title: "Role Updated",
            message: `Role ${role.name} was updated successfully.`,
            type: "INFO",
        });

        res.json({
            message: "Role updated successfully",
            data: role,
        });

    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        ) {
            res.status(409).json({
                message: "A role with that name already exists",
            });
            return;
        }
        console.error("Update role error:", error);
        res.status(500).json({ message: "Failed to update role"});
    }
}

export async function replaceRolePermissions(
    req: AuthRequest,
    res: Response
): Promise<void> {
    try{
        const actor = await getActorOrRespond(req, res);
        if (!actor) return;

        const { permissionIds } =  req.body as {
            permissionIds?: unknown;
        };

        if (
            !Array.isArray(permissionIds) ||
            !permissionIds.every((id) => typeof id === 'string') || new Set(permissionIds).size !== permissionIds.length
        ) {
            res.status(400).json({
                message: "permissionIds must be an array of unique permission IDs",
            });
            return;
        }

        const role = await prisma.role.findUnique({
            where: {id: req.params.id as string},
        });

        if (!role) {
            res.status(404).json({ message: "Role not found"});
            return;
        }

        const globalAdmin = isGlobalSuperadmin(actor);

        if (!globalAdmin && (!actor.siteId || role.siteId !== actor.siteId)) {
            res.status(404).json({ message: "Role not found"});
            return;
        }

        if (role.name === "superadmin" && role.siteId === null) {
            res.status(403).json({
                message: "The global superadmin permissions cannot be modified",
            });
            return;
        }

        const permissions =  await prisma.permission.findMany({
        where: { id: { in: permissionIds as string[]}},
        select: { id: true, name: true},
        });

        if (permissions.length !== permissionIds.length) {
            res.status(400).json({
                message: "one or more permission IDs do not exist",
            });
            return;
        }

        if (!globalAdmin) {
            const allowed = getEffectivePermissions(actor);
            const unauthorized = permissions.filter(
                (permission) => !allowed.has(permission.name)
            );

            if (unauthorized.length > 0) {
                res.status(403).json({
                    message: "You cannot assign permissions you do not possess",
                    permissions: unauthorized.map((permission) => permission.name),
                });
                return;
            }
        }

        await prisma.$transaction(async (tx) => {
            await tx.rolePermission.deleteMany({
                where: { roleId: role.id},
            });
            if (permissionIds.length > 0) {
                await tx.rolePermission.createMany({
                    data: (permissionIds as string[]).map((permissionId) => ({
                        roleId: role.id,
                        permissionId,
                    })),
                });
            }
        });

        const updatedRole = await prisma.role.findUnique({
            where: { id: role.id},
            include:{
                permissions: {
                    include: { permission: true},
                },
            },
        });

        await notifyActor(req, {
            title: "Role Permissions Updated",
            message: `Permissions for role ${role.name} were updated successfully.`,
            type: "INFO",
        });

        res.json({
            message: "Role permissions updated successfully",
            data: updatedRole,
        });
    } catch (error) {
        console.error("Replace role permissions error:", error);
        res.status(500).json({
            message: "Failed to update role permissions",
        });
    }

}

export async function deleteRole(
    req: AuthRequest,
    res: Response
): Promise<void> {
    try {
        const actor = await getActorOrRespond(req, res);
        if (!actor) return;

        const role = await prisma.role.findUnique({
            where: {id: req.params.id as string},
            include: {
                _count: {
                    select: {employees: true}
                },
            },
        });

        if (!role) {
            res.status(404).json({message: "Role not found"});
            return;
        }
        const globalAdmin = isGlobalSuperadmin(actor);

        if (!globalAdmin && (!actor.siteId || role.siteId !== actor.siteId)) {
            res.status(404).json({message: "Role not found"});
            return;
        }

        if (role.name === "superadmin" && role.siteId === null) {
            res.status(403).json({
                message: "the global superadmin role cannot be deleted",
            });
            return;
        }
        if (role._count.employees > 0) {
            res.status(409).json({
                message: "Remove this role from employees before deleting it",
            });
            return;
        }

        await prisma.role.delete({
            where: {id: role.id},
        });

        await notifyActor(req, {
            title: "Role Deleted",
            message: `Role ${role.name} was deleted successfully.`,
            type: "WARNING",
        });

        res.json({ message: "Role deleted successfully"});
    } catch (error) {
        console.error("Delete role error:", error);
        res.status(500).json({ message: "Failed to delete role"});
    }
}




