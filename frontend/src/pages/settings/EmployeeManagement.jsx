import MainLayout from "../../components/MainLayout";
import { useEffect, useMemo, useState } from "react";
import TableRowActions from "../../components/TableRowActions";
import AddModal from "../../components/modals/AddModal";
import ConfirmModal from "../../components/modals/ConfirmModal";
import apiRequest from "../../api/client";

const PAGE_SIZE = 10;

function buildEmployeeSchema({ isEdit, siteOptions, roleOptions }) {
  return {
    entity: "Employee",
    title: "Add Employee",
    submitLabel: "Add Employee",
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        placeholder: "Full name",
        required: true,
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        placeholder: "Email address",
        required: true,
      },
      {
        name: "password",
        label: "Password",
        type: "password",
        placeholder: isEdit
          ? "Leave blank to keep current password"
          : "Minimum 8 characters",
        required: !isEdit,
      },
      {
        name: "siteId",
        label: "Site",
        type: "select",
        options: siteOptions,
      },
      {
        name: "roleId",
        label: "Role",
        type: "select",
        options: roleOptions,
        required: true,
      },
    ],
  };
}

function getEmail(employee) {
  return employee.user?.email || "-";
}

function getSiteName(employee) {
  return employee.site?.name || "-";
}

function getRoleNames(employee) {
  return (
    (employee.roles ?? [])
      .map((item) => item.role?.name)
      .filter(Boolean)
      .join(", ") || "-"
  );
}

function toEmployeeFormValues(employee) {
  return {
    name: employee.name ?? "",
    email: employee.user?.email ?? "",
    password: "",
    siteId: employee.siteId ?? "",
    roleId: employee.roles?.[0]?.role?.id ?? "",
  };
}

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [sites, setSites] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let isActive = true;

    Promise.all([
      apiRequest("/api/employee"),
      apiRequest("/api/site"),
      apiRequest("/api/role"),
    ])
      .then(([employeeData, siteData, roleData]) => {
        if (!isActive) return;
        setEmployees(employeeData.data ?? []);
        setSites(siteData.data ?? []);
        setRoles(
          (roleData.data ?? []).filter((role) => role.name !== "superadmin"),
        );
      })
      .catch((err) => {
        if (!isActive) return;
        setError(err.message || "Failed to load employees");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const siteOptions = useMemo(
    () => [
      { value: "", label: "Select site" },
      ...sites.map((site) => ({ value: site.id, label: site.name })),
    ],
    [sites],
  );

  const roleOptions = useMemo(
    () => [
      { value: "", label: "Select role" },
      ...roles.map((role) => ({ value: role.id, label: role.name })),
    ],
    [roles],
  );

  const addSchema = useMemo(
    () => buildEmployeeSchema({ isEdit: false, siteOptions, roleOptions }),
    [siteOptions, roleOptions],
  );

  const editSchema = useMemo(
    () => buildEmployeeSchema({ isEdit: true, siteOptions, roleOptions }),
    [siteOptions, roleOptions],
  );

  const handleAddEmployee = async (values) => {
    setError("");

    try {
      const data = await apiRequest("/api/employee", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
          ...(values.siteId ? { siteId: values.siteId } : {}),
          roleIds: values.roleId ? [values.roleId] : [],
        }),
      });

      setEmployees((prev) => [...prev, data.data]);
      setCurrentPage(1);
    } catch (err) {
      setError(err.message || "Failed to create employee");
    }
  };

  const handleEditEmployee = async (values) => {
    setError("");

    try {
      const data = await apiRequest(`/api/employee/${editingRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          ...(values.password ? { password: values.password } : {}),
          ...(values.siteId ? { siteId: values.siteId } : {}),
          roleIds: values.roleId ? [values.roleId] : [],
        }),
      });

      setEmployees((prev) =>
        prev.map((row) => (row.id === editingRow.id ? data.data : row)),
      );
    } catch (err) {
      setError(err.message || "Failed to update employee");
    }
  };

  const handleDeleteEmployee = async () => {
    setError("");

    try {
      await apiRequest(`/api/employee/${deletingRow.id}`, { method: "DELETE" });

      setEmployees((prev) => prev.filter((row) => row.id !== deletingRow.id));
    } catch (err) {
      setError(err.message || "Failed to delete employee");
    }
  };

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return employees;

    return employees.filter((employee) =>
      [
        employee.name,
        getSiteName(employee),
        getRoleNames(employee),
        getEmail(employee),
      ].some((value) => (value || "").toString().toLowerCase().includes(query)),
    );
  }, [employees, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEmployees.length / PAGE_SIZE),
  );
  const safePage = Math.min(currentPage, totalPages);

  const pagedEmployees = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return filteredEmployees.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredEmployees, safePage]);

  const startRow =
    filteredEmployees.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(safePage * PAGE_SIZE, filteredEmployees.length);

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Employee Management</h1>
            <p className="dashboard-header__subtitle">
              Manage employees, their site, and assigned roles
            </p>
          </div>
        </div>

        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search employee"
              placeholder="Search by name, site, role, email..."
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
              Add New Employee
            </button>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => console.log("Export Excel")}
            >
              <i className="bi bi-file-earmark-excel" aria-hidden="true" />
              Export Excel
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
                  <th>Site</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="muted">
                      Loading employees...
                    </td>
                  </tr>
                ) : pagedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="muted">
                      No employee found.
                    </td>
                  </tr>
                ) : (
                  pagedEmployees.map((employee, index) => (
                    <tr key={employee.id}>
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      <td>
                        {employee.name || "-"}
                      </td>

                      <td>{getSiteName(employee)}</td>

                      <td>{getRoleNames(employee)}</td>

                      <td>{getEmail(employee)}</td>

                      <td>
                        <TableRowActions
                          label="employee"
                          rowLabel={employee.name}
                          onEdit={() => setEditingRow(employee)}
                          onDelete={() => setDeletingRow(employee)}
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
              Showing {startRow}–{endRow} of {filteredEmployees.length} employees
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
          schema={addSchema}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddEmployee}
        />
      )}

      {editingRow && (
        <AddModal
          schema={editSchema}
          mode="edit"
          initialValues={toEmployeeFormValues(editingRow)}
          onClose={() => setEditingRow(null)}
          onSubmit={handleEditEmployee}
        />
      )}

      {deletingRow && (
        <ConfirmModal
          title="Delete Employee"
          message={`Delete ${deletingRow.name || "this employee"}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onClose={() => setDeletingRow(null)}
          onConfirm={handleDeleteEmployee}
        />
      )}
    </MainLayout>
  );
}
