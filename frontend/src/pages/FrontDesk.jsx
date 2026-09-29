import { useMemo, useState } from "react";
import MainLayout from "../components/MainLayout";
import bookings from "../data/bookings";


const PAGE_SIZE = 10;

const SEGMENTS = [
  { id: "arrival", label: "Arrival", icon: "bi-box-arrow-in-down", title: "Arrival Schedule" },
  { id: "in_house", label: "In House", icon: "bi-house-door", title: "Current In House" },
  { id: "departure", label: "Departure", icon: "bi-box-arrow-right", title: "Departure Schedule" },
];

const todayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const getTodayKey = () => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
};

const normalizeStatus = (status) =>
  (status || "").toLowerCase().replace(/[\s-]+/g, "_");

const isSameDay = (value, today) => Boolean(value) && value === today;

const isWithinStay = (startedAt, endedAt, today) =>
  Boolean(startedAt) &&
  Boolean(endedAt) &&
  startedAt <= today &&
  today <= endedAt;

const matchesSegment = (booking, segment, today) => {
  const startedAt = booking.started_at;
  const endedAt = booking.ended_at;

  if (segment === "arrival") {
    return isSameDay(startedAt, today);
  }

  if (segment === "departure") {
    return isSameDay(endedAt, today);
  }

  return (
    normalizeStatus(booking.status) === "in_house" ||
    isWithinStay(startedAt, endedAt, today)
  );
};

export default function FrontDesk() {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("arrival");
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const today = useMemo(() => getTodayKey(), []);
  const todayLabel = useMemo(() => todayFormatter.format(new Date()), []);

  const handleSegmentChange = (nextSegment) => {
    setSegment(nextSegment);
    setCurrentPage(1);
  };

  const segmentCounts = useMemo(() => {
    return SEGMENTS.reduce((counts, item) => {
      counts[item.id] = bookings.filter((booking) =>
        matchesSegment(booking, item.id, today),
      ).length;

      return counts;
    }, {});
  }, [today]);

  const segmentBookings = useMemo(() => {
    return bookings.filter((booking) => matchesSegment(booking, segment, today));
  }, [segment, today]);

  const activeSegment = SEGMENTS.find((item) => item.id === segment);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

    setCurrentPage(1);
  };

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return segmentBookings;

    return segmentBookings.filter((booking) =>
      [
        booking.room,
        booking.guest?.name,
        booking.guest?.gender,
        booking.guest?.country,
        booking.guest?.dept,
        booking.guest?.meal_type,
        booking.status,
        booking.notes,
      ].some((value) => (value || "").toString().toLowerCase().includes(query)),
    );
  }, [search, segmentBookings]);

  const sortedBookings = useMemo(() => {
    if (!sortConfig.key) return filteredBookings;

    return [...filteredBookings].sort((a, b) => {
      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "room":
          aValue = a.room;
          bValue = b.room;
          break;

        case "guest":
          aValue = a.guest?.name;
          bValue = b.guest?.name;
          break;

        case "gender":
          aValue = a.guest?.gender;
          bValue = b.guest?.gender;
          break;

        case "country":
          aValue = a.guest?.country;
          bValue = b.guest?.country;
          break;

        case "dept":
          aValue = a.guest?.dept;
          bValue = b.guest?.dept;
          break;

        case "meal_type":
          aValue = a.guest?.meal_type;
          bValue = b.guest?.meal_type;
          break;

        case "started_at":
          aValue = a.started_at;
          bValue = b.started_at;
          break;

        case "ended_at":
          aValue = a.ended_at;
          bValue = b.ended_at;
          break;

        case "status":
          aValue = a.status;
          bValue = b.status;
          break;

        case "notes":
          aValue = a.notes;
          bValue = b.notes;
          break;

        default:
          return 0;
      }

      aValue = (aValue ?? "").toString().toLowerCase();
      bValue = (bValue ?? "").toString().toLowerCase();

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }

      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }

      return 0;
    });
  }, [filteredBookings, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedBookings.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const pagedBookings = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return sortedBookings.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedBookings, safePage]);

  const startRow =
    filteredBookings.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(safePage * PAGE_SIZE, filteredBookings.length);

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  return (
    <MainLayout>
      <div className="dashboard">
        {/* HEADER */}
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">  {activeSegment?.title || "Arrival Schedule"}</h1>

           

            <div className="frontdesk-filters">
              <span className="frontdesk-today">
               
                {todayLabel}
              </span>

              <div
                className="frontdesk-segments"
                role="tablist"
                aria-label="Booking segment"
              >
                {SEGMENTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={segment === item.id}
                    className={`frontdesk-segment ${segment === item.id ? "is-active" : ""}`}
                    onClick={() => handleSegmentChange(item.id)}
                  >
                    
                    {item.label}
                    <span className="frontdesk-segment__count">
                      {segmentCounts[item.id]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search bookings"
              placeholder="Search by room, guest, country, status..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

        
        </div>

        {/* TABLE CARD */}
        <section className="table-card content">
          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th className="table-col-no">No</th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("room")}
                    >
                      Room
                      <i className="bi bi-sort-alpha-down" column="room">
                        {" "}
                      </i>
                    </button>
                  </th>

                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("guest")}
                    >
                      Guest
                      <i className="bi bi-sort-alpha-down" column="guest">
                        {" "}
                      </i>
                    </button>
                  </th>

                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("gender")}
                    >
                      Gender
                      <i className="bi bi-sort-alpha-down" column="gender"></i>
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("country")}
                    >
                      Country
                      <i className="bi bi-sort-alpha-down" column="country"></i>
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("department")}
                    >
                      Department
                      <i
                        className="bi bi-sort-alpha-down"
                        column="department"
                      ></i>
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("meal_type")}
                    >
                      Meal Type
                      <i
                        className="bi bi-sort-alpha-down"
                        column="meal_type"
                      ></i>
                    </button>
                  </th>
                  <th>Booked At</th>
                  <th>Started At</th>
                  <th>Ended At</th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("status")}
                    >
                      Status
                      <i className="bi bi-sort-alpha-down" column="status"></i>
                    </button>
                  </th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {pagedBookings.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="muted">
                      No {activeSegment.label.toLowerCase()} bookings found.
                    </td>
                  </tr>
                ) : (
                  pagedBookings.map((booking, index) => (
                    <tr key={`${booking.room}-${booking.started_at}-${index}`}>
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      <td>
                        <strong>{booking.room || "-"}</strong>
                      </td>

                      <td>{booking.guest?.name || "-"}</td>

                      <td>{booking.guest?.gender || "-"}</td>

                      <td>{booking.guest?.country || "-"}</td>

                      <td>{booking.guest?.dept || "-"}</td>

                      <td>{booking.guest?.meal_type || "-"}</td>
                        <td>{booking.booked_at || "-"}</td>

                      <td>{booking.started_at || "-"}</td>

                      <td>{booking.ended_at || "-"}</td>

                      <td>
                        <span
                          className={`booking-status booking-status--${booking.status?.toLowerCase()}`}
                        >
                          {booking.status || "-"}
                        </span>
                      </td>

                      <td>{booking.notes || "-"}</td>

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-neutral"
                            title={`View booking for ${booking.guest?.name || "guest"}`}
                            onClick={() =>
                              console.log("View booking:", booking)
                            }
                          >
                            <i className="bi bi-eye" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            className="btn btn-neutral"
                            title={`Edit booking for ${booking.guest?.name || "guest"}`}
                            onClick={() =>
                              console.log("Edit booking:", booking)
                            }
                          >
                            <i
                              className="bi bi-pencil-square"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="office-pagination">
            <span className="office-page-info">
              Showing {startRow}–{endRow} of {filteredBookings.length}{" "}
              {activeSegment.label.toLowerCase()} bookings
            </span>

            <div className="office-page-nav">
              <button
                type="button"
                className="btn btn-neutral"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                <i className="bi bi-chevron-left" aria-hidden="true" />
                Prev
              </button>

              <span className="office-page-info">
                Page {safePage} of {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-neutral"
                disabled={safePage >= totalPages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                Next
                <i className="bi bi-chevron-right" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
