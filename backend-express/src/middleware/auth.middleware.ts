
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { verifyAccessToken } from "../lib/jwt.js";

export interface AuthRequest extends Request {
  userId?: string;
  file?: Express.Multer.File;
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    
    const token = req.cookies?.access_token;

    if (!token) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }
    
    const payload = verifyAccessToken(token);
    
    req.userId = payload.userId;

    next();
  } catch {
    res.status(401).json({
      message: "Invalid or expired authentication token",
    });
  }
}
