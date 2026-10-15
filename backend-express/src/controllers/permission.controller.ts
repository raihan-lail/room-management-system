
import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

export async function listPermissions(
  _req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    res.json({ data: permissions });
  } catch (error) {
    console.error("List permissions error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
}
