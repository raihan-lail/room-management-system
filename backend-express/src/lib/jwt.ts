import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
const SECRET: string = JWT_SECRET;

export interface JwtPayload {
  userId: string;
}

export function generateAccessToken(userId: string): string {
  return jwt.sign(
    {
      userId,
    },
    SECRET,
    {
      expiresIn: "1h",
    }
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}