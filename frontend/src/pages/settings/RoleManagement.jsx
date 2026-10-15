import MainLayout from "../../components/MainLayout";
import { useEffect, useMemo, useState } from "react";
import TableRowActions from "../../components/TableRowActions";
import AddModal from "../../components/modals/AddModal";
import ConfirmModal from "../../components/modals/ConfirmModal";
import { addFormSchemas } from "../../components/modals/addFormSchemas";
import apiRequest from "../../api/client";
import FlexibleButton from "../../components/FlexibleButtons";


const PAGE_SIZE = 10;

const roleSchema = addFormSchemas.role;

export default function RoleManagement() {
  const [roleList, setRoleList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let isActive = true;

    apiRequest("/api/role")
      .then((data) => {
        if (!isActive) return;
        setRoleList(data.data ?? []);
      })
      .catch((err) => {
        if (!isActive) return;
        setError(err.message || "Failed to load roles");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const handleAddRole = async (values) => {
    setError("");

    try {
      const data = await apiRequest("/api/role", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          description: values.description || null,
        }),
      });

      setRoleList((prev) => [...prev, data.data]);
      setCurrentPage(1);
    } catch (err) {
      setError(err.message || "Failed to create role");
    }
  };

  const handleEditRole = async (values) => {
    setError("");

    try {
      const data = await apiRequest(`/api/role/${editingRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          description: values.description || null,
        }),
      });

      setRoleList((prev) =>
        prev.map((row) => (row.id === editingRow.id ? data.data : row)),
      );
    } catch (err) {
      setError(err.message || "Failed to update role");
    }
  };

  const handleDeleteRole = async () => {
    setError("");

    try {
      await apiRequest(`/api/role/${deletingRow.id}`, { method: "DELETE" });

      setRoleList((prev) => prev.filter((row) => row.id !== deletingRow.id));
    } catch (err) {
      setError(err.message || "Failed to delete role");
    }
  };

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return roleList;

    return roleList.filter((role) =>
      [role.name, role.description].some((value) =>
        (value || "").toString().toLowerCase().includes(query),
      ),
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
              Manage roles and their descriptions
            </p>
          </div>
        </div>

         <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search role"
              placeholder="Search by name, description..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <FlexibleButton
              permission="roles.manage"
              className="btn btn-primary"
              onClick={() => setIsAddModalOpen(true)}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Add New Role
            </FlexibleButton>

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

        {error && <p className="error-text">{error}</p>}

         <section className="table-card content">
          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th className="table-col-no">No</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="4" className="muted">
                      Loading roles...
                    </td>
                  </tr>
                ) : filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="muted">
                      No role found.
                    </td>
                  </tr>
                ) : (
                  pagedRoles.map((role, index) => (
                    <tr
                      key={role.id}
                    >
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      <td>
                        {role.name || "-"}
                      </td>

                      <td>{role.description || "-"}</td>

                      <td>
                        <TableRowActions
                          label="role"
                          rowLabel={role.name}
                          onEdit={() => setEditingRow(role)}
                          onDelete={() => setDeletingRow(role)}
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
          schema={roleSchema}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddRole}
        />
      )}

      {editingRow && (
        <AddModal
          schema={roleSchema}
          mode="edit"
          initialValues={editingRow}
          onClose={() => setEditingRow(null)}
          onSubmit={handleEditRole}
        />
      )}

      {deletingRow && (
        <ConfirmModal
          title="Delete Role"
          message={`Delete ${deletingRow.name || "this role"}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onClose={() => setDeletingRow(null)}
          onConfirm={handleDeleteRole}
        />
      )}
    </MainLayout>
  );
}
