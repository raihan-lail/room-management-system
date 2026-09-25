import { useState } from "react";

export default function BookingModal({
  room,
  startedAt,
  endedAt,
  onClose,
  onSubmit,
}) {
  const [guestName, setGuestName] =
    useState("");

  const [start, setStart] =
    useState(startedAt);

  const [end, setEnd] =
    useState(endedAt);

  const handleSubmit = (event) => {
    event.preventDefault();

    onSubmit({
      room,
      guestName,
      started_at: start,
      ended_at: end,
    });

    onClose();
  };

  return (
    <div
      className="booking-modal-overlay"
      onMouseDown={onClose}
    >
      <div
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="booking-modal__header">

          <h2
            className="booking-modal__title"
            id="booking-modal-title"
          >
            New Booking
          </h2>

          <button
            type="button"
            className="booking-modal__close"
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
          className="booking-modal__form"
          onSubmit={handleSubmit}
        >
          <label className="form-field">
            <span>Room</span>

            <input
              type="text"
              value={room}
              readOnly
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
              type="text"
              
              placeholder="select status"
              required
            />
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

            <input
              type="textArea"
              
              placeholder="add notes (optional)"
              
            />
          </label>

          <div className="booking-modal__actions">

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