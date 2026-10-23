import type { Request, Response, CookieOptions } from "express";
import argon2 from "argon2";

import { prisma } from "../lib/prisma.js";
import { generateAccessToken } from "../lib/jwt.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { getEmployeeEffectivePermissions } from "../lib/permission.js";
import { auditActor } from "../services/audit.service.js";

async function buildAuthUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      employee: {
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      },
      resident: {
        include: {
          site: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  if (user.employee) {
    const roleNames = user.employee.roles.map(
      (employeeRole) => employeeRole.role.name
    );

    const permissions = await getEmployeeEffectivePermissions(user.id);

    const superadmin = user.employee.roles.some(
      ({ role }) => role.name === "superadmin" && role.siteId === null
    );

    const site = user.employee.siteId
      ? await prisma.site.findUnique({
          where: { id: user.employee.siteId },
          select: { id: true, name: true },
        })
      : null;

    return {
      id: user.id,
      email: user.email,
      accountType: "employee" as const,
      roles: roleNames,
      permissions,
      isSuperadmin: superadmin,
      employee: {
        id: user.employee.id,
        name: user.employee.name,
        siteId: user.employee.siteId,
        siteName: site?.name ?? "GLOBAL",
        site,
        roles: roleNames,
        permissions,
      },
    };
  }

  if (user.resident) {
    const resident = user.resident;

    return {
      id: user.id,
      email: user.email,
      accountType: "resident" as const,
      roles: [] as string[],
      permissions: [] as string[],
      isSuperadmin: false,
      resident: {
        id: resident.id,
        fullName: resident.fullName,
        siteId: resident.siteId,
        siteName: resident.site?.name ?? null,
      },
    };
  }

  return null;
}


export async function login(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { email, password, rememberMe = false } = req.body;

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      password.length === 0
    ) {
      res.status(400).json({
        message: "Email and password are required",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        employee: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
        resident: {
          include: {
            site: true,
          },
        },
      },
    });

    if (!user) {
      await auditActor(req, null, {
        action: "login_failed",
        resource: "auth",
        description: "Failed login attempt",
        after: { email: normalizedEmail },
      });

      res.status(401).json({
        message: "Invalid email or password",
      });
      return;
    }

    const passwordValid = await argon2.verify(
      user.password,
      password
    );

    if (!passwordValid) {
      await auditActor(
        req,
        {
          userId: user.id,
          name:
            user.employee?.name ??
            user.resident?.fullName ??
            null,
        },
        {
          action: "login_failed",
          resource: "auth",
          resourceId: user.id,
          description: `Failed login attempt for ${user.email}`,
        }
      );

      res.status(401).json({
        message: "Invalid email or password",
      });
      return;
    }

    if (!user.isActive) {
      await auditActor(
        req,
        {
          userId: user.id,
          name:
            user.employee?.name ??
            user.resident?.fullName ??
            null,
        },
        {
          action: "login_failed",
          resource: "auth",
          resourceId: user.id,
          description: `Login blocked: inactive account ${user.email}`,
        }
      );

      res.status(403).json({
        message: "Your account is inactive. Please contact the administrator.",
      });
      return;
    }

    if (user.employee && user.resident) {
      console.error(
        `Account ${user.id} has both employee and resident profiles`
      );

      res.status(403).json({
        message: "Account configuration error. Please contact the administrator.",
      });
      return;
    }

    if (!user.employee && !user.resident) {
      await auditActor(
        req,
        { userId: user.id, name: null },
        {
          action: "login_failed",
          resource: "auth",
          resourceId: user.id,
          description: `Login blocked: no employee or resident profile for ${user.email}`,
        }
      );

      res.status(403).json({
        message: "Account profile not found",
      });
      return;
    }

    const actorName =
      user.employee?.name ??
      user.resident?.fullName ??
      null;

    const authUser = await buildAuthUser(user.id);

    if (!authUser) {
      res.status(403).json({
        message: "Account profile not found",
      });
      return;
    }

    const accountType = authUser.accountType;
    const redirectTo =
      accountType === "resident" ? "/resident/history" : "/dashboard";

    const token = generateAccessToken(
      user.id,
      Boolean(rememberMe)
    );

    const cookieOptions: CookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    };

    if (rememberMe === true) {
      cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
    }

    res.cookie("access_token", token, cookieOptions);

    await auditActor(
      req,
      { userId: user.id, name: actorName },
      {
        action: "login",
        resource: "auth",
        resourceId: user.id,
        description: `${accountType} ${user.email} logged in`,
      }
    );

    res.status(200).json({
      message: "Login successful",
      user: {
        ...authUser,
        accountType,
      },
      redirectTo,
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function logout(
  req: Request,
  res: Response
): Promise<void> {
  const token = req.cookies?.access_token as string | undefined;
  let auditUserId: string | null = null;
  let auditName: string | null = null;

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      auditUserId = payload.userId;
      const who = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: {
          employee: { select: { name: true } },
          resident: { select: { fullName: true } },
        },
      });
      auditName =
        who?.employee?.name ??
        who?.resident?.fullName ??
        null;
      (req as Request & { userId?: string }).userId = payload.userId;
    } catch {
     
    }
  }

  res.clearCookie("access_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  await auditActor(req, auditUserId ? { userId: auditUserId, name: auditName } : null, {
    action: "logout",
    resource: "auth",
    resourceId: auditUserId,
    description: auditUserId ? "User logged out" : "Anonymous logout",
  });

  res.status(200).json({
    message: "Logout successful",
  });
}

export async function me(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const token = req.cookies.access_token;

    if (!token) {
      res.status(401).json({
        message: "Not authenticated",
      });
      return;
    }

    const payload = verifyAccessToken(token);

    const authUser = await buildAuthUser(payload.userId);

    if (!authUser) {
      res.status(401).json({
        message: "User not found",
      });
      return;
    }

    res.json({
      user: authUser,
    });
  } catch {
    res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}
