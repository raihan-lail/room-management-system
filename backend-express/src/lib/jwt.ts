import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

const SECRET: string = JWT_SECRET;
export interface JwtPayload {
  userId: string;
}

export function generateAccessToken(
  userId: string,
  rememberMe: boolean
): string {
  return jwt.sign(
    {
      userId,
    },
    SECRET,
    {
      expiresIn: rememberMe ? "30d" : "1h",
    }
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, SECRET);

  if (
    typeof decoded === "string" ||
    !("userId" in decoded) ||
    typeof decoded.userId !== "string"
  ) {
    throw new Error("Invalid JWT payload");
  }

  return {
    userId: decoded.userId,
  };
}