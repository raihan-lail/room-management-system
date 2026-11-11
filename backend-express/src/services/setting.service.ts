import { prisma } from "../lib/prisma.js";

export const EMAIL_ENABLED_KEY = "email_enabled";

export async function getBooleanSetting(
  key: string,
  defaultValue: boolean
): Promise<boolean> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  });

  if (!setting) return defaultValue;

  return setting.value === "true";
}

export async function setBooleanSetting(
  key: string,
  value: boolean
): Promise<boolean> {
  const setting = await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
    select: { value: true },
  });

  return setting.value === "true";
}

export function isEmailEnabled(): Promise<boolean> {
  return getBooleanSetting(EMAIL_ENABLED_KEY, true);
}
