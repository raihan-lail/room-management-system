import { useMemo, useState } from "react";
import MainLayout from "../components/MainLayout";
import TableRowActions from "../components/TableRowActions";
import AddModal from "../components/modals/AddModal";
import BookingModal from "../components/modals/BookingModal";
import ConfirmModal from "../components/modals/ConfirmModal";
import {
  addFormSchemas,
  buildRow,
} from "../components/modals/addFormSchemas";
import bookings from "../data/bookings";
import { homeLeaveData } from "../data/homeLeaves";


const PAGE_SIZE = 10;

const SEGMENTS = [
  { id: "arrival", label: "Arrival", icon: "bi-box-arrow-in-down", title: "Arrival Schedule" },
  { id: "in_house", label: "In House", icon: "bi-house-door", title: "Current In House" },
   { id: "home_leave", label: "Home Leave", icon: "bi-door-open", title: "Current Home Leave" },
   { id: "near_end", label: "Near End Date", icon: "bi-door-open", title: "Ended Soon" },
  { id: "departure", label: "Departure", icon: "bi-box-arrow-right", title: "Departure Schedule" },
];

const selectedDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
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

const parseDay = (dateStr) => {
  const [year, month, day] = (dateStr || "").split("-").map(Number);

  if (!year || !month || !day) return null;

  return Date.UTC(year, month - 1, day);
};

const getDaysLeft = (endedAt, today) => {
  const end = parseDay(endedAt);
  const current = parseDay(today);

  if (end === null || current === null) return null;

  return Math.round((end - current) / 86400000);
};

const formatDaysLeft = (endedAt, today) => {
  const days = getDaysLeft(endedAt, today);

  if (days === null) return "-";

  if (days === 0) return "Returns today";

  if (days < 0) {
    const overdue = Math.abs(days);

    return `Overdue ${overdue} ${overdue === 1 ? "day" : "days"}`;
  }

  return `${days} ${days === 1 ? "day" : "days"} left`;
};

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

  if (segment === "home_leave") {
    return isWithinStay(startedAt, endedAt, today);
  }

  return (
    normalizeStatus(booking.status) === "in_house" ||
    isWithinStay(startedAt, endedAt, today)
  );
};

/*
 * The home leave segment reads its own records
 * instead of the booking list.
 */
export default function FrontDesk() {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("arrival");
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });
  const [bookingList, setBookingList] = useState(bookings);
  const [homeLeaveList, setHomeLeaveList] = useState(homeLeaveData);
  const [editingRow, setEditingRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getTodayKey);

  const today = selectedDate;
  const isCurrentDate = selectedDate === getTodayKey();
  const selectedDateLabel = useMemo(
    () => selectedDateFormatter.format(new Date(`${selectedDate}T00:00:00`)),
    [selectedDate],
  );

  const handleDateChange = (value) => {
    if (!value) return;

    setSelectedDate(value);
    setCurrentPage(1);
  };

  const handleSegmentChange = (nextSegment) => {
    setSegment(nextSegment);
    setCurrentPage(1);
  };

  const segmentCounts = useMemo(() => {
    return SEGMENTS.reduce((counts, item) => {
      const source =
        item.id === "home_leave" ? homeLeaveList : bookingList;

      counts[item.id] = source.filter((booking) =>
        matchesSegment(booking, item.id, today),
      ).length;

      return counts;
    }, {});
  }, [bookingList, homeLeaveList, today]);

  const segmentBookings = useMemo(() => {
    const source = segment === "home_leave" ? homeLeaveList : bookingList;

    return source.filter((booking) =>
      matchesSegment(booking, segment, today),
    );
  }, [bookingList, homeLeaveList, segment, today]);

  const activeSegment = SEGMENTS.find((item) => item.id === segment);
  const isHomeLeave = segment === "home_leave";

  /*
   * Both segments are edited and deleted through the
   * same modals, so only the schema and the list that
   * owns the row change between them.
   */
  const activeSchema = isHomeLeave
    ? addFormSchemas.homeLeave
    : addFormSchemas.booking;

  const setActiveList = isHomeLeave ? setHomeLeaveList : setBookingList;

  const handleEditRow = (values) => {
    setActiveList((prev) =>
      prev.map((row) =>
        row === editingRow ? buildRow(activeSchema, values, row) : row,
      ),
    );
  };

  const handleDeleteRow = () => {
    setActiveList((prev) => prev.filter((row) => row !== deletingRow));
  };

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
        isHomeLeave ? booking.booking_id : booking.room,
        isHomeLeave ? booking.name : booking.guest?.name,
        isHomeLeave ? booking.reason : booking.guest?.gender,
        isHomeLeave ? booking.approved_by : booking.guest?.country,
        isHomeLeave ? null : booking.guest?.dept,
        isHomeLeave ? null : booking.guest?.meal_type,
        isHomeLeave ? null : booking.status,
        isHomeLeave ? null : booking.notes,
        booking.started_at,
        booking.ended_at,
      ].some((value) => (value || "").toString().toLowerCase().includes(query)),
    );
  }, [search, isHomeLeave, segmentBookings]);

  const sortedBookings = useMemo(() => {
    if (!sortConfig.key) return filteredBookings;

    return [...filteredBookings].sort((a, b) => {
      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "room":
          aValue = isHomeLeave ? a.booking_id : a.room;
          bValue = isHomeLeave ? b.booking_id : b.room;
          break;

        case "guest":
          aValue = a.guest?.name ?? a.name;
          bValue = b.guest?.name ?? b.name;
          break;

        case "gender":
          if (isHomeLeave) return 0;

          aValue = a.guest?.gender;
          bValue = b.guest?.gender;
          break;

        case "country":
          if (isHomeLeave) return 0;

          aValue = a.guest?.country;
          bValue = b.guest?.country;
          break;

        case "dept":
          if (isHomeLeave) return 0;

          aValue = a.guest?.dept;
          bValue = b.guest?.dept;
          break;

        case "meal_type":
          if (isHomeLeave) return 0;

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

        case "days_left": {
          const aDays =
            getDaysLeft(a.ended_at, today) ?? Number.MAX_SAFE_INTEGER;
          const bDays =
            getDaysLeft(b.ended_at, today) ?? Number.MAX_SAFE_INTEGER;

          return sortConfig.direction === "asc" ? aDays - bDays : bDays - aDays;
        }

        case "status":
          if (isHomeLeave) return 0;

          aValue = a.status;
          bValue = b.status;
          break;

        case "notes":
          if (isHomeLeave) return 0;

          aValue = a.notes;
          bValue = b.notes;
          break;

        case "reason":
          if (!isHomeLeave) return 0;

          aValue = a.reason;
          bValue = b.reason;
          break;

        case "approved_by":
          if (!isHomeLeave) return 0;

          aValue = a.approved_by;
          bValue = b.approved_by;
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
  }, [filteredBookings, isHomeLeave, sortConfig, today]);

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
            <h1 className="dashboard-header__title">
              {activeSegment?.title || "Arrival Schedule"}
              {!isCurrentDate ? ` - ${selectedDateLabel}` : ""}
            </h1>

           

<div className="frontdesk-filters">
              <label className="frontdesk-date">
                <i className="bi bi-calendar3" aria-hidden="true" />
                <input
                  type="date"
                  aria-label="Filter by date"
                  value={selectedDate}
                  max={getTodayKey()}
                  onChange={(event) => handleDateChange(event.target.value)}
                />
              </label>

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
aria-label={
                  isHomeLeave
                    ? "Search home leaves"
                    : "Search bookings"
                }
                placeholder={
                isHomeLeave
                  ? "Search by booking ID, name, reason, approver..."
                  : "Search by room, guest, country, status..."
              }
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

                  {isHomeLeave ? (
                    <>
                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("room")}
                        >
                          Booking ID
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("guest")}
                        >
                          Name
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("started_at")}
                        >
                          Started At
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("ended_at")}
                        >
                          Ended At
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("days_left")}
                        >
                          Expected Return
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("reason")}
                        >
                          Reason
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("approved_by")}
                        >
                          Approved By
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>Action</th>
                    </>
                  ) : (
                    <>
                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("room")}
                        >
                          Room
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("guest")}
                        >
                          Guest
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("gender")}
                        >
                          Gender
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("country")}
                        >
                          Country
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("dept")}
                        >
                          Department
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("meal_type")}
                        >
                          Meal Type
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>Booked At</th>

                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("started_at")}
                        >
                          Started At
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("ended_at")}
                        >
                          Ended At
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => handleSort("status")}
                        >
                          Status
                          <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                        </button>
                      </th>

                      <th>Notes</th>

                      <th>Action</th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody>
                {pagedBookings.length === 0 ? (
                  <tr>
                    <td colSpan={isHomeLeave ? "9" : "13"} className="muted">
                      No {activeSegment.label.toLowerCase()} found.
                    </td>
                  </tr>
                ) : (
                  pagedBookings.map((booking, index) => (
                    <tr
                      key={
                        isHomeLeave
                          ? booking.booking_id
                          : `${booking.room}-${booking.started_at}-${index}`
                      }
                    >
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      {isHomeLeave ? (
                        <>
                          <td>
                            <strong>{booking.booking_id || "-"}</strong>
                          </td>

                          <td>{booking.name || "-"}</td>

                          <td>{booking.started_at || "-"}</td>

                          <td>{booking.ended_at || "-"}</td>

                          <td>{formatDaysLeft(booking.ended_at, today)}</td>

                          <td>{booking.reason || "-"}</td>

                          <td>{booking.approved_by || "-"}</td>

                          <td>
                            <TableRowActions
                              label="home leave"
                              rowLabel={booking.name}
                              onView={() =>
                                console.log("View home leave:", booking)
                              }
                              onEdit={() => setEditingRow(booking)}
                              onDelete={() => setDeletingRow(booking)}
                            />
                          </td>
                        </>
                      ) : (
                        <>
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
                            <TableRowActions
                              label="booking"
                              rowLabel={booking.guest?.name}
                              onView={() =>
                                console.log("View booking:", booking)
                              }
                              onEdit={() => setEditingRow(booking)}
                              onDelete={() => setDeletingRow(booking)}
                            />
                          </td>
                        </>
                      )}
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
              {activeSegment.label.toLowerCase()}
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

      {editingRow && !isHomeLeave && (
        <BookingModal
          mode="edit"
          initialValues={editingRow}
          onClose={() => setEditingRow(null)}
          onSubmit={handleEditRow}
        />
      )}

      {editingRow && isHomeLeave && (
        <AddModal
          schema={activeSchema}
          mode="edit"
          initialValues={editingRow}
          onClose={() => setEditingRow(null)}
          onSubmit={handleEditRow}
        />
      )}

      {deletingRow && (
        <ConfirmModal
          title={`Delete ${activeSchema.entity}`}
          message={`Delete this ${activeSchema.entity.toLowerCase()}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onClose={() => setDeletingRow(null)}
          onConfirm={handleDeleteRow}
        />
      )}
    </MainLayout>
  );
}
