type EmployeeInput = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  siteId?: string | null;
  userId?: string;
  roleIds?: string[];
};

export type {EmployeeInput};