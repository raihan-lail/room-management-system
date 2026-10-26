import type { FloorInput } from "../types/location.type.js";

export const LOCATION_ERROR_MESSAGES = {
  duplicate:
    "A location or floor with the same unique name or number already exists",
  notFound: "Record not found",
};

export function validFloorInput(floor: FloorInput): boolean {
  return (
    typeof floor.name === "string" &&
    floor.name.trim().length > 0 &&
    Number.isInteger(floor.floorNumber) &&
    (floor.description === undefined ||
      floor.description === null ||
      typeof floor.description === "string") &&
    (floor.isActive === undefined ||
      typeof floor.isActive === "boolean")
  );
}
