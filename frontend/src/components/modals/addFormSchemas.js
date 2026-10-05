

const SITES = ["Donggi", "Site 2"];

const COUNTRIES = [
  "Indonesia",
  "Singapore",
  "Malaysia",
  "Japan",
  "France",
  "Australia",
  "United States",
  "Canada",
  "United Kingdom",
];

const DEPARTMENTS = [
  "Engineering",
  "Operations",
  "Finance",
  "HR",
  "HSE",
  "Logistics",
  "Admin",
  "IT",
  "Maintenance",
];

const MEAL_TYPES = ["indonesian", "asian", "western", "vegetarian"];

const GENDERS = ["Male", "Female"];

const ROLE_NAMES = ["Receptionist", "Reporting & Analytics", "Frontdesk Officer"];

const TIMEZONES = ["WITA", "WIB"];

const CAMP_LOCATIONS = ["EAST-CAMP", "WEST-CAMP", "NORTH-CAMP", "SOUTH-CAMP"];

const ROOM_LOCATIONS = ["EAST WING", "WEST WING", "NORTH WING"];

const ROOM_STATUSES = ["VACANT", "BOOKED", "OCCUPIED", "HOME_LEAVE", "ALLOCATED"];

const BOOKING_STATUSES = ["IN_HOUSE", "IN_REQUEST", "CONFIRMED", "CHECKED_OUT", "ARCHIVED"];

const YES_NO = ["No", "Yes"];

const ALLOCATION_TYPES = ["storage", "meeting room", "emergency kitchen"];

let localHomeLeaveId = 100;

export const addFormSchemas = {
  resident: {
    title: "Add Resident",
    submitLabel: "Add Resident",
    fields: [
      { name: "name", label: "Name", type: "text", placeholder: "Full name", required: true },
      { name: "email", label: "Email", type: "email", placeholder: "Email address", required: true },
      { name: "phone", label: "Phone", type: "tel", placeholder: "Phone number", required: true },
      { name: "gender", label: "Gender", type: "select", options: GENDERS },
      { name: "country", label: "Country", type: "select", options: COUNTRIES },
      { name: "site", label: "Site", type: "select", options: SITES },
      { name: "dept", label: "Dept", type: "select", options: DEPARTMENTS },
      { name: "meal_type", label: "Meal Type", type: "select", options: MEAL_TYPES },
    ],
  },

  employee: {
    title: "Add Employee",
    submitLabel: "Add Employee",
    fields: [
      { name: "name", label: "Name", type: "text", placeholder: "Full name", required: true },
      { name: "Email", label: "Email", type: "email", placeholder: "Email address", required: true },
      { name: "Phone", label: "Phone", type: "tel", placeholder: "Phone number", required: true },
      { name: "Role", label: "Role", type: "select", options: ROLE_NAMES },
      { name: "Site", label: "Site", type: "select", options: SITES },
    ],
  },

  role: {
    title: "Add Role",
    submitLabel: "Add Role",
    fields: [
      { name: "name", label: "Name", type: "text", placeholder: "Role name", required: true },
      { name: "site", label: "Site", type: "select", options: SITES },
    ],
  },

  site: {
    title: "Add Site",
    submitLabel: "Add Site",
    fields: [
      { name: "name", label: "Site Name", type: "text", placeholder: "Site name", required: true },
      { name: "camp", label: "Camp Location", type: "select", options: CAMP_LOCATIONS },
      { name: "timezone", label: "Timezone", type: "select", options: TIMEZONES },
    ],
    /*
     * A site row is nested, so the flat form values
     * are reshaped before they reach the table.
     */
    buildRow: ({ name, camp, timezone }) => ({
      name,
      locations: [{ title: camp }],
      room_status: ROOM_STATUSES.map((title) => ({ title })),
      booking_status: BOOKING_STATUSES.map((title) => ({ title })),
      timezone,
    }),
  },

  room: {
    title: "Add Room",
    submitLabel: "Add Room",
    fields: [
      { name: "name", label: "Room Number", type: "text", placeholder: "e.g. 101", required: true },
      { name: "desc", label: "Description", type: "text", placeholder: "e.g. room" },
      { name: "location", label: "Location", type: "select", options: ROOM_LOCATIONS },
      { name: "status", label: "Status", type: "select", options: ROOM_STATUSES },
      { name: "cleaning_status", label: "Cleaning Status", type: "select", options: YES_NO },
    ],
  },

  homeLeave: {
    title: "Add Home Leave",
    submitLabel: "Add Home Leave",
    fields: [
      { name: "name", label: "Resident Name", type: "text", placeholder: "Full name", required: true },
      { name: "started_at", label: "Started At", type: "date", required: true },
      { name: "ended_at", label: "Ended At", type: "date", required: true },
      { name: "reason", label: "Reason", type: "textarea", placeholder: "Reason (optional)" },
      { name: "approved_by", label: "Approved By", type: "text", placeholder: "Approver name" },
    ],
    
    buildRow: (values) => ({
      ...values,
      booking_id: `SD${String(localHomeLeaveId++).padStart(5, "0")}`,
    }),
  },

  roomAllocation: {
    title: "Add Allocation",
    submitLabel: "Add Allocation",
    fields: [
      { name: "name", label: "Room Number", type: "text", placeholder: "e.g. 105", required: true },
      { name: "type", label: "Allocation Type", type: "select", options: ALLOCATION_TYPES },
      { name: "started_at", label: "Started At", type: "date", required: true },
      { name: "ended_at", label: "Ended At", type: "date", required: true },
      { name: "reason", label: "Allocation Reason", type: "textarea", placeholder: "Reason (optional)" },
      { name: "allocated_by", label: "Allocated By", type: "text", placeholder: "Allocated by" },
    ],
  },
};

export function buildRow(schema, values) {
  return schema.buildRow ? schema.buildRow(values) : { ...values };
}
