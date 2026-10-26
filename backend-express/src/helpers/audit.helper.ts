export function singleParam(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function listParam(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : [value];
  const list = raw
    .flatMap((entry) =>
      typeof entry === "string" ? entry.split(",") : []
    )
    .map((entry) => entry.trim())
    .filter(Boolean);
  return list.length > 0 ? [...new Set(list)] : undefined;
}
