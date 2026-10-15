import type { Request, Response, CookieOptions } from "express";
import argon2 from "argon2";

import { prisma } from "../lib/prisma.js";
import { generateAccessToken } from "../lib/jwt.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { getEmployeeEffectivePermissions } from "../lib/permission.js";

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
    },
  });

  if (!user || !user.employee) {
    return null;
  }

  const roleNames = user.employee.roles.map(
    (employeeRole) => employeeRole.role.name
  );

  const permissions = await getEmployeeEffectivePermissions(user.id);

  const superadmin = user.employee.roles.some(
    ({ role }) => role.name === "superadmin" && role.siteId === null
  );

  return {
    id: user.id,
    email: user.email,
    roles: roleNames,
    permissions,
    isSuperadmin: superadmin,
    employee: {
      id: user.employee.id,
      name: user.employee.name,
      siteId: user.employee.siteId,
      roles: roleNames,
      permissions,
    },
  };
}


export async function login(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      email,
      password,
      rememberMe = false,
    } = req.body;

    if (!email || !password) {
      res.status(400).json({
        message: "Email and password are required",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
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
      },
    });

    if (!user) {
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
      res.status(401).json({
        message: "Invalid email or password",
      });
      return;
    }

    if (!user.employee) {
      res.status(403).json({
        message: "Employee account not found",
      });
      return;
    }

    const token = generateAccessToken(
      user.id,
      rememberMe
    );

    const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

if (rememberMe) {
  cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
}

res.cookie("access_token", token, cookieOptions);

    const authUser = await buildAuthUser(user.id);

    if (!authUser) {
      res.status(403).json({
        message: "Employee account not found",
      });
      return;
    }

    res.status(200).json({
      message: "Login successful",
      user: authUser,
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
}

export function logout(
  _req: Request,
  res: Response
): void {
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
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
