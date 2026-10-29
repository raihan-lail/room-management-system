import { useCallback, useEffect, useMemo, useState } from "react";
import MainLayout from "../../components/MainLayout";
import apiRequest from "../../api/client";
import ExportModal from "../../components/modals/ExportModal";
import FlexibleButton from "../../components/FlexibleButtons";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "RETURNED", label: "Returned" },
];

const formatDate = (value) =>
  value ? String(value).slice(0, 10) : "-";

const formatStatus = (status) =>
  status === "ACTIVE" ? "Active" : status === "RETURNED" ? "Returned" : "-";

const statusClass = (status) =>
  status === "ACTIVE" ? "in_house" : "checked_out";

export default function HomeLeave() {
  const [homeLeaves, setHomeLeaves] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startedAtFrom, setStartedAtFrom] = useState("");
  const [startedAtTo, setStartedAtTo] = useState("");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const loadHomeLeaves = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(PAGE_SIZE),
      });

      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (startedAtFrom) params.set("startedAtFrom", startedAtFrom);
      if (startedAtTo) params.set("startedAtTo", startedAtTo);

      const response = await apiRequest(`/api/booking/home-leaves?${params.toString()}`);
      const total = Number(response?.pagination?.total ?? 0);
      const totalPages = Math.max(
        1,
        Number(response?.pagination?.totalPages ?? Math.ceil(total / PAGE_SIZE)),
      );

      setHomeLeaves(Array.isArray(response?.data) ? response.data : []);
      setPagination({ total, totalPages });

      if (currentPage > totalPages) setCurrentPage(totalPages);
    } catch (err) {
      setError(err.message || "Failed to load home leaves.");
      setHomeLeaves([]);
      setPagination({ total: 0, totalPages: 1 });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, statusFilter, startedAtFrom, startedAtTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadHomeLeaves();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadHomeLeaves]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

    setCurrentPage(1);
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleDateChange = (setter, value) => {
    setter(value);
    setCurrentPage(1);
  };

  const sortedHomeLeaves = useMemo(() => {
    if (!sortConfig.key) return homeLeaves;

    return [...homeLeaves].sort((a, b) => {
      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "booking_id":
          aValue = a.booking?.bookingNumber;
          bValue = b.booking?.bookingNumber;
          break;

        case "name":
          aValue = a.booking?.resident?.fullName;
          bValue = b.booking?.resident?.fullName;
          break;

        case "room":
          aValue = a.booking?.bed?.room?.name;
          bValue = b.booking?.bed?.room?.name;
          break;

        case "started_at":
          aValue = a.startedAt;
          bValue = b.startedAt;
          break;

        case "expected_return":
          aValue = a.expectedReturnAt;
          bValue = b.expectedReturnAt;
          break;

        case "returned_at":
          aValue = a.returnedAt;
          bValue = b.returnedAt;
          break;

        case "reason":
          aValue = a.reason;
          bValue = b.reason;
          break;

        case "status":
          aValue = a.status;
          bValue = b.status;
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
  }, [homeLeaves, sortConfig]);

  const safePage = Math.min(currentPage, pagination.totalPages);

  const startRow =
    pagination.total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;

  const endRow = Math.min(safePage * PAGE_SIZE, pagination.total);

  return (
    <MainLayout>
      <div className="dashboard">
        {/* HEADER */}
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Home Leaves</h1>

            <p className="dashboard-header__subtitle">
              Current and past home leaves
            </p>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search home leaves"
              placeholder="Search by booking ID, name, room, reason..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <label className="calendar-date-filter">
              <span>Leave From</span>
              <input
                type="date"
                aria-label="Filter home leaves from date"
                value={startedAtFrom}
                onChange={(event) => handleDateChange(setStartedAtFrom, event.target.value)}
              />
            </label>
            <label className="calendar-date-filter">
              <span>Leave To</span>
              <input
                type="date"
                aria-label="Filter home leaves through date"
                value={startedAtTo}
                onChange={(event) => handleDateChange(setStartedAtTo, event.target.value)}
              />
            </label>
            <label className="calendar-date-filter">
              <span>Status</span>
              <select
                aria-label="Filter home leaves by status"
                value={statusFilter}
                onChange={(event) => handleStatusChange(event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <FlexibleButton
              permission="home.leaves"
              className="btn btn-neutral"
              onClick={() => setIsExportModalOpen(true)}
            >
              <i className="bi bi-file-earmark-excel" aria-hidden="true" />
              Export
            </FlexibleButton>
          </div>
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
                      onClick={() => handleSort("name")}
                    >
                      Name
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
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("started_at")}
                    >
                      Leave Started
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("expected_return")}
                    >
                      Expected Return
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("returned_at")}
                    >
                      Returned At
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
                      onClick={() => handleSort("status")}
                    >
                      Status
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody>
                {error ? (
                  <tr>
                    <td colSpan="9" className="muted">
                      {error}
                    </td>
                  </tr>
                ) : isLoading ? (
                  <tr>
                    <td colSpan="9" className="muted">
                      Loading home leaves...
                    </td>
                  </tr>
                ) : sortedHomeLeaves.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="muted">
                      No home leaves found.
                    </td>
                  </tr>
                ) : (
                  sortedHomeLeaves.map((homeLeave, index) => (
                    <tr key={homeLeave.id}>
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      <td>
                        <strong>
                          {homeLeave.booking?.bookingNumber || "-"}
                        </strong>
                      </td>

                      <td>{homeLeave.booking?.resident?.fullName || "-"}</td>

                      <td>{homeLeave.booking?.bed?.room?.name || "-"}</td>

                      <td>{formatDate(homeLeave.startedAt)}</td>

                      <td>{formatDate(homeLeave.expectedReturnAt)}</td>

                      <td>{formatDate(homeLeave.returnedAt)}</td>

                      <td>{homeLeave.reason || "-"}</td>

                      <td>
                        <span
                          className={`booking-status booking-status--${statusClass(homeLeave.status)}`}
                        >
                          {formatStatus(homeLeave.status)}
                        </span>
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
              Showing {startRow}–{endRow} of {pagination.total} home leaves
            </span>

            <div className="office-page-nav">
              <button
                type="button"
                className="btn btn-neutral"
                disabled={isLoading || safePage <= 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                <i className="bi bi-chevron-left" aria-hidden="true" />
                Prev
              </button>

              <span className="office-page-info">
                Page {safePage} of {pagination.totalPages}
              </span>

              <button
                type="button"
                className="btn btn-neutral"
                disabled={isLoading || safePage >= pagination.totalPages}
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
      {isExportModalOpen && (
        <ExportModal
          title="Export Home Leaves"
          endpoint="/api/booking/home-leaves/export"
          filename="home-leaves.xlsx"
          entityLabel="home leaves"
          filterFields={[
            { name: "search", label: "Search", placeholder: "Booking ID, name, room, reason..." },
            { name: "startedAtFrom", label: "Leave From", type: "date" },
            { name: "startedAtTo", label: "Leave To", type: "date" },
            { name: "status", label: "Status", type: "select", placeholderOption: "All statuses", options: STATUS_OPTIONS.filter((option) => option.value) },
          ]}
          initialFilters={{ search, startedAtFrom, startedAtTo, status: statusFilter }}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}
    </MainLayout>
  );
}
