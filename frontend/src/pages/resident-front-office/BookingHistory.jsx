
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import apiRequest from "../../api/client";

const DAY_IN_MS = 86400000;

const getNights = (startedAt, endedAt) => {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return "-";

  return Math.max(1, Math.round((end - start) / DAY_IN_MS));
};

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getResponseData = (response) => {
  // Supports either a direct JSON response or an Axios-like wrapper.
  return response?.data ?? response;
};

const getBookingRows = (response) => {
  const result = getResponseData(response);

  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;

  return [];
};

const getStatusClass = (status) =>
  String(status || "unknown")
    .toLowerCase()
    .replace(/_/g, "-");

const getLocation = (booking) => {
  const location = booking.bed?.room?.floor?.location;
  const site = location?.site;

  return [site?.name, location?.name, booking.bed?.room?.floor?.name]
    .filter(Boolean)
    .join(" · ") || "-";
};

const getRoomName = (booking) => {
  const room = booking.bed?.room?.name;
  const bed = booking.bed?.name;

  if (room && bed) return `${room} · ${bed}`;
  return room || bed || "-";
};

export default function BookingHistory() {
  const navigate = useNavigate();

  const [resident, setResident] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBookingHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [profileResponse, bookingsResponse] = await Promise.all([
        apiRequest("/api/resident-portal/me"),
        apiRequest("/api/resident-portal/bookings?page=1&limit=100"),
      ]);

      const profileResult = getResponseData(profileResponse);
      const profile = profileResult?.data ?? profileResult;

      setResident(profile);
      setBookings(getBookingRows(bookingsResponse));
    } catch (err) {
      console.error("Failed to load resident booking history:", err);
      setError(
        err?.message || "Failed to load your booking history. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  const timer = window.setTimeout(() => {
    loadBookingHistory();
  }, 0);

  return () => window.clearTimeout(timer);
}, [loadBookingHistory]);

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">
              Booking History
            </h1>

            <p className="dashboard-header__subtitle">
              All your room bookings, from the earliest to the latest
            </p>
          </div>
          <button type="button" className="btn btn-neutral" onClick={() => navigate("/resident/complaints")}>
            <i className="bi bi-chat-dots" aria-hidden="true" /> My Complaints
          </button>
        </div>

        {/* RESIDENT PROFILE */}
        {resident && (
          <section className="resident-profile">
            <div className="resident-profile__avatar">
              {(resident.fullName || "R").charAt(0).toUpperCase()}
            </div>

            <div className="resident-profile__text">
              <p className="resident-profile__label">Resident</p>

              <h2 className="resident-profile__name">
                {resident.fullName || "-"}
              </h2>
            </div>

            <dl className="resident-profile__meta">
              <div className="resident-profile__item">
                <dt>Resident ID</dt>
                <dd>{resident.id || "-"}</dd>
              </div>

              <div className="resident-profile__item">
                <dt>Department</dt>
                <dd>{resident.department || "-"}</dd>
              </div>

              <div className="resident-profile__item">
                <dt>Gender</dt>
                <dd>{resident.gender || "-"}</dd>
              </div>

              <div className="resident-profile__item">
                <dt>Country</dt>
                <dd>{resident.nationality || "-"}</dd>
              </div>

              <div className="resident-profile__item">
                <dt>Phone</dt>
                <dd>{resident.phone || "-"}</dd>
              </div>

              <div className="resident-profile__item">
                <dt>Email</dt>
                <dd>{resident.user?.email || "-"}</dd>
               
              </div>
            </dl>
          </section>
        )}

        {/* LOADING */}
        {loading && (
          <section className="table-card content">
            <p className="table-empty">Loading your booking history...</p>
          </section>
        )}

        {/* ERROR */}
        {!loading && error && (
          <section className="table-card content">
            <p role="alert">{error}</p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={loadBookingHistory}
            >
              Try Again
            </button>
          </section>
        )}

        {/* BOOKING CARDS */}
        {!loading && !error && (
          <div className="history-list">
            {bookings.length === 0 ? (
              <section className="table-card content">
                <p className="table-empty">No bookings found.</p>
              </section>
            ) : (
              bookings.map((booking) => (
                <article
                  className="history-card"
                  key={booking.id}
                >
                  <div className="history-card__head">
                    <div className="history-card__text">
                      <p className="history-card__label">Room</p>

                      <h2 className="history-card__name">
                        {getRoomName(booking)}
                      </h2>

                      <p className="history-card__location">
                        <i
                          className="bi bi-geo-alt"
                          aria-hidden="true"
                        />
                        {getLocation(booking)}

                        <span className="history-card__divider-dot" />

                        Booking {booking.bookingNumber || booking.id}
                      </p>
                    </div>

                    <span
                      className={`booking-status booking-status--${getStatusClass(
                        booking.status
                      )}`}
                    >
                      {String(booking.status || "UNKNOWN").replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="history-card__group">
                    <p className="history-card__group-label">
                      Booking Details
                    </p>

                    <div className="detail-grid">
                      <div className="detail-grid__item">
                        <p className="detail-grid__label">Booked On</p>
                        <p className="detail-grid__value">
                          {formatDate(booking.booked_at)}
                        </p>
                      </div>

                      <div className="detail-grid__item">
                        <p className="detail-grid__label">Check-in</p>
                        <p className="detail-grid__value">
                          {formatDate(booking.startedAt)}
                        </p>
                      </div>

                      <div className="detail-grid__item">
                        <p className="detail-grid__label">Check-out</p>
                        <p className="detail-grid__value">
                          {formatDate(booking.endedAt)}
                        </p>
                      </div>

                      <div className="detail-grid__item">
                        <p className="detail-grid__label">Nights</p>
                        <p className="detail-grid__value">
                          {getNights(booking.startedAt, booking.endedAt)}
                        </p>
                      </div>

                      <div className="detail-grid__item">
                        <p className="detail-grid__label">Meal Type</p>
                        <p className="detail-grid__value">
                          {resident?.mealType || "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {booking.notes && (
                    <div className="history-card__notes">
                      <p className="history-card__group-label">Notes</p>

                      <p className="history-card__notes-text">
                        {booking.notes}
                      </p>
                    </div>
                  )}

                  <div className="history-card__actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() =>
                        navigate(`/resident/rating/${booking.id}`)
                      }
                    >
                      <i className="bi bi-star" aria-hidden="true" />
                      Rate Your Experience
                    </button>

                    <button
                      type="button"
                      className="btn btn-neutral"
                      onClick={() =>
                        navigate(`/resident/bookings/${booking.id}/complaints`)
                      }
                    >
                      <i
                        className="bi bi-chat-dots"
                        aria-hidden="true"
                      />
                      Complaint
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
