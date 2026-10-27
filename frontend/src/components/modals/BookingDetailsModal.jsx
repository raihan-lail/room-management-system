import { useEffect, useState } from "react";
import apiRequest from "../../api/client";

const GENDER_LABELS = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

const MEAL_TYPE_LABELS = {
  REGULAR: "Regular",
  VEGETARIAN: "Vegetarian",
  HALAL: "Halal",
  OTHER: "Other",
};

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toISOString().slice(0, 10);
}

function formatStatus(status) {
  if (!status) return "-";

  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function DetailItem({ label, value, isStatus }) {
  return (
    <div className="detail-grid__item">
      <p className="detail-grid__label">{label}</p>

      {isStatus ? (
        <span className={`booking-status booking-status--${value?.toLowerCase()}`}>
          {formatStatus(value)}
        </span>
      ) : (
        <p className="detail-grid__value">{value || "-"}</p>
      )}
    </div>
  );
}

export default function BookingDetailsModal({ bookingId, onClose }) {
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setError("");
      setBooking(null);

      try {
        const response = await apiRequest(`/api/booking/${bookingId}`);

        if (isActive) setBooking(response?.data ?? null);
      } catch (err) {
        if (isActive) setError(err.message || "Failed to load booking.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [bookingId]);

  const bookingFields = booking
    ? [
        { label: "Booking ID", value: booking.id },
        {
          label: "Status",
          value: booking.status,
          isStatus: true,
        },
        { label: "Room", value: booking.bed?.room?.name },
        { label: "Bed", value: booking.bed?.name },
        {
          label: "Location",
          value: booking.bed?.room?.floor?.location?.name,
        },
        { label: "Floor", value: booking.bed?.room?.floor?.name },
        { label: "Started At", value: formatDate(booking.startedAt) },
        { label: "Ended At", value: formatDate(booking.endedAt) },
        { label: "Booked At", value: formatDate(booking.createdAt) },
        { label: "Checked In At", value: formatDate(booking.checkedInAt) },
        { label: "Checked Out At", value: formatDate(booking.checkedOutAt) },
        { label: "Cancelled At", value: formatDate(booking.cancelledAt) },
        {
          label: "Cancellation Reason",
          value: booking.cancellationReason,
        },
        { label: "Notes", value: booking.notes },
      ]
    : [];

  const residentFields = booking
    ? [
        { label: "Full Name", value: booking.resident?.fullName },
        { label: "Email", value: booking.resident?.user?.email },
        { label: "Phone", value: booking.resident?.phone },
        {
          label: "Gender",
          value:
            GENDER_LABELS[booking.resident?.gender] ??
            booking.resident?.gender,
        },
        { label: "Nationality", value: booking.resident?.nationality },
        {
          label: "Meal Type",
          value:
            MEAL_TYPE_LABELS[booking.resident?.mealType] ??
            booking.resident?.mealType,
        },
        { label: "Company", value: booking.resident?.company },
        { label: "Department", value: booking.resident?.department },
        { label: "Title", value: booking.resident?.title },
        { label: "Site", value: booking.resident?.site?.name },
      ]
    : [];

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Booking Details"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2 className="modal__title">Booking Details</h2>

          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="modal__form">
          {isLoading && <p className="muted">Loading booking details...</p>}

          {!isLoading && error && <p className="error-text">{error}</p>}

          {!isLoading && !error && booking && (
            <>
              <section className="modal__section">
                <h3 className="modal__section-title">Booking</h3>

                <div className="detail-grid">
                  {bookingFields.map((field) => (
                    <DetailItem
                      key={field.label}
                      label={field.label}
                      value={field.value}
                      isStatus={field.isStatus}
                    />
                  ))}
                </div>
              </section>

              <section className="modal__section">
                <h3 className="modal__section-title">Resident</h3>

                <div className="detail-grid">
                  {residentFields.map((field) => (
                    <DetailItem
                      key={field.label}
                      label={field.label}
                      value={field.value}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

          <div className="modal__actions">
            <button type="button" className="btn btn-neutral" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
