export const sidebarMenu = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: "bi-speedometer2",
    
  },
  {
    label: "Frontdesk",
    path: "/frontdesk",
    icon: "bi-credit-card-2-front",
    
  },
  {
    label: "Bookings",
    path: "/bookings",
    icon: "bi-calendar-check",
     items: [
      { label: 'Calendar View', path: '/bookings/calendar', icon: 'bi-calendar-date' },
     
       { label: 'Table View', path: '/bookings/table', icon: 'bi-table' },
       { label: 'Complaints', path: '/bookings/complains', icon: 'bi-chat-dots' },
        { label: 'Ratings', path: '/bookings/ratings', icon: 'bi-star' },
    ],
  },
  {
    label: "Rooms",
    path: "/rooms",
    icon: "bi-door-open",
     items: [
      { label: 'Room Management', path: '/rooms/management', icon: 'bi-door-open' },
      { label: 'Room Allocations', path: '/rooms/allocation', icon: 'bi-house' },
       { label: 'Map View', path: '/rooms/map', icon: 'bi-geo-alt' },
    ],
  },
  {
    label: "Residents",
    path: "/guests/management",
    icon: "bi-people",
     items: [
      { label: 'Residents Management', path: '/guests/management', icon: 'bi-door-open' },
      { label: 'Meal Type', path: '/guests/meal-type', icon: 'bi-fork-knife' },
      
       
    ],
  },
  {
    label: "Settings",
    path: "/settings",
    icon: "bi-gear",
    items: [
      { label: 'Site Management', path: '/sites', icon: 'bi-door-open' },
      { label: 'Employee Management', path: '/employees', icon: 'bi-person' },
       { label: 'Role Management', path: '/roles', icon: 'bi-universal-access' },
       { label: 'Manage Permissions', path: '/manage-permissions', icon: 'bi-house' },
        { label: 'Audit Logs', path: '/audit-logs', icon: 'bi-clock-history' },
    ],
  },
  {
    label: "Resident's front office",
    path: "/residents",
    icon: "bi-building",
     items: [
      { label: 'Booking History', path: '/resident/history', icon: 'bi-clock-history' },
     
       { label: 'Change Password', path: '/change-password', icon: ' bi-pencil' },
      
    ],
  },
];