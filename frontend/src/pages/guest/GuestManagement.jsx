import { useMemo, useState } from "react";
import MainLayout from "../../components/MainLayout";
import TableRowActions from "../../components/TableRowActions";
import AddModal from "../../components/modals/AddModal";
import ConfirmModal from "../../components/modals/ConfirmModal";
import { addFormSchemas, buildRow } from "../../components/modals/addFormSchemas";

import { guests as initialGuests } from "../../data/guest";
import FlexibleButton from "../../components/FlexibleButtons";




const PAGE_SIZE = 10;

const residentSchema = addFormSchemas.resident;

export default function GuestManagement() {
  const [guests, setGuests] = useState(initialGuests);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const handleAddResident = (values) => {
    setGuests((prev) => [...prev, buildRow(residentSchema, values)]);
    setCurrentPage(1);
  };

  const handleEditResident = (values) => {
    setGuests((prev) =>
      prev.map((row) =>
        row === editingRow ? buildRow(residentSchema, values, row) : row,
      ),
    );
  };

  const handleDeleteResident = () => {
    setGuests((prev) => prev.filter((row) => row !== deletingRow));
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

    setCurrentPage(1);
  };

  const filteredGuests = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return guests;

    return guests.filter((guest) =>
      [
        guest.name,
        guest.email,
        guest.phone,
        guest.gender,
        guest.country,
        guest.site,
        guest.dept,
        guest.meal_type,
      ].some((value) => (value || "").toString().toLowerCase().includes(query)),
    );
  }, [guests, search]);

  const sortedGuests = useMemo(() => {
    if (!sortConfig.key) return filteredGuests;

    return [...filteredGuests].sort((a, b) => {
      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "name":
          aValue = a.name;
          bValue = b.name;
          break;

        case "gender":
          aValue = a.gender;
          bValue = b.gender;
          break;

        case "country":
          aValue = a.country;
          bValue = b.country;
          break;

        case "dept":
          aValue = a.dept;
          bValue = b.dept;
          break;

        case "meal_type":
          aValue = a.meal_type;
          bValue = b.meal_type;
          break;
        
        case "site":
          aValue = a.site;
          bValue = b.site;
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
  }, [filteredGuests, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedGuests.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const pagedGuests = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return sortedGuests.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedGuests, safePage]);

  const startRow =
    filteredGuests.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(safePage * PAGE_SIZE, filteredGuests.length);

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
            <h1 className="dashboard-header__title">Resident Management </h1>

            <p className="dashboard-header__subtitle">
              View and manage residents
            </p>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search residents"
              placeholder="Search by name, email, gender, country, dept, meal types..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <FlexibleButton

              permission="resident-manage"
              className="btn btn-primary"
              onClick={() => setIsAddModalOpen(true)}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Add New Resident
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
                  <th className="table-col-no">No</th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("name")}
                    >
                      Name
                      <i className="bi bi-sort-alpha-down" column="name">
                        {" "}
                      </i>
                    </button>
                  </th>
                  <th>email</th>
                  <th>phone</th>

                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("gender")}
                    >
                      Gender
                      <i className="bi bi-sort-alpha-down" column="gender">
                        {" "}
                      </i>
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
                      onClick={() => handleSort("site")}
                    >
                      Site
                      <i className="bi bi-sort-alpha-down" column="site"></i>
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("dept")}
                    >
                      Dept
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
                  
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {pagedGuests.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="muted">
                      No residents found.
                    </td>
                  </tr>
                ) : (
                  pagedGuests.map((guests, index) => (
                    <tr key={`${index}`}>
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                     

                      <td>{guests.name || "-"}</td>
                      
                      <td>{guests.email || "-"}</td>
                      
                      <td>{guests.phone || "-"}</td>

                      <td>{guests.gender || "-"}</td>

                      <td>{guests.country || "-"}</td>
                      
                      <td>{guests.site || "-"}</td>

                      <td>{guests.dept || "-"}</td>

                      <td>{guests.meal_type || "-"}</td>

                      

                      <td>
                        <TableRowActions
                          label="resident"
                          rowLabel={guests.name}
                          onEdit={() => setEditingRow(guests)}
                          onDelete={() => setDeletingRow(guests)}
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
              Showing {startRow}–{endRow} of {filteredGuests.length} residents
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

      {/*
       * Rendered outside the dashboard so the
       * fixed overlay is never clipped by the
       * table scroll container
       */}
      {isAddModalOpen && (
        <AddModal
          schema={residentSchema}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddResident}
        />
      )}

      {editingRow && (
        <AddModal
          schema={residentSchema}
          mode="edit"
          initialValues={editingRow}
          onClose={() => setEditingRow(null)}
          onSubmit={handleEditResident}
        />
      )}

      {deletingRow && (
        <ConfirmModal
          title="Delete Resident"
          message={`Delete ${deletingRow.name || "this resident"}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onClose={() => setDeletingRow(null)}
          onConfirm={handleDeleteResident}
        />
      )}
    </MainLayout>
  );
}
