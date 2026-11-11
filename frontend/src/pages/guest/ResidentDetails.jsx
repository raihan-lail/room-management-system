import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import apiRequest from "../../api/client";
import useAuth from "../../contexts/useAuth";

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

const HOME_LEAVE_STATUS_LABELS = {
  SCHEDULED: "Scheduled",
  ACTIVE: "Active",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

const HOME_LEAVE_STATUS_CLASSES = {
  SCHEDULED: "confirmed",
  ACTIVE: "in_house",
  RETURNED: "checked_out",
  CANCELLED: "checked_out",
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
  const room = booking?.bed?.room?.name;
  const bed = booking?.bed?.name;

  if (room && bed) return `${room} · ${bed}`;
  return room || bed || "-";
};

const getLocation = (booking) => {
  const location = booking?.bed?.room?.floor?.location;
  const site = location?.site;

  return (
    [site?.name, location?.name, booking?.bed?.room?.floor?.name]
      .filter(Boolean)
      .join(" · ") || "-"
  );
};

const formatStatus = (status) =>
  String(status || "UNKNOWN").replace(/_/g, " ");

export default function ResidentDetails() {
  const navigate = useNavigate();
  const { residentId } = useParams();
  const { hasPermission } = useAuth();

  const canViewHomeLeaves = hasPermission("home.leaves");

  const [resident, setResident] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [homeLeaves, setHomeLeaves] = useState([]);
  const [totalHomeLeaves, setTotalHomeLeaves] = useState(0);
  const [historyTab, setHistoryTab] = useState("bookings");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [homeLeaveError, setHomeLeaveError] = useState("");

  const loadResidentDetails = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setBookingError("");
    setHomeLeaveError("");

    try {
      const requests = [
        apiRequest(`/api/resident/${residentId}`),
        apiRequest(
          `/api/booking?residentId=${encodeURIComponent(residentId)}&page=1&limit=100`,
        ),
      ];

      if (canViewHomeLeaves) {
        requests.push(
          apiRequest(
            `/api/booking/home-leaves?residentId=${encodeURIComponent(residentId)}&page=1&limit=100`,
          ),
        );
      }

      const [residentResult, bookingsResult, homeLeavesResult] =
        await Promise.allSettled(requests);

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

      if (canViewHomeLeaves) {
        if (homeLeavesResult.status === "fulfilled") {
          setHomeLeaves(
            Array.isArray(homeLeavesResult.value?.data)
              ? homeLeavesResult.value.data
              : [],
          );
          setTotalHomeLeaves(
            Number(homeLeavesResult.value?.pagination?.total ?? 0),
          );
        } else {
          setHomeLeaves([]);
          setTotalHomeLeaves(0);
          setHomeLeaveError(
            homeLeavesResult.reason?.message ||
              "Failed to load home leave history.",
          );
        }
      } else {
        setHomeLeaves([]);
        setTotalHomeLeaves(0);
      }
    } catch (err) {
      setError(err.message || "Failed to load resident details.");
      setResident(null);
      setBookings([]);
      setTotalBookings(0);
      setHomeLeaves([]);
      setTotalHomeLeaves(0);
    } finally {
      setIsLoading(false);
    }
  }, [residentId, canViewHomeLeaves]);

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

  const activeHistoryTab = canViewHomeLeaves ? historyTab : "bookings";

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Resident Details</h1>

            <p className="dashboard-header__subtitle">
              View the resident profile, booking history, and home leave
              history
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
              <div className="detail-card__head detail-card__head--tabs">
                <div
                  className="detail-tabs"
                  role="tablist"
                  aria-label="Resident history"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeHistoryTab === "bookings"}
                    className={`detail-tab ${activeHistoryTab === "bookings" ? "is-active" : ""}`}
                    onClick={() => setHistoryTab("bookings")}
                  >
                    Booking History
                  </button>

                  {canViewHomeLeaves && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeHistoryTab === "home-leaves"}
                      className={`detail-tab ${activeHistoryTab === "home-leaves" ? "is-active" : ""}`}
                      onClick={() => setHistoryTab("home-leaves")}
                    >
                      Home Leave History
                    </button>
                  )}
                </div>

                <p className="detail-card__caption">
                  {activeHistoryTab === "bookings"
                    ? `${totalBookings} booking${totalBookings === 1 ? "" : "s"}`
                    : `${totalHomeLeaves} home leave${totalHomeLeaves === 1 ? "" : "s"}`}
                </p>
              </div>

              {activeHistoryTab === "bookings" ? (
                <>
                  {bookingError ? (
                    <p className="table-empty" role="alert">
                      {bookingError}
                    </p>
                  ) : (
                    <div className="office-table-wrapper">
                      <table className="office-table">
                        <thead>
                          <tr>
                            <th>Booking</th>
                            <th>Room</th>
                            <th>Location</th>
                            <th>Booked On</th>
                            <th>Check-in</th>
                            <th>Check-out</th>
                            <th>Nights</th>
                            <th>Status</th>
                            <th>Notes</th>
                          </tr>
                        </thead>

                        <tbody>
                          {bookings.length === 0 ? (
                            <tr>
                              <td className="muted" colSpan={9}>
                                No bookings found.
                              </td>
                            </tr>
                          ) : (
                            bookings.map((booking) => (
                              <tr key={booking.id}>
                                <td>
                                  <strong>
                                    {booking.bookingNumber || booking.id}
                                  </strong>
                                </td>
                                <td>{getRoomName(booking)}</td>
                                <td>{getLocation(booking)}</td>
                                <td>{formatDate(booking.createdAt)}</td>
                                <td>{formatDate(booking.startedAt)}</td>
                                <td>{formatDate(booking.endedAt)}</td>
                                <td>
                                  {getNights(
                                    booking.startedAt,
                                    booking.endedAt,
                                  )}
                                </td>
                                <td>
                                  <span
                                    className={`booking-status booking-status--${booking.status?.toLowerCase()}`}
                                  >
                                    {formatStatus(booking.status)}
                                  </span>
                                </td>
                                <td className="table-cell-note">
                                  {booking.notes || "-"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!bookingError && totalBookings > bookings.length && (
                    <p className="muted">
                      Showing the first {bookings.length} of {totalBookings}{" "}
                      bookings.
                    </p>
                  )}
                </>
              ) : homeLeaveError ? (
                <p className="table-empty" role="alert">
                  {homeLeaveError}
                </p>
              ) : (
                <>
                  <div className="office-table-wrapper">
                    <table className="office-table">
                      <thead>
                        <tr>
                          <th>Booking</th>
                          <th>Room</th>
                          <th>Leave At</th>
                          <th>Returned On</th>
                          <th>Status</th>
                          <th>Reason</th>
                        </tr>
                      </thead>

                      <tbody>
                        {homeLeaves.length === 0 ? (
                          <tr>
                            <td className="muted" colSpan={6}>
                              No home leaves found.
                            </td>
                          </tr>
                        ) : (
                          homeLeaves.map((homeLeave) => (
                            <tr key={homeLeave.id}>
                              <td>
                                <strong>
                                  {homeLeave.booking?.bookingNumber || "-"}
                                </strong>
                              </td>
                              <td>{getRoomName(homeLeave.booking)}</td>
                              <td>{formatDate(homeLeave.startedAt)}</td>
                              <td>{formatDate(homeLeave.returnedAt)}</td>
                              <td>
                                <span
                                  className={`booking-status booking-status--${HOME_LEAVE_STATUS_CLASSES[homeLeave.status] || "checked_out"}`}
                                >
                                  {HOME_LEAVE_STATUS_LABELS[homeLeave.status] ||
                                    formatStatus(homeLeave.status)}
                                </span>
                              </td>
                              <td className="table-cell-note">
                                {homeLeave.reason || "-"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {totalHomeLeaves > homeLeaves.length && (
                    <p className="muted">
                      Showing the first {homeLeaves.length} of {totalHomeLeaves}{" "}
                      home leaves.
                    </p>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
}
