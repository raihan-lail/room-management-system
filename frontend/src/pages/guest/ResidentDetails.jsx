import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import apiRequest from "../../api/client";

const DAY_IN_MS = 86400000;

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

const getNights = (startedAt, endedAt) => {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return "-";

  return Math.max(1, Math.round((end - start) / DAY_IN_MS));
};

const getRoomName = (booking) => {
  const room = booking.bed?.room?.name;
  const bed = booking.bed?.name;

  if (room && bed) return `${room} · ${bed}`;
  return room || bed || "-";
};

const getLocation = (booking) => {
  const location = booking.bed?.room?.floor?.location;
  const site = location?.site;

  return (
    [site?.name, location?.name, booking.bed?.room?.floor?.name]
      .filter(Boolean)
      .join(" · ") || "-"
  );
};

export default function ResidentDetails() {
  const navigate = useNavigate();
  const { residentId } = useParams();

  const [resident, setResident] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingError, setBookingError] = useState("");

  const loadResidentDetails = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setBookingError("");

    try {
      const [residentResult, bookingsResult] = await Promise.allSettled([
        apiRequest(`/api/resident/${residentId}`),
        apiRequest(
          `/api/booking?residentId=${encodeURIComponent(residentId)}&page=1&limit=100`,
        ),
      ]);

      if (residentResult.status === "rejected") {
        throw residentResult.reason;
      }

      setResident(residentResult.value?.resident ?? null);

      if (bookingsResult.status === "fulfilled") {
        setBookings(
          Array.isArray(bookingsResult.value?.data)
            ? bookingsResult.value.data
            : [],
        );
        setTotalBookings(Number(bookingsResult.value?.pagination?.total ?? 0));
      } else {
        setBookings([]);
        setTotalBookings(0);
        setBookingError(
          bookingsResult.reason?.message || "Failed to load booking history.",
        );
      }
    } catch (err) {
      setError(err.message || "Failed to load resident details.");
      setResident(null);
      setBookings([]);
      setTotalBookings(0);
    } finally {
      setIsLoading(false);
    }
  }, [residentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadResidentDetails();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadResidentDetails]);

  const details = resident
    ? [
        { label: "Email", value: resident.user?.email },
        { label: "Phone", value: resident.phone },
        {
          label: "Gender",
          value: GENDER_LABELS[resident.gender] || resident.gender,
        },
        { label: "Nationality", value: resident.nationality },
        {
          label: "Meal Type",
          value: MEAL_TYPE_LABELS[resident.mealType] || resident.mealType,
        },
        { label: "Company", value: resident.company },
        { label: "Department", value: resident.department },
        { label: "Title", value: resident.title },
        { label: "Site", value: resident.site?.name },
        { label: "Registered", value: formatDate(resident.createdAt) },
      ]
    : [];

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Resident Details</h1>

            <p className="dashboard-header__subtitle">
              View the resident profile and booking history
            </p>
          </div>

          <button
            type="button"
            className="btn btn-neutral"
            onClick={() => navigate("/guests/management")}
          >
            <i className="bi bi-arrow-left" aria-hidden="true" />
            Back to Residents
          </button>
        </div>

        {isLoading && (
          <section className="table-card content">
            <p className="table-empty">Loading resident details...</p>
          </section>
        )}

        {!isLoading && error && (
          <section className="table-card content">
            <p role="alert">{error}</p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={loadResidentDetails}
            >
              Try Again
            </button>
          </section>
        )}

        {!isLoading && !error && !resident && (
          <section className="table-card content">
            <p className="table-empty">Resident not found.</p>
          </section>
        )}

        {!isLoading && !error && resident && (
          <>
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
                  <dt>Site</dt>
                  <dd>{resident.site?.name || "-"}</dd>
                </div>

                <div className="resident-profile__item">
                  <dt>Account Status</dt>
                  <dd>{resident.user?.isActive ? "Active" : "Inactive"}</dd>
                </div>
              </dl>
            </section>

            <section className="table-card content">
              <div className="detail-card__head">
                <h2 className="detail-card__title">Resident Information</h2>
              </div>

              <div className="detail-grid">
                {details.map((detail) => (
                  <div className="detail-grid__item" key={detail.label}>
                    <p className="detail-grid__label">{detail.label}</p>
                    <p className="detail-grid__value">{detail.value || "-"}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="table-card content">
              <div className="detail-card__head">
                <h2 className="detail-card__title">Booking History</h2>
                <p className="detail-card__caption">
                  {totalBookings} booking{totalBookings === 1 ? "" : "s"}
                </p>
              </div>

              {bookingError ? (
                <p role="alert">{bookingError}</p>
              ) : bookings.length === 0 ? (
                <p className="table-empty">No bookings found.</p>
              ) : (
                <div className="history-list">
                  {bookings.map((booking) => (
                    <article className="history-card" key={booking.id}>
                      <div className="history-card__head">
                        <div className="history-card__text">
                          <p className="history-card__label">Room</p>

                          <h3 className="history-card__name">
                            {getRoomName(booking)}
                          </h3>

                          <p className="history-card__location">
                            <i className="bi bi-geo-alt" aria-hidden="true" />
                            {getLocation(booking)}

                            <span className="history-card__divider-dot" />

                            Booking {booking.bookingNumber || booking.id}
                          </p>
                        </div>

                        <span
                          className={`booking-status booking-status--${booking.status?.toLowerCase()}`}
                        >
                          {String(booking.status || "UNKNOWN").replace(
                            /_/g,
                            " ",
                          )}
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
                              {formatDate(booking.createdAt)}
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
                    </article>
                  ))}
                </div>
              )}

              {!bookingError && totalBookings > bookings.length && (
                <p className="muted">
                  Showing the first {bookings.length} of {totalBookings}{" "}
                  bookings.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
}
