type ImportRow = {
  siteName: string;
  locationName: string;
  floorNumber: number;
  roomName: string;
  description: string | null;
  row: string | null;
  isBookable: boolean;
  numberOfBeds: number;
  bedNames: string[];
  excelRow: number;
};

type RowError = {
  row: number;
  roomName?: string;
  message: string;
};

export type {ImportRow, RowError}