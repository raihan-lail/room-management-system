import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_LENGTH = 12;

/**
 * Reversible storage for passwords that a global superadmin is allowed to
 * reveal from Employee Management. Passwords are still stored as argon2
 * hashes for login; this encrypted copy exists only so the superadmin can
 * view and edit the current credential.
 */
function getKey(): Buffer {
  const secret =
    process.env.PASSWORD_ENCRYPTION_KEY || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "PASSWORD_ENCRYPTION_KEY or JWT_SECRET must be set to store passwords",
    );
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptPassword(password: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptPassword(value: string | null | undefined): string | null {
  if (!value) return null;

  const [version, ivValue, tagValue, encryptedValue] = value.split(":");

  if (
    version !== VERSION ||
    !ivValue ||
    !tagValue ||
    !encryptedValue
  ) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(ivValue, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    console.error("Failed to decrypt stored password:", error);
    return null;
  }
}
