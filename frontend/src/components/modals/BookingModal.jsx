import { useState } from "react";

const BOOKING_STATUSES = [
  "IN_REQUEST",
  "CONFIRMED",
  "IN_HOUSE",
  "CHECKED_OUT",
];

export default function BookingModal({
  room,
  startedAt,
  endedAt,
  onClose,
  onSubmit,
}) {
  /*
   * A room passed in comes from a calendar cell
   * and must stay fixed. Without one, the room
   * is typed by the user instead.
   */
  const isRoomLocked = Boolean(room);

  const [selectedRoom, setSelectedRoom] =
    useState(room ?? "");

  const [guestName, setGuestName] =
    useState("");

  const [status, setStatus] =
    useState("IN_REQUEST");

  const [start, setStart] =
    useState(startedAt ?? "");

  const [end, setEnd] =
    useState(endedAt ?? "");

  const [notes, setNotes] =
    useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    onSubmit({
      room: selectedRoom,
      guestName,
      status,
      started_at: start,
      ended_at: end,
      notes,
    });

    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={onClose}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="New Booking"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="modal__header">

          <h2
            className="modal__title"
          >
            New Booking
          </h2>

          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <i
              className="bi bi-x-lg"
              aria-hidden="true"
            />
          </button>

        </div>

        <form
          className="modal__form"
          onSubmit={handleSubmit}
        >
          <label className="form-field">
            <span>Room</span>

            <input
              type="text"
              value={selectedRoom}
              onChange={(event) =>
                setSelectedRoom(event.target.value)
              }
              placeholder="Room number"
              readOnly={isRoomLocked}
              required
            />
          </label>

          <label className="form-field">
            <span>Resident Name</span>

            <input
              type="text"
              value={guestName}
              onChange={(event) =>
                setGuestName(event.target.value)
              }
              placeholder="Guest name"
              required
            />
          </label>

           <label className="form-field">
            <span>Status</span>

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              required
            >
              {BOOKING_STATUSES.map(
                (option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {option}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="form-field">
            <span>Start Date</span>

            <input
              type="date"
              value={start}
              onChange={(event) =>
                setStart(event.target.value)
              }
              required
            />
          </label>

          <label className="form-field">
            <span>End Date</span>

            <input
              type="date"
              value={end}
              onChange={(event) =>
                setEnd(event.target.value)
              }
              required
            />
          </label>

           <label className="form-field">
            <span>Notes</span>

            <textarea
              rows="3"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="add notes (optional)"
            />
          </label>

          <div className="modal__actions">

            <button
              type="button"
              className="btn btn-neutral"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary"
            >
              Create Booking
            </button>

          </div>

        </form>
      </div>
    </div>
  );
}