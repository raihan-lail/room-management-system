export const chartColors = {
  primary: "#273896",
  primaryMid: "rgba(39, 56, 150, 0.65)",
  primarySoft: "rgba(39, 56, 150, 0.35)",
  primaryFade: "rgba(39, 56, 150, 0.12)",
  brandSoft: "#e7ebff",
  danger: "#ec242c",
  dangerFade: "rgba(236, 36, 44, 0.14)",
  muted: "#64748b",
  dark: "#111827",
  border: "#e2e8f0",
};

export const kpiStats = [
  {
    id: "total-rooms",
    label: "Total Rooms",
    value: "624",
    icon: "bi-door-open",
    trend: "6 rooms added this month",
    isUp: true,
  },
  {
    id: "bookings-today",
    label: "Bookings Today",
    value: "38",
    icon: "bi-calendar-check",
    trend: "12% vs yesterday",
    isUp: true,
  },
  {
    id: "occupancy-rate",
    label: "Occupancy Rate",
    value: "76%",
    icon: "bi-graph-up-arrow",
    trend: "5% vs last week",
    isUp: true,
  },
  {
    id: "revenue-today",
    label: "Today's Check in/Check Out",
    value: "122/58",
    icon: "bi-door-open",
    trend: "3% vs yesterday",
    isUp: false,
  },
];

export const bookingTrendChartData = {
  labels: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  datasets: [
    {
      label: "Occupied Rooms",
      data: [120, 145, 138, 172, 190, 210, 245, 232, 205, 228, 256, 274],
      borderColor: chartColors.primary,
      backgroundColor: chartColors.primaryFade,
      fill: true,
      tension: 0.35,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: chartColors.primary,
    },
    {
      label: "Allocated Rooms",
      data: [18, 22, 15, 25, 20, 17, 24, 19, 23, 16, 21, 14],
      borderColor: chartColors.danger,
      backgroundColor: "transparent",
      fill: false,
      tension: 0.35,
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: chartColors.danger,
    },
  ],
};

export const roomTypeChartData = {
  labels: ["Booked", "Occupied", "Home Leave", "Vacant", "Allocated"],
  datasets: [
    {
      label: "Bookings",
      data: [420, 515, 286, 234, 168],
      backgroundColor: [
        chartColors.primary,
        chartColors.primaryMid,
        chartColors.primarySoft,
        chartColors.brandSoft,
        chartColors.muted,
      ],
      borderRadius: 5,
      maxBarThickness: 46,
    },
  ],
};

export const bookingStatusChartData = {
  labels: ["Occupied", "Booked", "Completed", "Pending", "Cancelled"],
  datasets: [
    {
      label: "Bookings",
      data: [148, 62, 96, 41, 27],
      backgroundColor: [
        chartColors.primary,
        chartColors.primaryMid,
        chartColors.brandSoft,
        chartColors.muted,
        chartColors.danger,
      ],
      borderColor: "#ffffff",
      borderWidth: 2,
      hoverOffset: 6,
    },
  ],
};

export const roomDemandChartData = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  datasets: [
    {
      label: "Standard Rooms",
      data: [62, 68, 74, 71, 80, 45, 38],
      borderColor: chartColors.primary,
      backgroundColor: chartColors.primaryFade,
      pointBackgroundColor: chartColors.primary,
      pointBorderColor: "#ffffff",
      pointRadius: 3,
      borderWidth: 2,
    },
    {
      label: "Suites",
      data: [30, 34, 42, 38, 52, 60, 48],
      borderColor: chartColors.danger,
      backgroundColor: chartColors.dangerFade,
      pointBackgroundColor: chartColors.danger,
      pointBorderColor: "#ffffff",
      pointRadius: 3,
      borderWidth: 2,
    },
  ],
};
