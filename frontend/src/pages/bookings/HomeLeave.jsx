import { useMemo, useState } from "react";
import MainLayout from "../../components/MainLayout";
import TableRowActions from "../../components/TableRowActions";
import AddModal from "../../components/modals/AddModal";
import ConfirmModal from "../../components/modals/ConfirmModal";
import {
  addFormSchemas,
  buildRow,
} from "../../components/modals/addFormSchemas";
import { homeLeaveData as initialHomeLeaves } from "../../data/homeLeaves";

const PAGE_SIZE = 10;

const homeLeaveSchema = addFormSchemas.homeLeave;

export default function HomeLeave() {
  const [homeLeaveList, setHomeLeaveList] = useState(initialHomeLeaves);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const handleAddHomeLeave = (values) => {
    setHomeLeaveList((prev) => [...prev, buildRow(homeLeaveSchema, values)]);
    setCurrentPage(1);
  };

  const handleEditHomeLeave = (values) => {
    setHomeLeaveList((prev) =>
      prev.map((row) =>
        row === editingRow ? buildRow(homeLeaveSchema, values, row) : row,
      ),
    );
  };

  const handleDeleteHomeLeave = () => {
    setHomeLeaveList((prev) => prev.filter((row) => row !== deletingRow));
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

    setCurrentPage(1);
  };

  /*
   * SEARCH
   */
  const filteredHomeLeaves = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return homeLeaveList;

    return homeLeaveList.filter((homeLeave) =>
      [
        homeLeave.booking_id,
        homeLeave.name,
        homeLeave.started_at,
        homeLeave.ended_at,
        homeLeave.reason,
        homeLeave.approved_by,
      ].some((value) =>
        (value || "").toString().toLowerCase().includes(query),
      ),
    );
  }, [homeLeaveList, search]);

  /*
   * SORT
   */
  const sortedHomeLeaves = useMemo(() => {
    if (!sortConfig.key) return filteredHomeLeaves;

    return [...filteredHomeLeaves].sort((a, b) => {
      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "booking_id":
          aValue = a.booking_id;
          bValue = b.booking_id;
          break;

        case "name":
          aValue = a.name;
          bValue = b.name;
          break;

        case "started_at":
          aValue = a.started_at;
          bValue = b.started_at;
          break;

        case "ended_at":
          aValue = a.ended_at;
          bValue = b.ended_at;
          break;

        case "reason":
          aValue = a.reason;
          bValue = b.reason;
          break;

        case "approved_by":
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
  }, [filteredHomeLeaves, sortConfig]);

  /*
   * PAGINATION
   */
  const totalPages = Math.max(
    1,
    Math.ceil(sortedHomeLeaves.length / PAGE_SIZE),
  );

  const safePage = Math.min(currentPage, totalPages);

  const pagedHomeLeaves = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return sortedHomeLeaves.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedHomeLeaves, safePage]);

  const startRow =
    filteredHomeLeaves.length === 0
      ? 0
      : (safePage - 1) * PAGE_SIZE + 1;

  const endRow = Math.min(
    safePage * PAGE_SIZE,
    filteredHomeLeaves.length,
  );

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
            <h1 className="dashboard-header__title">Home Leaves</h1>

            <p className="dashboard-header__subtitle">
              View and manage home leave
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
              placeholder="Search by booking ID, name, reason, approver..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>
          <div className="bookings-toolbar__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsAddModalOpen(true)}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Create New Home Leave
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
                </tr>
              </thead>

              <tbody>
                {pagedHomeLeaves.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="muted">
                      No home leaves found.
                    </td>
                  </tr>
                ) : (
                  pagedHomeLeaves.map((homeLeave, index) => (
                    <tr key={homeLeave.booking_id}>
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      <td>
                        <strong>{homeLeave.booking_id || "-"}</strong>
                      </td>

                      <td>{homeLeave.name || "-"}</td>

                      <td>{homeLeave.started_at || "-"}</td>

                      <td>{homeLeave.ended_at || "-"}</td>

                      <td>{homeLeave.reason || "-"}</td>

                      <td>{homeLeave.approved_by || "-"}</td>

                      <td>
                        <TableRowActions
                          label="home leave"
                          rowLabel={homeLeave.name}
                          onView={() =>
                            console.log("View home leave:", homeLeave)
                          }
                          onEdit={() => setEditingRow(homeLeave)}
                          onDelete={() => setDeletingRow(homeLeave)}
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
              Showing {startRow}–{endRow} of {filteredHomeLeaves.length} home
              leaves
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
        <AddModal
          schema={homeLeaveSchema}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddHomeLeave}
        />
      )}

      {editingRow && (
        <AddModal
          schema={homeLeaveSchema}
          mode="edit"
          initialValues={editingRow}
          onClose={() => setEditingRow(null)}
          onSubmit={handleEditHomeLeave}
        />
      )}

      {deletingRow && (
        <ConfirmModal
          title="Delete Home Leave"
          message={`Delete the home leave for ${deletingRow.name || "this resident"}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onClose={() => setDeletingRow(null)}
          onConfirm={handleDeleteHomeLeave}
        />
      )}
    </MainLayout>
  );
}