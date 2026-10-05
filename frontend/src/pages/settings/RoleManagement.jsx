import MainLayout from "../../components/MainLayout";
import { useMemo, useState } from "react";
import AddModal from "../../components/modals/AddModal";
import {
  addFormSchemas,
  buildRow,
} from "../../components/modals/addFormSchemas";

import { roles as initialRoles } from "../../data/roles";


const PAGE_SIZE = 10;

const roleSchema = addFormSchemas.role;

export default function RoleManagement() {
  const [roleList, setRoleList] = useState(initialRoles);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");

  const handleAddRole = (values) => {
    setRoleList((prev) => [...prev, buildRow(roleSchema, values)]);
    setCurrentPage(1);
  };

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return roleList;

    return roleList.filter((role) =>
      [
       
       role.name,
       role.site
      ].some((value) => (value || "").toString().toLowerCase().includes(query)),
    );
  }, [roleList, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRoles.length / PAGE_SIZE),
  );
  const safePage = Math.min(currentPage, totalPages);

  const pagedRoles = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return filteredRoles.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRoles, safePage]);

  const startRow =
    filteredRoles.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(safePage * PAGE_SIZE, filteredRoles.length);

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };
  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Role Management</h1>
            <p className="dashboard-header__subtitle">
              Manage Roles for Each Site
            </p>
          </div>
        </div>

         <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search role"
              placeholder="Search by name, site..."
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
              Add New Role
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


         <section className="table-card content">
          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th className="table-col-no">No</th>
                  <th>Name</th>
                  <th>Site</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {pagedRoles.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="muted">
                      No role found.
                    </td>
                  </tr>
                ) : (
                  pagedRoles.map((role, index) => (
                    <tr
                      key={`${index}`}
                    >
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      <td>
                        {role.name || "-"}
                      </td>

                      <td>{role.site}</td>

                     
                     

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-neutral"
                            
                          >
                            <i
                              className="bi bi-eye"
                              aria-hidden="true"
                            />
                          </button>

                          <button
                            type="button"
                            className="btn btn-neutral"
                           
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
              Showing {startRow}–{endRow} of {filteredRoles.length} roles
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

      {isAddModalOpen && (
        <AddModal
          title={roleSchema.title}
          submitLabel={roleSchema.submitLabel}
          fields={roleSchema.fields}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddRole}
        />
      )}
    </MainLayout>
  );
}
