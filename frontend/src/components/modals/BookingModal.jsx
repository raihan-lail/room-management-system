import { useState } from "react";
import { rooms } from "../../data/room";
import { guests } from "../../data/guest";
import { addFormSchemas, toFormValues } from "./addFormSchemas";
import { ModalField } from "./AddModal";
import useAuth from "../../contexts/useAuth";

const BOOKING_STATUSES = [
  "IN_REQUEST",
  "CONFIRMED",
  "IN_HOUSE",
  "CHECKED_OUT",
];

const RESIDENT_FIELDS = addFormSchemas.resident.fields;

const BOOKING_FIELDS = [
  {
    name: "status",
    label: "Status",
    type: "select",
    options: BOOKING_STATUSES,
    defaultValue: "IN_REQUEST",
  },
  { name: "started_at", label: "Start Date", type: "date", required: true },
  { name: "ended_at", label: "End Date", type: "date", required: true },
  {
    name: "notes",
    label: "Notes",
    type: "textarea",
    placeholder: "add notes (optional)",
  },
];

const PASSWORD_FIELD = (isEdit) => ({
  name: "password",
  label: "Password",
  type: "password",
  required: !isEdit,
  placeholder: isEdit
    ? "Leave blank to keep current password"
    : "Minimum 8 characters",
});

function buildValues(fields, initialValues) {
  return fields.reduce((values, field) => {
    const provided = initialValues?.[field.name];

    if (provided !== undefined) {
      values[field.name] = provided;

      return values;
    }

    if (field.defaultValue !== undefined) {
      values[field.name] = field.defaultValue;

      return values;
    }

    if (field.type === "select") {
      const [first] = field.options ?? [];

      values[field.name] =
        (first && typeof first === "object" ? first.value : first) ?? "";

      return values;
    }

    values[field.name] = "";

    return values;
  }, {});
}

/*
 * Booking forms always come in two sections: first
 * the resident data, then the booking itself. The
 * resident section offers a new resident form or an
 * existing resident picker, but only users with the
 * resident.manage permission may create a new one.
 */
export default function BookingModal({
  mode = "create",
  room,
  startedAt,
  endedAt,
  initialValues,
  onClose,
  onSubmit,
}) {
  const { hasPermission } = useAuth();

  const isEdit = mode === "edit";
  const canManageResidents = hasPermission("resident.manage");

  /*
   * A room passed in comes from a calendar cell
   * and must stay fixed. Without one, the room
   * is selected by the user instead.
   */
  const isRoomLocked = Boolean(room);

  const seed = {
    ...(initialValues
      ? toFormValues(addFormSchemas.booking, initialValues)
      : {}),
    ...(startedAt ? { started_at: startedAt } : {}),
    ...(endedAt ? { ended_at: endedAt } : {}),
  };

  const sectionOneFields = [...RESIDENT_FIELDS];

  sectionOneFields.splice(3, 0, PASSWORD_FIELD(isEdit));

  const [residentMode, setResidentMode] = useState(
    canManageResidents ? "new" : "existing",
  );
  const [residentName, setResidentName] = useState("");
  const [selectedRoom, setSelectedRoom] = useState(
    room ?? seed?.room ?? "",
  );
  const [values, setValues] = useState(() =>
    buildValues([...sectionOneFields, ...BOOKING_FIELDS], seed),
  );

  const selectedGuest = guests.find((guest) => guest.name === residentName);

  const roomOptions = rooms
    .map((r) => ({
      value: r.name,
      label: `${r.name} - ${r.location} (${r.status})`,
    }))
    .concat(
      selectedRoom && !rooms.some((r) => r.name === selectedRoom)
        ? [{ value: selectedRoom, label: selectedRoom }]
        : [],
    );

  const handleChange = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const resident =
      residentMode === "existing" ? selectedGuest : values;

    onSubmit({
      room: selectedRoom,
      status: values.status,
      started_at: values.started_at,
      ended_at: values.ended_at,
      notes: values.notes,
      resident_mode: residentMode,
      guest_name:
        residentMode === "existing" ? residentName : values.name,
      gender: resident?.gender ?? "",
      country: resident?.country ?? "",
      site: resident?.site ?? "",
      dept: resident?.dept ?? "",
      meal_type: resident?.meal_type ?? "",
      email: resident?.email ?? "",
      phone: resident?.phone ?? "",
      ...(residentMode === "new" && values.password
        ? { password: values.password }
        : {}),
    });

    onClose();
  };

  const title = isEdit ? "Edit Booking" : "Add Booking";
  const submitLabel = isEdit ? "Save Changes" : "Add Booking";

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>

          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <form className="modal__form" onSubmit={handleSubmit}>
          {/* Section 1: Resident Data */}
          <section className="modal__section">
            <h3 className="modal__section-title">1. Resident Data</h3>

            {canManageResidents && (
              <div className="modal__options">
                <button
                  type="button"
                  className={`modal__option${
                    residentMode === "new" ? " is-active" : ""
                  }`}
                  onClick={() => setResidentMode("new")}
                >
                  Fill new resident
                </button>

                <button
                  type="button"
                  className={`modal__option${
                    residentMode === "existing" ? " is-active" : ""
                  }`}
                  onClick={() => setResidentMode("existing")}
                >
                  Select existing resident
                </button>
              </div>
            )}

            {residentMode === "existing" ? (
              <>
                <label className="form-field">
                  <span>Resident</span>

                  <select
                    value={residentName}
                    onChange={(event) =>
                      setResidentName(event.target.value)
                    }
                    required
                  >
                    <option value="" disabled>
                      Select a resident
                    </option>
                    {guests.map((guest) => (
                      <option key={guest.email || guest.name} value={guest.name}>
                        {guest.name} ({guest.dept ?? "No Dept"})
                      </option>
                    ))}
                  </select>
                </label>

                {selectedGuest && (
                  <div className="modal__grid">
                    {RESIDENT_FIELDS.map((field) => (
                      <ModalField
                        key={field.name}
                        field={{
                          ...field,
                          type: "text",
                          required: false,
                          readOnly: true,
                        }}
                        value={selectedGuest[field.name] ?? ""}
                        onChange={() => {}}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="modal__grid">
                  {sectionOneFields.map((field) => (
                    <ModalField
                      key={field.name}
                      field={field}
                      value={values[field.name] ?? ""}
                      onChange={handleChange}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Section 2: Booking Data */}
          <section className="modal__section">
            <h3 className="modal__section-title">2. Booking Data</h3>

            <div className="modal__grid">
              {isRoomLocked ? (
                <label className="form-field">
                  <span>Room</span>

                  <input
                    type="text"
                    value={selectedRoom}
                    readOnly
                    disabled
                  />
                </label>
              ) : (
                <ModalField
                  field={{
                    name: "room",
                    label: "Room",
                    type: "select",
                    options: roomOptions,
                    required: true,
                  }}
                  value={selectedRoom}
                  onChange={(name, value) => setSelectedRoom(value)}
                />
              )}

              {BOOKING_FIELDS.filter(
                (field) => field.name !== "notes",
              ).map((field) => (
                <ModalField
                  key={field.name}
                  field={field}
                  value={values[field.name] ?? ""}
                  onChange={handleChange}
                />
              ))}
            </div>

            <ModalField
              field={BOOKING_FIELDS.find((field) => field.name === "notes")}
              value={values.notes ?? ""}
              onChange={handleChange}
            />
          </section>

          {/* Actions */}
          <div className="modal__actions">
            <button
              type="button"
              className="btn btn-neutral"
              onClick={onClose}
            >
              Cancel
            </button>

            <button type="submit" className="btn btn-primary">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
