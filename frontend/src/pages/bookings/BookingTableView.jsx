import { useMemo, useState } from "react";
import MainLayout from "../../components/MainLayout";
import bookings from "../../data/bookings";

const PAGE_SIZE = 10;

export default function BookingTableView() {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return bookings;

    return bookings.filter((booking) =>
      [
        booking.room,
        booking.guest?.name,
        booking.guest?.gender,
        booking.guest?.country,
        booking.guest?.dept,
        booking.guest?.meal_type,
        booking.status,
        booking.notes,
      ].some((value) =>
        (value || "").toString().toLowerCase().includes(query)
      )
    );
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const pagedBookings = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return filteredBookings.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredBookings, safePage]);

  const startRow = filteredBookings.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
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
              Bookings (table view)
            </h1>

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
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => console.log("Create new booking")}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Create New Booking
            </button>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => console.log("Import Excel")}
            >
              <i className="bi bi-file-earmark-excel" aria-hidden="true" />
              Import Excel
            </button>
          </div>
        </div>

        {/* TABLE CARD */}
        <section className="table-card content">
          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th className="table-col-no">No</th>
                  <th>Room</th>
                  <th>Guest</th>
                  <th>Gender</th>
                  <th>Country</th>
                  <th>Department</th>
                  <th>Meal Type</th>
                  <th>Started At</th>
                  <th>Ended At</th>
                  <th>Status</th>
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
                    <tr
                      key={`${booking.room}-${booking.started_at}-${index}`}
                    >
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
                            <i
                              className="bi bi-eye"
                              aria-hidden="true"
                            />
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
              Showing {startRow}–{endRow} of {filteredBookings.length} bookings
            </span>

            <div className="office-page-nav">
              <button
                type="button"
                className="btn btn-neutral"
                disabled={safePage <= 1}
                onClick={() =>
                  setCurrentPage((prev) => Math.max(1, prev - 1))
                }
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