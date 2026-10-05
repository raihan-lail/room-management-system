/*
 * One place for every add and edit form in the app.
 * Each entry only describes the fields, so any table
 * can reuse AddModal without a dedicated modal file.
 */

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

const BOOKING_STATUSES = ["IN_REQUEST", "CONFIRMED", "IN_HOUSE", "CHECKED_OUT"];

const BOOKING_MEAL_TYPES = [
  "Full Board",
  "Half Board",
  "Breakfast",
  "Japanese",
  "Middle East",
];

const ALLOCATION_TYPES = ["storage", "meeting room", "emergency kitchen"];

const YES_NO = ["No", "Yes"];

const toTitles = (values) => values.map((title) => ({ title }));

const emptyGuest = {
  gender: "",
  country: "",
  dept: "",
  meal_type: "",
};

let localHomeLeaveId = 100;

export const addFormSchemas = {
  resident: {
    entity: "Resident",
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
    entity: "Employee",
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
    entity: "Role",
    title: "Add Role",
    submitLabel: "Add Role",
    fields: [
      { name: "name", label: "Name", type: "text", placeholder: "Role name", required: true },
      { name: "site", label: "Site", type: "select", options: SITES },
    ],
  },

  site: {
    entity: "Site",
    title: "Add Site",
    submitLabel: "Add Site",
    fields: [
      { name: "name", label: "Site Name", type: "text", placeholder: "Site name", required: true },
      { name: "camp", label: "Camp Location", type: "select", options: CAMP_LOCATIONS },
      { name: "timezone", label: "Timezone", type: "select", options: TIMEZONES },
    ],
    /*
     * A site row is nested, so the flat form values
     * are reshaped before they reach the table, and
     * the first camp location is flattened back out
     * when the row is edited. The form edits one camp
     * location, so any further ones are kept as they
     * are instead of being dropped.
     */
    toFormValues: (row) => ({
      name: row.name ?? "",
      camp: row.locations?.[0]?.title ?? "",
      timezone: row.timezone ?? "",
    }),
    buildRow: ({ name, camp, timezone }, existing) => ({
      ...existing,
      name,
      locations: existing?.locations?.length
        ? existing.locations.map((location, index) =>
            index === 0 ? { title: camp } : location,
          )
        : [{ title: camp }],
      room_status: existing?.room_status ?? toTitles(ROOM_STATUSES),
      booking_status: existing?.booking_status ?? toTitles(BOOKING_STATUSES),
      timezone,
    }),
  },

  room: {
    entity: "Room",
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
    entity: "Home Leave",
    title: "Add Home Leave",
    submitLabel: "Add Home Leave",
    fields: [
      { name: "name", label: "Resident Name", type: "text", placeholder: "Full name", required: true },
      { name: "started_at", label: "Started At", type: "date", required: true },
      { name: "ended_at", label: "Ended At", type: "date", required: true },
      { name: "reason", label: "Reason", type: "textarea", placeholder: "Reason (optional)" },
      { name: "approved_by", label: "Approved By", type: "text", placeholder: "Approver name" },
    ],
    /*
     * Home leave rows are keyed by booking id, which the
     * backend assigns later, so a local id is generated
     * to keep the row addressable while it is being created.
     * Editing keeps the id it already has.
     */
    buildRow: (values, existing) => ({
      ...values,
      booking_id:
        existing?.booking_id ?? `SD${String(localHomeLeaveId++).padStart(5, "0")}`,
    }),
  },

  roomAllocation: {
    entity: "Allocation",
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

  booking: {
    entity: "Booking",
    title: "Add Booking",
    submitLabel: "Add Booking",
    fields: [
      { name: "room", label: "Room", type: "text", placeholder: "Room number", required: true },
      { name: "guest_name", label: "Resident Name", type: "text", placeholder: "Guest name", required: true },
      { name: "gender", label: "Gender", type: "select", options: GENDERS },
      { name: "country", label: "Country", type: "select", options: COUNTRIES },
      { name: "dept", label: "Dept", type: "select", options: DEPARTMENTS },
      { name: "meal_type", label: "Meal Type", type: "select", options: BOOKING_MEAL_TYPES },
      { name: "status", label: "Status", type: "select", options: BOOKING_STATUSES },
      { name: "started_at", label: "Start Date", type: "date", required: true },
      { name: "ended_at", label: "End Date", type: "date", required: true },
      { name: "notes", label: "Notes", type: "textarea", placeholder: "add notes (optional)" },
    ],
    /*
     * Guest details live in a nested object, so the
     * flat form values are folded back into it. Fields
     * the form does not show, such as the booking id
     * and the booking date, are kept untouched.
     */
    toFormValues: ({ room, guest, status, started_at, ended_at, notes }) => ({
      room: room ?? "",
      guest_name: guest?.name ?? "",
      gender: guest?.gender ?? "",
      country: guest?.country ?? "",
      dept: guest?.dept ?? "",
      meal_type: guest?.meal_type ?? "",
      status: status ?? "",
      started_at: started_at ?? "",
      ended_at: ended_at ?? "",
      notes: notes ?? "",
    }),
    buildRow: ({ room, guest_name, gender, country, dept, meal_type, status, started_at, ended_at, notes }, existing) => ({
      id: existing?.id ?? Date.now(),
      booked_at:
        existing?.booked_at ??
        new Date().toISOString().slice(0, 10),
      room,
      guest: { ...emptyGuest, ...existing?.guest, name: guest_name, gender, country, dept, meal_type },
      started_at,
      ended_at,
      status,
      notes,
    }),
  },
};

export function buildRow(schema, values, existing) {
  /*
   * Fields the form does not show, such as an id from
   * the backend, survive an edit because the existing
   * row is merged first.
   */
  return schema.buildRow ? schema.buildRow(values, existing) : { ...existing, ...values };
}

export function toFormValues(schema, row) {
  return schema.toFormValues ? schema.toFormValues(row) : row;
}
