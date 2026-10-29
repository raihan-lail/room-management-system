import type { Request, Response, CookieOptions } from "express";
import argon2 from "argon2";

import { prisma } from "../lib/prisma.js";
import { generateAccessToken } from "../lib/jwt.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { auditActor } from "../services/audit.service.js";
import { buildAuthUser } from "../helpers/auth.helper.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";



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

export async function changePassword(
  req: AuthRequest,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({
      message: "Authentication required.",
    });
    return;
  }

  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    res.status(400).json({
      message: "All password fields are required.",
    });
    return;
  }

  if (newPassword !== confirmPassword) {
    res.status(400).json({
      message: "New password confirmation does not match.",
    });
    return;
  }

  if (newPassword.length < 12 || Buffer.byteLength(newPassword, "utf8") > 1024) {
    res.status(400).json({
      message: "Password must be at least 8 characters and within the allowed length.",
    });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({
      message: "New password must differ from the current password.",
    });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        password: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      res.status(403).json({
        message: "Active account required.",
      });
      return;
    }

    const isCurrentPasswordValid = await argon2.verify(
      user.password,
      currentPassword
    );

    if (!isCurrentPasswordValid) {
      res.status(400).json({
        message: "Current password is incorrect.",
      });
      return;
    }

    const hashedPassword = await argon2.hash(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.status(200).json({
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      message: "Failed to change password.",
    });
  }
}
