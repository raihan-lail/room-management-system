import { useCallback, useEffect, useMemo, useState } from "react";
import MainLayout from "../components/MainLayout";
import apiRequest from "../api/client";
import TableRowActions from "../components/TableRowActions";
import BookingModal from "../components/modals/BookingModal";
import ConfirmModal from "../components/modals/ConfirmModal";
import ExportModal from "../components/modals/ExportModal";
import {
  addFormSchemas,
  buildRow,
} from "../components/modals/addFormSchemas";
import FlexibleButton from "../components/FlexibleButtons";


const PAGE_SIZE = 10;
const BOOKING_TABS = ["arrival", "in-house", "home_leave", "near-end", "departure"];

const SEGMENTS = [
  { id: "arrival", label: "Arrival", icon: "bi-box-arrow-in-down", title: "Arrival Schedule" },
  { id: "in-house", label: "In House", icon: "bi-house-door", title: "Current In House" },
   { id: "home_leave", label: "Home Leave", icon: "bi-door-open", title: "Current Home Leave" },
   { id: "near-end", label: "Near End Date", icon: "bi-door-open", title: "Ended Soon" },
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

const getTomorrowKey = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const month = `${tomorrow.getMonth() + 1}`.padStart(2, "0");
  const day = `${tomorrow.getDate()}`.padStart(2, "0");

  return `${tomorrow.getFullYear()}-${month}-${day}`;
};

const toApiTab = (tab) => (tab === "home_leave" ? "home-leave" : tab);

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

const toHomeLeaveRow = (booking) => {
  const leaves = Array.isArray(booking.homeLeaves) ? booking.homeLeaves : [];
  const leave =
    leaves.find((item) => item.status === "ACTIVE") ?? leaves[0] ?? null;

  return {
    id: booking.id,
    booking_id: booking.bookingNumber ?? "",
    name: booking.resident?.fullName ?? "",
    room: booking.bed?.room?.name ?? "",
    started_at: leave?.startedAt?.slice(0, 10) ?? "",
    expected_return_at: leave?.expectedReturnAt?.slice(0, 10) ?? "",
    reason: leave?.reason ?? "",
    status: leave?.status ?? "",
  };
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
  const [bookingList, setBookingList] = useState([]);
  const [bookingPagination, setBookingPagination] = useState({ total: 0, totalPages: 1 });
  const [bookingCounts, setBookingCounts] = useState({
    arrival: 0,
    "in-house": 0,
    "near-end": 0,
    departure: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [actionError, setActionError] = useState("");
  const [extendingRow, setExtendingRow] = useState(null);
  const [extensionDate, setExtensionDate] = useState("");
  const [homeLeaveList, setHomeLeaveList] = useState([]);
  const [homeLeaveRow, setHomeLeaveRow] = useState(null);
  const [isHomeLeaveModalOpen, setIsHomeLeaveModalOpen] = useState(false);
  const [homeLeaveBookings, setHomeLeaveBookings] = useState([]);
  const [homeLeaveBookingId, setHomeLeaveBookingId] = useState("");
  const [isLoadingHomeLeaveBookings, setIsLoadingHomeLeaveBookings] = useState(false);
  const [homeLeaveExpectedReturn, setHomeLeaveExpectedReturn] = useState("");
  const [homeLeaveReason, setHomeLeaveReason] = useState("");
  const [editingRow, setEditingRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(null);
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayKey);

  const today = selectedDate;
  const isCurrentDate = selectedDate === getTodayKey();
  const selectedDateLabel = useMemo(
    () => selectedDateFormatter.format(new Date(`${selectedDate}T00:00:00`)),
    [selectedDate],
  );
  const exportFilename = useMemo(() => {
    const date = new Date(`${selectedDate}T00:00:00`);
    const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(date).toLowerCase();
    return `${segment.replaceAll("_", "-")}-${date.getDate()}-${month}-${date.getFullYear()}.xlsx`;
  }, [segment, selectedDate]);

  const handleDateChange = (value) => {
    if (!value) return;

    setSelectedDate(value);
    setCurrentPage(1);
  };

  const handleSegmentChange = (nextSegment) => {
    setSegment(nextSegment);
    setCurrentPage(1);
    setError("");
    setActionError("");
  };

  const isHomeLeave = segment === "home_leave";
  const activeSegment = SEGMENTS.find((item) => item.id === segment);

  const loadBookings = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const buildParams = (tab) => {
        const params = new URLSearchParams({
          tab: toApiTab(tab),
          page: tab === segment ? String(currentPage) : "1",
          limit: tab === segment ? String(PAGE_SIZE) : "1",
          date: selectedDate,
          ...(isCurrentDate ? {} : { history: "true" }),
        });
        if (tab === "in-house" && isCurrentDate) params.set("status", "IN_HOUSE");
        if (search.trim()) params.set("search", search.trim());
        return params;
      };

      const countRequests = BOOKING_TABS
        .filter((tab) => tab !== segment)
        .map(async (tab) => {
          const countResponse = await apiRequest(`/api/booking?${buildParams(tab).toString()}`);
          return [tab, Number(countResponse?.pagination?.total ?? 0)];
        });

      const [response, ...otherCounts] = await Promise.all([
        apiRequest(`/api/booking?${buildParams(segment).toString()}`),
        ...countRequests,
      ]);
      const pagination = response?.pagination ?? {};
      const total = Number(pagination.total ?? 0);
      setBookingCounts({
        ...Object.fromEntries(otherCounts),
        [segment]: total,
      });
      const records = Array.isArray(response?.data) ? response.data : [];
      if (segment === "home_leave") {
        setHomeLeaveList(records.map(toHomeLeaveRow));
      } else {
        setBookingList(records.map((booking) => ({
          ...booking,
          room: booking.bed?.room?.name ?? "",
          guest: {
            name: booking.resident?.fullName ?? "",
            gender: booking.resident?.gender ?? "",
            country: booking.resident?.nationality ?? "",
            dept: booking.resident?.department ?? "",
            meal_type: booking.resident?.mealType ?? "",
          },
          booked_at: booking.createdAt?.slice(0, 10) ?? "",
          started_at: booking.startedAt?.slice(0, 10) ?? "",
          ended_at: booking.endedAt?.slice(0, 10) ?? "",
        })));
      }
      const totalPages = Math.max(1, Number(pagination.totalPages ?? Math.ceil(total / PAGE_SIZE)));
      setBookingPagination({ total, totalPages });
      if (currentPage > totalPages) setCurrentPage(totalPages);
    } catch (err) {
      setError(err.message || "Failed to load bookings.");
      setBookingList([]);
      setHomeLeaveList([]);
      setBookingPagination({ total: 0, totalPages: 1 });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, isCurrentDate, search, segment, selectedDate]);

  useEffect(() => {
  const timer = window.setTimeout(() => {
    loadBookings();
  }, 0);

  return () => window.clearTimeout(timer);
}, [loadBookings]);

  const segmentCounts = bookingCounts;
  const segmentBookings = isHomeLeave ? homeLeaveList : bookingList;

  /*
   * Booking rows share the edit and delete modals. Home leave rows are
   * managed through the start and return actions instead.
   */
  const activeSchema = addFormSchemas.booking;

  const handleEditRow = (values) => {
    setBookingList((prev) =>
      prev.map((row) =>
        row === editingRow ? buildRow(activeSchema, values, row) : row,
      ),
    );
  };

  const handleDeleteRow = () => {
    setBookingList((prev) => prev.filter((row) => row !== deletingRow));
  };

  const performBookingAction = async (booking, action, body) => {
    setIsSavingAction(true);
    setActionError("");
    try {
      await apiRequest(`/api/booking/${booking.id}/${action}`, {
        method: "POST",
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await loadBookings();
      return true;
    } catch (err) {
      setActionError(err.message || "Booking action failed.");
      return false;
    } finally {
      setIsSavingAction(false);
      setExtendingRow(null);
    }
  };

  const submitExtension = (event) => {
    event.preventDefault();
    if (!extendingRow || !extensionDate || extensionDate <= extendingRow.ended_at) {
      setActionError("Choose an end date later than the current end date.");
      return;
    }
    performBookingAction(extendingRow, "extend", {
      endedAt: new Date(`${extensionDate}T00:00:00.000Z`).toISOString(),
    });
  };

  const openHomeLeaveModal = (booking) => {
    setActionError("");
    setHomeLeaveRow(booking);
    setHomeLeaveBookingId(booking.id);
    setIsHomeLeaveModalOpen(true);
    setHomeLeaveExpectedReturn("");
    setHomeLeaveReason("");
  };

  const openCreateHomeLeave = async () => {
    setActionError("");
    setHomeLeaveRow(null);
    setHomeLeaveBookings([]);
    setHomeLeaveBookingId("");
    setIsHomeLeaveModalOpen(true);
    setHomeLeaveExpectedReturn("");
    setHomeLeaveReason("");
    setIsLoadingHomeLeaveBookings(true);

    try {
      const params = new URLSearchParams({
        tab: "in-house",
        status: "IN_HOUSE",
        page: "1",
        limit: "100",
        date: getTodayKey(),
      });
      const response = await apiRequest(`/api/booking?${params.toString()}`);
      const records = Array.isArray(response?.data) ? response.data : [];

      setHomeLeaveBookings(records.map((booking) => ({
        id: booking.id,
        bookingNumber: booking.bookingNumber ?? "",
        name: booking.resident?.fullName ?? "",
        room: booking.bed?.room?.name ?? "",
        ended_at: booking.endedAt?.slice(0, 10) ?? "",
      })));
    } catch (err) {
      setActionError(err.message || "Failed to load in-house bookings.");
    } finally {
      setIsLoadingHomeLeaveBookings(false);
    }
  };

  const closeHomeLeaveModal = () => {
    if (isSavingAction) return;

    setIsHomeLeaveModalOpen(false);
    setHomeLeaveRow(null);
    setHomeLeaveBookingId("");
    setActionError("");
  };

  const selectedHomeLeaveBooking = homeLeaveRow
    ?? homeLeaveBookings.find((booking) => booking.id === homeLeaveBookingId)
    ?? null;

  const submitHomeLeave = async (event) => {
    event.preventDefault();

    if (!selectedHomeLeaveBooking) {
      setActionError("Select an in-house booking.");
      return;
    }

    if (!homeLeaveExpectedReturn) {
      setActionError("Choose an expected return date.");
      return;
    }

    if (
      selectedHomeLeaveBooking.ended_at &&
      homeLeaveExpectedReturn > selectedHomeLeaveBooking.ended_at
    ) {
      setActionError("Expected return cannot be later than the booking end date.");
      return;
    }

    const succeeded = await performBookingAction(selectedHomeLeaveBooking, "home-leaves", {
      expectedReturnAt: new Date(`${homeLeaveExpectedReturn}T00:00:00.000Z`).toISOString(),
      reason: homeLeaveReason.trim(),
    });

    if (succeeded) {
      setIsHomeLeaveModalOpen(false);
      setHomeLeaveRow(null);
      setHomeLeaveBookingId("");
      setHomeLeaveExpectedReturn("");
      setHomeLeaveReason("");
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

    setCurrentPage(1);
  };

  const sortedBookings = useMemo(() => {
    if (!sortConfig.key) return segmentBookings;

    return [...segmentBookings].sort((a, b) => {
      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "booking_id":
          aValue = a.booking_id;
          bValue = b.booking_id;
          break;

        case "room":
          aValue = a.room;
          bValue = b.room;
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

        case "expected_return":
          aValue = a.expected_return_at;
          bValue = b.expected_return_at;
          break;

        case "status":
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
  }, [segmentBookings, isHomeLeave, sortConfig]);

  const totalPages = bookingPagination.totalPages;
  const safePage = Math.min(currentPage, totalPages);

  const pagedBookings = sortedBookings;
  const overdueArrivalCount = segment === "arrival" && isCurrentDate
    ? bookingList.filter((booking) => booking.started_at && booking.started_at < getTodayKey()).length
    : 0;

  const startRow =
    bookingPagination.total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(safePage * PAGE_SIZE, bookingPagination.total);

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
                      {segmentCounts[item.id] ?? 0}
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
                  ? "Search by booking ID or name..."
                  : "Search by room, guest, country, status..."
              }
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>
          <button type="button" className="btn btn-neutral" onClick={() => setIsExportModalOpen(true)}>
             <i className="bi bi-file-earmark-excel" aria-hidden="true" /> Export Excel
          </button>
          {isHomeLeave && (
            <FlexibleButton
              type="button"
              permission="home.leaves"
              className="btn btn-primary"
              onClick={openCreateHomeLeave}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" /> Create Home Leave
            </FlexibleButton>
          )}
        
        </div>

        {/* TABLE CARD */}
        <section className="table-card content">
          {overdueArrivalCount > 0 && (
            <div className="frontdesk-overdue-alert" role="alert">
              {overdueArrivalCount} arrival{overdueArrivalCount === 1 ? " has" : "s have"} passed the started_at date
            </div>
          )}
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
                {error ? (
                  <tr><td colSpan={isHomeLeave ? "9" : "13"} className="muted">{error}</td></tr>
                ) : isLoading ? (
                  <tr><td colSpan={isHomeLeave ? "9" : "13"} className="muted">Loading {activeSegment.label.toLowerCase()}...</td></tr>
                ) : pagedBookings.length === 0 ? (
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
                          : booking.id
                      }
                      className={segment === "arrival" && isCurrentDate && booking.started_at && booking.started_at < getTodayKey() ? "frontdesk-row--overdue" : ""}
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

                          <td>{booking.room || "-"}</td>

                          <td>{booking.started_at || "-"}</td>

                          <td>
                            {booking.expected_return_at
                              ? `${booking.expected_return_at} (${formatDaysLeft(booking.expected_return_at, today)})`
                              : "-"}
                          </td>

                          <td>{booking.reason || "-"}</td>

                          <td>{booking.status || "-"}</td>

                          <td>
                            {isCurrentDate && booking.status === "ACTIVE" ? (
                              <FlexibleButton
                                permission="home.leaves"
                                className="btn btn-primary"
                                disabled={isSavingAction}
                                onClick={() => performBookingAction(booking, "return-from-leave")}
                              >
                                Return
                              </FlexibleButton>
                            ) : "-"}
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
                            {!isCurrentDate ? "-" : segment === "arrival" ? (
                              <div className="table-actions">
                                <FlexibleButton permission="bookings.create" className="btn btn-primary" disabled={isSavingAction} onClick={() => performBookingAction(booking, "check-in")}>Check In</FlexibleButton>
                                <FlexibleButton permission="bookings.create" className="btn btn-neutral" disabled={isSavingAction} onClick={() => setCancellingBooking(booking)}>Cancel Booking</FlexibleButton>
                              </div>
                            ) : segment === "near-end" ? (
                              <FlexibleButton permission="bookings.create" className="btn btn-primary" disabled={isSavingAction} onClick={() => { setActionError(""); setExtendingRow(booking); setExtensionDate(""); }}>Extend</FlexibleButton>
                            ) : segment === "departure" ? (
                              <FlexibleButton permission="bookings.create" className="btn btn-primary" disabled={isSavingAction} onClick={() => performBookingAction(booking, "check-out")}>Check Out</FlexibleButton>
                            ) : segment === "in-house" ? (
                              <FlexibleButton
                                permission="home.leaves"
                                className="btn btn-primary"
                                disabled={isSavingAction}
                                onClick={() => openHomeLeaveModal(booking)}
                              >
                                Home Leave
                              </FlexibleButton>
                            ) : (
                              <TableRowActions label="booking" rowLabel={booking.guest?.name} onView={() => console.log("View booking:", booking)} onEdit={() => setEditingRow(booking)} onDelete={() => setDeletingRow(booking)} />
                            )}
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
              Showing {startRow}–{endRow} of {bookingPagination.total}{" "}
              {activeSegment.label.toLowerCase()}
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
                Page {safePage} of {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-neutral"
                disabled={isLoading || safePage >= totalPages}
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

      {cancellingBooking && (
        <ConfirmModal
          title="Cancel booking"
          message={`Cancel the booking for ${cancellingBooking.guest?.name || "this resident"}?`}
          confirmLabel="Cancel Booking"
          danger
          onClose={() => setCancellingBooking(null)}
          onConfirm={() => {
            performBookingAction(cancellingBooking, "cancel");
            setCancellingBooking(null);
          }}
        />
      )}

      {extendingRow && (
        <div
          className="modal-overlay"
          onMouseDown={() => !isSavingAction && setExtendingRow(null)}
        >
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="extend-booking-title"
            onSubmit={submitExtension}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal__header">
              <h2 className="modal__title" id="extend-booking-title">Extend Stay</h2>
              <button
                type="button"
                className="modal__close"
                onClick={() => setExtendingRow(null)}
                aria-label="Close"
                disabled={isSavingAction}
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <p className="modal__message">
              Choose a new end date for {extendingRow.guest?.name || "this booking"}.
            </p>
            <label className="frontdesk-date">
              <span>New end date</span>
              <input
                type="date"
                required
                min={extendingRow.ended_at}
                value={extensionDate}
                onChange={(event) => setExtensionDate(event.target.value)}
              />
            </label>
            {actionError && <p role="alert">{actionError}</p>}
            <div className="modal__actions">
              <button type="button" className="btn btn-neutral" onClick={() => setExtendingRow(null)} disabled={isSavingAction}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSavingAction}>{isSavingAction ? "Saving..." : "Extend Stay"}</button>
            </div>
          </form>
        </div>
      )}

      {isHomeLeaveModalOpen && (
        <div
          className="modal-overlay"
          onMouseDown={closeHomeLeaveModal}
        >
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-leave-title"
            onSubmit={submitHomeLeave}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal__header">
              <h2 className="modal__title" id="home-leave-title">
                {homeLeaveRow ? "Start Home Leave" : "Create Home Leave"}
              </h2>
              <button
                type="button"
                className="modal__close"
                onClick={closeHomeLeaveModal}
                aria-label="Close"
                disabled={isSavingAction}
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <p className="modal__message">
              {homeLeaveRow
                ? `Record home leave for ${homeLeaveRow.guest?.name || "this resident"}.`
                : "Choose an in-house booking to start home leave."}
            </p>
            <div className="form-stack">
              {!homeLeaveRow && (
                <label className="form-field">
                  <span>In-house booking</span>
                  <select
                    required
                    value={homeLeaveBookingId}
                    onChange={(event) => {
                      setHomeLeaveBookingId(event.target.value);
                      setActionError("");
                    }}
                    disabled={isLoadingHomeLeaveBookings || isSavingAction}
                  >
                    <option value="">
                      {isLoadingHomeLeaveBookings
                        ? "Loading in-house bookings..."
                        : homeLeaveBookings.length === 0
                          ? "No in-house bookings available"
                          : "Select a booking"}
                    </option>
                    {homeLeaveBookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {booking.bookingNumber} - {booking.name} ({booking.room})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="form-field">
                <span>Expected return date</span>
                <input
                  type="date"
                  required
                  min={getTomorrowKey()}
                  max={selectedHomeLeaveBooking?.ended_at || undefined}
                  value={homeLeaveExpectedReturn}
                  onChange={(event) => setHomeLeaveExpectedReturn(event.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Reason</span>
                <input
                  type="text"
                  placeholder="Optional reason"
                  value={homeLeaveReason}
                  onChange={(event) => setHomeLeaveReason(event.target.value)}
                />
              </label>
            </div>
            {actionError && <p role="alert">{actionError}</p>}
            <div className="modal__actions">
              <button type="button" className="btn btn-neutral" onClick={closeHomeLeaveModal} disabled={isSavingAction}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSavingAction}>
                {isSavingAction
                  ? "Saving..."
                  : homeLeaveRow
                    ? "Start Home Leave"
                    : "Create Home Leave"}
              </button>
            </div>
          </form>
        </div>
      )}

      {actionError && !extendingRow && !isHomeLeaveModalOpen && (
        <div className="error-message" role="alert">{actionError}</div>
      )}
      {isExportModalOpen && (
        <ExportModal
          title={`Export ${activeSegment?.label || "Bookings"}`}
          endpoint="/api/booking/export"
          filename={exportFilename}
          entityLabel="bookings"
          extraParams={{ frontdeskTab: segment, date: selectedDate, frontdeskHistory: isCurrentDate ? "false" : "true" }}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}
    </MainLayout>
  );
}
