type ImportResidentRow = {
   fullName: string;
  email: string;
  password: string;
  phone: string;
  siteName: string;
  gender: string;
  nationality: string;
  mealType: string;
  company: string;
  department: string;
  title: string;
}

type ResidentRowError = {
      row: number;

    fullName: string;
    message: string;
}

export type { ImportResidentRow, ResidentRowError}