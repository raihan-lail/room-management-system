export const sidebarMenu = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: "bi-speedometer2",
    permission: "dashboard"
    
  },
  {
    label: "Frontdesk",
    path: "/frontdesk",
    icon: "bi-credit-card-2-front",
    permission: "frontdesk"
    
  },
  {
    label: "Bookings",
    path: "/bookings",
    icon: "bi-calendar-check",
     items: [
      { label: 'Calendar View', path: '/bookings/calendar', icon: 'bi-calendar-date', permission: "bookings.calendar" },
     
       { label: 'Table View', path: '/bookings/table', icon: 'bi-table', permission:"bookings.read" },
       { label: 'Home Leaves', path: '/bookings/home-leave', icon: 'bi-house-door', permission:"home.leaves" },
       { label: 'Complaints', path: '/bookings/complains', icon: 'bi-chat-dots', permission: "complaints" },
        { label: 'Ratings', path: '/bookings/ratings', icon: 'bi-star', permission: "ratings" },
    ],
  },
  {
    label: "Rooms",
    path: "/rooms",
    icon: "bi-door-open",
     items: [
      { label: 'Locations and Floors', path: '/rooms/locations', icon: 'bi-crosshair', permission: "location.view" },
      { label: 'Room Management', path: '/rooms/management', icon: 'bi-door-open', permission: "rooms.view" },
      { label: 'Room Allocations', path: '/rooms/allocation', icon: 'bi-house', permission: "rooms.allocations" },
       { label: 'Map View', path: '/rooms/map', icon: 'bi-geo-alt', permission:"rooms.map" },
    ],
  },
  {
    label: "Residents",
    path: "/guests/management",
    icon: "bi-people",
     items: [
      { label: 'Residents Management', path: '/guests/management', icon: 'bi-person', permission: "resident.view" },
      { label: 'Meal Type', path: '/guests/meal-type', icon: 'bi-fork-knife', permission: "meal-type.read" },
      
       
    ],
  },
  {
    label: "Settings",
    path: "/settings",
    icon: "bi-gear",
    items: [
      { label: 'Site Management', path: '/sites', icon: 'bi-door-open', permission: "site.view" },
      { label: 'Employee Management', path: '/employees', icon: 'bi-person', permission: "employees.view" },
       { label: 'Role Management', path: '/roles', icon: 'bi-universal-access', permission:"roles.view" },
       { label: 'Manage Permissions', path: '/manage-permissions', icon: 'bi-house', permission: "permissions.view" },
        { label: 'Audit Logs', path: '/audit-logs', icon: 'bi-clock-history', permission: "audit.logs" },
         { label: 'Email Logs', path: '/email-logs', icon: 'bi-envelope', permission: "mail.logs" },
      { label: 'Change Password', path: '/change-password', icon: 'bi-pencil' },
    ],
  },
];

export const residentMenu = [
  {
    label: "Resident's front office",
    path: "/resident",
    icon: "bi-building",
    items: [
      { label: 'Booking History', path: '/resident/history', icon: 'bi-clock-history' },
      { label: 'My Complaints', path: '/resident/complaints', icon: 'bi-chat-dots' },
      { label: 'Change Password', path: '/change-password', icon: 'bi-pencil' },
    ],
  },
];
