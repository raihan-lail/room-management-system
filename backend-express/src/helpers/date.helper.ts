export function formatTimestamp(value: Date | null | undefined): string {
  if (!value) return "";

  const pad = (part: number) => String(part).padStart(2, "0");

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function formatTimestapWithoutHours(value: Date | null | undefined): string {
  if (!value) return "";

  const pad = (part: number) => String(part).padStart(2, "0");

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} `;

}
