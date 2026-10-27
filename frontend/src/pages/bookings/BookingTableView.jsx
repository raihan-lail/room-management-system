import { useCallback, useEffect, useMemo, useState } from "react";
import MainLayout from "../../components/MainLayout";
import TableRowActions from "../../components/TableRowActions";
import BookingCreateModal from "../../components/modals/BookingCreateModal";
import BookingDetailsModal from "../../components/modals/BookingDetailsModal";
import FlexibleButton from "../../components/FlexibleButtons";
import apiRequest from "../../api/client";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  "CONFIRMED",
  "IN_HOUSE",
  "HOME_LEAVE",
  "CHECKED_OUT",
  "CANCELLED",
  "ARCHIVED",
];

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

const SORT_GETTERS = {
  booking_id: (booking) => booking.id,
  room: (booking) => booking.bed?.room?.name,
  bed: (booking) => booking.bed?.name,
  guest: (booking) => booking.resident?.fullName,
  gender: (booking) => booking.resident?.gender,
  country: (booking) => booking.resident?.nationality,
  department: (booking) => booking.resident?.department,
  meal_type: (booking) => booking.resident?.mealType,
  booked_at: (booking) => booking.createdAt,
  started_at: (booking) => booking.startedAt,
  ended_at: (booking) => booking.endedAt,
  status: (booking) => booking.status,
  notes: (booking) => booking.notes,
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

function getBookings(response) {
  return Array.isArray(response?.data) ? response.data : [];
}

function getPagination(response, currentPage) {
  const pagination = response?.pagination ?? {};
  const total = Number(pagination.total ?? 0);

  return {
    page: Number(pagination.page ?? currentPage),
    limit: Number(pagination.limit ?? PAGE_SIZE),
    total,
    totalPages: Math.max(
      1,
      Number(pagination.totalPages ?? Math.ceil(total / PAGE_SIZE)),
    ),
  };
}

export default function BookingTableView() {
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startedAtFrom, setStartedAtFrom] = useState("");
  const [startedAtTo, setStartedAtTo] = useState("");

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewingBookingId, setViewingBookingId] = useState(null);

  const loadBookings = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(PAGE_SIZE),
      });

      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);

      if (startedAtFrom) {
        params.set(
          "startedAtFrom",
          new Date(`${startedAtFrom}T00:00:00.000Z`).toISOString(),
        );
      }

      if (startedAtTo) {
        params.set(
          "startedAtTo",
          new Date(`${startedAtTo}T23:59:59.999Z`).toISOString(),
        );
      }

      const response = await apiRequest(`/api/booking?${params.toString()}`);
      const pageInfo = getPagination(response, currentPage);

      setBookings(getBookings(response));
      setPagination(pageInfo);

      // Protect against a stale page after filtering.
      if (pageInfo.totalPages > 0 && currentPage > pageInfo.totalPages) {
        setCurrentPage(pageInfo.totalPages);
      }
    } catch (err) {
      setError(err.message || "Failed to load bookings.");
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, statusFilter, startedAtFrom, startedAtTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadBookings();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadBookings]);

  const sortedBookings = useMemo(() => {
    const getValue = SORT_GETTERS[sortConfig.key];

    if (!getValue) return bookings;

    return [...bookings].sort((a, b) => {
      const aValue = (getValue(a) ?? "").toString().toLowerCase();
      const bValue = (getValue(b) ?? "").toString().toLowerCase();

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }

      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }

      return 0;
    });
  }, [bookings, sortConfig]);

  const startRow =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1;
  const endRow = Math.min(
    pagination.page * pagination.limit,
    pagination.total,
  );

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleStartedAtFromChange = (value) => {
    setStartedAtFrom(value);
    setCurrentPage(1);
  };

  const handleStartedAtToChange = (value) => {
    setStartedAtTo(value);
    setCurrentPage(1);
  };

  const handleBookingCreated = useCallback(async () => {
    if (currentPage === 1) {
      await loadBookings();
      return;
    }

    setCurrentPage(1);
  }, [currentPage, loadBookings]);

  return (
    <MainLayout>
      <div className="dashboard">
        {/* HEADER */}
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Bookings (table view)</h1>

            <p className="dashboard-header__subtitle">
              View and manage room bookings
            </p>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search bookings"
              placeholder="Search by resident, room, bed, email..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <label className="calendar-date-filter">
              <span>Status</span>
              <select
                aria-label="Filter bookings by status"
                value={statusFilter}
                onChange={(event) =>
                  handleStatusFilterChange(event.target.value)
                }
              >
                <option value="">All</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="calendar-date-filter">
              <span>Start From</span>
              <input
                type="date"
                aria-label="Filter bookings starting from"
                value={startedAtFrom}
                onChange={(event) =>
                  handleStartedAtFromChange(event.target.value)
                }
              />
            </label>

            <label className="calendar-date-filter">
              <span>Start To</span>
              <input
                type="date"
                aria-label="Filter bookings starting until"
                value={startedAtTo}
                onChange={(event) =>
                  handleStartedAtToChange(event.target.value)
                }
              />
            </label>

            <FlexibleButton
              permission="bookings.create"
              className="btn btn-primary"
              onClick={() => setIsAddModalOpen(true)}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Create New Booking
            </FlexibleButton>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        {/* TABLE CARD */}
        <section className="table-card content">
          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("booking_id")}
                    >
                      Booking ID
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
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
                  <th>Bed</th>
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
                      onClick={() => handleSort("department")}
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
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("booked_at")}
                    >
                      Booked At
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
                      onClick={() => handleSort("status")}
                    >
                      Status
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={14} className="muted">
                      Loading bookings...
                    </td>
                  </tr>
                ) : sortedBookings.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="muted">
                      No bookings found.
                    </td>
                  </tr>
                ) : (
                  sortedBookings.map((booking) => (
                    <tr key={booking.id}>
                      <td>
                        <strong>{booking.id || "-"}</strong>
                      </td>

                      <td>
                        <strong>{booking.bed?.room?.name || "-"}</strong>
                      </td>

                      <td>{booking.bed?.name || "-"}</td>

                      <td>{booking.resident?.fullName || "-"}</td>

                      <td>
                        {GENDER_LABELS[booking.resident?.gender] ??
                          booking.resident?.gender ??
                          "-"}
                      </td>

                      <td>{booking.resident?.nationality || "-"}</td>

                      <td>{booking.resident?.department || "-"}</td>

                      <td>
                        {MEAL_TYPE_LABELS[booking.resident?.mealType] ??
                          booking.resident?.mealType ??
                          "-"}
                      </td>

                      <td>{formatDate(booking.createdAt)}</td>

                      <td>{formatDate(booking.startedAt)}</td>

                      <td>{formatDate(booking.endedAt)}</td>

                      <td>
                        <span
                          className={`booking-status booking-status--${booking.status?.toLowerCase()}`}
                        >
                          {formatStatus(booking.status)}
                        </span>
                      </td>

                      <td>{booking.notes || "-"}</td>

                      <td>
                        <TableRowActions
                          label="booking"
                          rowLabel={booking.resident?.fullName}
                          onView={() => setViewingBookingId(booking.id)}
                        />
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
              Showing {startRow}–{endRow} of {pagination.total} bookings
            </span>

            <div className="office-page-nav">
              <button
                type="button"
                className="btn btn-neutral"
                disabled={isLoading || pagination.page <= 1}
                onClick={() =>
                  setCurrentPage((prev) => Math.max(1, prev - 1))
                }
              >
                <i className="bi bi-chevron-left" aria-hidden="true" />
                Prev
              </button>

              <span className="office-page-info">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                className="btn btn-neutral"
                disabled={isLoading || pagination.page >= pagination.totalPages}
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.min(pagination.totalPages, prev + 1),
                  )
                }
              >
                Next
                <i className="bi bi-chevron-right" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {isAddModalOpen && (
        <BookingCreateModal
          onClose={() => setIsAddModalOpen(false)}
          onCreated={handleBookingCreated}
        />
      )}

      {viewingBookingId && (
        <BookingDetailsModal
          bookingId={viewingBookingId}
          onClose={() => setViewingBookingId(null)}
        />
      )}
    </MainLayout>
  );
}
