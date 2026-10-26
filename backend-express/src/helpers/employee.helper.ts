export const employeeSelect = {
  id: true,
  name: true,
  userId: true,
  siteId: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      createdAt: true,
    },
  },
  site: true,
  roles: {
    select: {
      role: {
        select: {
          id: true,
          name: true,
          description: true,
          siteId: true,
        },
      },
    },
  },
} as const;
