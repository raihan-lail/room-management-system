type FloorInput = {
  name: string;
  floorNumber: number;
  description?: string | null;
  isActive?: boolean;
};

type LocationInput = {
  siteId?: string;
  name?: string;
  description?: string | null;
  floors?: FloorInput[];
};

export type { FloorInput, LocationInput };