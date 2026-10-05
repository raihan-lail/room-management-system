import { useNavigate } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import {
  currentResident,
  residentBookings,
} from "../../data/residentBookings";

const DAY_IN_MS = 86400000;

const getNights = (startedAt, endedAt) => {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return "-";

  return Math.max(
    1,
    Math.round((end - start) / DAY_IN_MS)
  );
};

export default function BookingHistory() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">
              Booking History
            </h1>

            <p className="dashboard-header__subtitle">
              All your room bookings, from the
              earliest to the latest
            </p>
          </div>

         
        </div>

        {/* RESIDENT PROFILE */}
        <section className="resident-profile">
          <div className="resident-profile__avatar">
            {currentResident.name.charAt(0)}
          </div>

          <div className="resident-profile__text">
            <p className="resident-profile__label">
              Resident
            </p>

            <h2 className="resident-profile__name">
              {currentResident.name}
            </h2>
          </div>

          <dl className="resident-profile__meta">
            <div className="resident-profile__item">
              <dt>Resident ID</dt>
              <dd>{currentResident.resident_id}</dd>
            </div>

            <div className="resident-profile__item">
              <dt>Department</dt>
              <dd>{currentResident.dept}</dd>
            </div>

            <div className="resident-profile__item">
              <dt>Gender</dt>
              <dd>{currentResident.gender}</dd>
            </div>

            <div className="resident-profile__item">
              <dt>Country</dt>
              <dd>{currentResident.country}</dd>
            </div>

            <div className="resident-profile__item">
              <dt>Phone</dt>
              <dd>{currentResident.phone}</dd>
            </div>

            <div className="resident-profile__item">
              <dt>Email</dt>
              <dd>{currentResident.email}</dd>
            </div>
          </dl>
        </section>

        {/* BOOKING CARDS */}
        <div className="history-list">
          {residentBookings.length === 0 ? (
            <section className="table-card content">
              <p className="table-empty">
                No bookings found.
              </p>
            </section>
          ) : (
            residentBookings.map((booking) => (
              <article
                className="history-card"
                key={booking.booking_id}
              >
                {/* ROOM + STATUS */}
                <div className="history-card__head">
                  <div className="history-card__text">
                    <p className="history-card__label">
                      Room
                    </p>

                    <h2 className="history-card__name">
                      {booking.room}
                    </h2>

                    <p className="history-card__location">
                      <i
                        className="bi bi-geo-alt"
                        aria-hidden="true"
                      />
                      {booking.location}

                      <span className="history-card__divider-dot" />

                      Booking {booking.booking_id}
                    </p>
                  </div>

                  <span
                    className={`booking-status booking-status--${booking.status.toLowerCase()}`}
                  >
                    {booking.status}
                  </span>
                </div>

                {/* BOOKING DETAILS */}
                <div className="history-card__group">
                  <p className="history-card__group-label">
                    Booking Details
                  </p>

                  <div className="detail-grid">
                    <div className="detail-grid__item">
                      <p className="detail-grid__label">
                        Booked On
                      </p>
                      <p className="detail-grid__value">
                        {booking.booked_at || "-"}
                      </p>
                    </div>

                    <div className="detail-grid__item">
                      <p className="detail-grid__label">
                        Check-in
                      </p>
                      <p className="detail-grid__value">
                        {booking.started_at || "-"}
                      </p>
                    </div>

                    <div className="detail-grid__item">
                      <p className="detail-grid__label">
                        Check-out
                      </p>
                      <p className="detail-grid__value">
                        {booking.ended_at || "-"}
                      </p>
                    </div>

                    <div className="detail-grid__item">
                      <p className="detail-grid__label">
                        Nights
                      </p>
                      <p className="detail-grid__value">
                        {getNights(
                          booking.started_at,
                          booking.ended_at
                        )}
                      </p>
                    </div>

                    <div className="detail-grid__item">
                      <p className="detail-grid__label">
                        Meal Type
                      </p>
                      <p className="detail-grid__value">
                        {booking.meal_type || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {booking.notes && (
                  <div className="history-card__notes">
                    <p className="history-card__group-label">
                      Notes
                    </p>

                    <p className="history-card__notes-text">
                      {booking.notes}
                    </p>
                  </div>
                )}

                {/* ACTIONS */}
                <div className="history-card__actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      navigate(
                        `/resident/rating/${booking.booking_id}`
                      )
                    }
                  >
                    <i
                      className="bi bi-star"
                      aria-hidden="true"
                    />
                    Rate Your Experience
                  </button>

                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() =>
                      navigate(
                        `/resident/complaints/${booking.booking_id}`
                      )
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
      </div>
    </MainLayout>
  );
}
