import { useMemo, useState } from "react";
import MainLayout from "../../components/MainLayout";
import TableRowActions from "../../components/TableRowActions";
import BookingModal from "../../components/modals/BookingModal";
import ConfirmModal from "../../components/modals/ConfirmModal";

import {
  addFormSchemas,
  buildRow,
} from "../../components/modals/addFormSchemas";
import bookingsData from "../../data/bookings";
import FlexibleButton from "../../components/FlexibleButtons";

const PAGE_SIZE = 10;

const bookingSchema = addFormSchemas.booking;

const initialBookings = Array.isArray(bookingsData)
  ? bookingsData
  : [];

export default function BookingTableView() {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });
  const [bookings, setBookings] =
    useState(initialBookings);
  const [isAddModalOpen, setIsAddModalOpen] =
    useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(null);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

    setCurrentPage(1);
  };

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return bookings;

    return bookings.filter((booking) =>
      [
        booking.booking_id,
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
  }, [bookings, search]);

  const sortedBookings = useMemo(() => {
    if (!sortConfig.key) return filteredBookings;

    return [...filteredBookings].sort((a, b) => {
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

  const handleCreateBooking = (values) => {
    setBookings((prev) => [...prev, buildRow(bookingSchema, values)]);

    setCurrentPage(1);
  };

  const handleEditBooking = (values) => {
    setBookings((prev) =>
      prev.map((row) =>
        row === editingRow ? buildRow(bookingSchema, values, row) : row,
      ),
    );
  };

  const handleDeleteBooking = () => {
    setBookings((prev) => prev.filter((row) => row !== deletingRow));
  };

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
              placeholder="Search by room, guest, country, status..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <FlexibleButton
              permission="bookings.create"
              className="btn btn-primary"
              onClick={() => setIsAddModalOpen(true)}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Create New Booking
            </FlexibleButton>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => console.log("Import Excel")}
            >
              <i className="bi bi-file-earmark-excel" aria-hidden="true" />
              Bulk Import
            </button>
              <button
              type="button"
              className="btn btn-neutral"
              onClick={() => console.log("Import Excel")}
            >
              <i className="bi bi-file-earmark-excel" aria-hidden="true" />
              Export Excel
            </button>
          </div>
        </div>

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
                      <i className="bi bi-sort-alpha-down" column="booking_id">
                        {" "}
                      </i>
                    </button>
                  </th>
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
                    Bed
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
                      No bookings found.
                    </td>
                  </tr>
                ) : (
                  pagedBookings.map((booking, index) => (
                    <tr key={`${booking.room}-${booking.started_at}-${index}`}>
                      <td>
                        <strong>{booking.booking_id || "-"}</strong>
                      </td>

                      <td>
                        <strong>{booking.room || "-"}</strong>
                      </td>
                       <td>
                        <strong>{booking.bed || "-"}</strong>
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="office-pagination">
            <span className="office-page-info">
              Showing {startRow}–{endRow} of {filteredBookings.length} bookings
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

      {isAddModalOpen && (
        <BookingModal
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleCreateBooking}
        />
      )}

      {editingRow && (
        <BookingModal
          mode="edit"
          initialValues={editingRow}
          onClose={() => setEditingRow(null)}
          onSubmit={handleEditBooking}
        />
      )}

      {deletingRow && (
        <ConfirmModal
          title="Delete Booking"
          message={`Delete the booking for ${deletingRow.guest?.name || "this guest"}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onClose={() => setDeletingRow(null)}
          onConfirm={handleDeleteBooking}
        />
      )}
    </MainLayout>
  );
}
