import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import { rooms } from "../../data/room";
import bookings from "../../data/bookings";

export default function RoomBookingDetails() {
  const navigate = useNavigate();
  const { roomName } = useParams();

  const room = rooms.find((r) => r.name === roomName) ?? rooms[0];
  const booking =
    bookings.find((b) => b.room === room.name) ?? bookings[0];

  const details = [
    { label: "Guest Name", value: booking.guest?.name || "-" },
    { label: "Gender", value: booking.guest?.gender || "-" },
    { label: "Country", value: booking.guest?.country || "-" },
    { label: "Department", value: booking.guest?.dept || "-" },
    { label: "Meal Type", value: booking.guest?.meal_type || "-" },
    { label: "Check-in", value: booking.started_at || "-" },
    { label: "Check-out", value: booking.ended_at || "-" },
    {
      label: "Booking Status",
      value: booking.status || "-",
      isStatus: true,
    },
    { label: "Notes", value: booking.notes || "-" },
  ];

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">
              Room Booking Details
            </h1>

            <p className="dashboard-header__subtitle">
              View booking information for this room
            </p>
          </div>

          <button
            type="button"
            className="btn btn-neutral"
            onClick={() => navigate("/rooms/management")}
          >
            <i className="bi bi-arrow-left" aria-hidden="true" />
            Back to Rooms
          </button>
        </div>

        {/* ROOM SUMMARY */}
        <section className="room-summary">
          <div className="room-summary__text">
            <p className="room-summary__label">Room</p>
            <h2 className="room-summary__name">{room.name || "-"}</h2>
            <p className="room-summary__location">
              <i className="bi bi-geo-alt" aria-hidden="true" />
              {room.location || "-"}
            </p>
          </div>

          <span
            className={`room-status room-status--${room.status?.toLowerCase()}`}
          >
            {room.status || "-"}
          </span>
        </section>

        {/* BOOKING DETAILS */}
        <section className="table-card content">
          <div className="detail-card__head">
            <h2 className="detail-card__title">Booking Details</h2>
            <p className="detail-card__caption">
              Static sample data, will be dynamic later
            </p>
          </div>

          <div className="detail-grid">
            {details.map((detail) => (
              <div className="detail-grid__item" key={detail.label}>
                <p className="detail-grid__label">{detail.label}</p>

                {detail.isStatus ? (
                  <span
                    className={`booking-status booking-status--${detail.value?.toLowerCase()}`}
                  >
                    {detail.value}
                  </span>
                ) : (
                  <p className="detail-grid__value">{detail.value}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </MainLayout>
  );
}