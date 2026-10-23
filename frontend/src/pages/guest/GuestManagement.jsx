import { useCallback, useEffect, useMemo, useState } from "react";
import MainLayout from "../../components/MainLayout";
import TableRowActions from "../../components/TableRowActions";
import AddModal from "../../components/modals/AddModal";
import ConfirmModal from "../../components/modals/ConfirmModal";
import ExportModal from "../../components/modals/ExportModal";
import ImportModal from "../../components/modals/ImportModal";
import apiRequest from "../../api/client";
import FlexibleButton from "../../components/FlexibleButtons";

const PAGE_SIZE = 10;

const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const MEAL_TYPE_OPTIONS = [
  { value: "REGULAR", label: "Regular" },
  { value: "VEGETARIAN", label: "Vegetarian" },
  { value: "HALAL", label: "Halal" },
  { value: "OTHER", label: "Other" },
];

const GENDER_LABELS = Object.fromEntries(
  GENDER_OPTIONS.map((option) => [option.value, option.label]),
);

const MEAL_TYPE_LABELS = Object.fromEntries(
  MEAL_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

const SORT_GETTERS = {
  fullName: (resident) => resident.fullName,
  email: (resident) => resident.user?.email,
  phone: (resident) => resident.phone,
  gender: (resident) => resident.gender,
  nationality: (resident) => resident.nationality,
  mealType: (resident) => resident.mealType,
  company: (resident) => resident.company,
  department: (resident) => resident.department,
  title: (resident) => resident.title,
};

function getResidentList(response) {
  return Array.isArray(response?.residents) ? response.residents : [];
}

function getPagination(response, currentPage) {
  const pagination = response?.pagination ?? {};
  const total = Number(pagination.total ?? 0);

  return {
    page: Number(pagination.page ?? currentPage),
    pageSize: Number(pagination.pageSize ?? PAGE_SIZE),
    total,
    totalPages: Math.max(
      1,
      Number(pagination.totalPages ?? Math.ceil(total / PAGE_SIZE)),
    ),
  };
}

function buildResidentSchema({ isEdit, siteOptions }) {
  return {
    entity: "Resident",
    title: "Add Resident",
    submitLabel: "Add Resident",
    fields: [
      {
        name: "fullName",
        label: "Full Name",
        type: "text",
        placeholder: "Full name",
        required: true,
      },
      ...(isEdit
        ? []
        : [
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
              placeholder: "Minimum 8 characters",
              required: true,
            },
          ]),
      {
        name: "siteId",
        label: "Site",
        type: "select",
        options: siteOptions,
        required: true,
      },
      ...(isEdit
        ? []
        : [
            {
              name: "phone",
              label: "Phone",
              type: "tel",
              placeholder: "Phone number",
              required: true,
            },
            {
              name: "gender",
              label: "Gender",
              type: "select",
              options: GENDER_OPTIONS,
              required: true,
            },
          ]),
      {
        name: "nationality",
        label: "Nationality",
        type: "text",
        placeholder: "Nationality",
      },
      {
        name: "mealType",
        label: "Meal Type",
        type: "text",
        
        required: true,
      },
      {
        name: "company",
        label: "Company",
        type: "text",
        placeholder: "Company",
      },
      {
        name: "department",
        label: "Department",
        type: "text",
        placeholder: "Department",
      },
      {
        name: "title",
        label: "Title",
        type: "text",
        placeholder: "Title",
      },
    ],
  };
}

function toResidentFormValues(resident) {
  return {
    fullName: resident.fullName ?? "",
    siteId: resident.siteId ?? "",
    nationality: resident.nationality ?? "",
    mealType: resident.mealType ?? "",
    company: resident.company ?? "",
    department: resident.department ?? "",
    title: resident.title ?? "",
  };
}

export default function GuestManagement() {
  const [residents, setResidents] = useState([]);
  const [sites, setSites] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const loadSites = useCallback(async () => {
    try {
      const response = await apiRequest("/api/site");
      setSites(response?.data ?? []);
    } catch (err) {
      setError(err.message || "Failed to load sites");
    }
  }, []);

  const loadResidents = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
        search: search.trim(),
      });

      const response = await apiRequest(`/api/resident?${params.toString()}`);
      const pageInfo = getPagination(response, currentPage);

      setResidents(getResidentList(response));
      setPagination(pageInfo);

      // Protect against a stale page after deletion or filtering.
      if (pageInfo.totalPages > 0 && currentPage > pageInfo.totalPages) {
        setCurrentPage(pageInfo.totalPages);
      }
    } catch (err) {
      setError(err.message || "Failed to load residents");
      setResidents([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadResidents();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadResidents]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadSites();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSites]);

  const siteOptions = useMemo(
    () => [
      { value: "", label: "Select site" },
      ...sites.map((site) => ({ value: site.id, label: site.name })),
    ],
    [sites],
  );

  const exportFilterFields = useMemo(
    () => [
      {
        name: "search",
        label: "Search",
        type: "search",
        placeholder: "Name, email, phone, company, department...",
      },
      {
        name: "siteId",
        label: "Site",
        type: "select",
        placeholderOption: "All sites",
        options: sites.map((site) => ({
          value: site.id,
          label: site.name,
        })),
      },
    ],
    [sites],
  );

  const addSchema = useMemo(
    () => buildResidentSchema({ isEdit: false, siteOptions }),
    [siteOptions],
  );

  const editSchema = useMemo(
    () => buildResidentSchema({ isEdit: true, siteOptions }),
    [siteOptions],
  );

  const handleAddResident = async (values) => {
    setError("");

    try {
      await apiRequest("/api/resident", {
        method: "POST",
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          siteId: values.siteId,
          fullName: values.fullName,
          phone: values.phone,
          gender: values.gender,
          nationality: values.nationality,
          mealType: values.mealType,
          company: values.company,
          department: values.department,
          title: values.title,
        }),
      });

      setIsAddModalOpen(false);
      setCurrentPage(1);

      // Refresh explicitly because the page may not have changed.
      if (currentPage === 1) {
        await loadResidents();
      }
    } catch (err) {
      setError(err.message || "Failed to create resident");
    }
  };

  const handleEditResident = async (values) => {
    setError("");

    try {
      await apiRequest(`/api/resident/${editingRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: values.fullName,
          siteId: values.siteId,
          nationality: values.nationality,
          mealType: values.mealType,
          company: values.company,
          department: values.department,
          title: values.title,
        }),
      });

      setEditingRow(null);
      await loadResidents();
    } catch (err) {
      setError(err.message || "Failed to update resident");
    }
  };

  const handleDeleteResident = async () => {
    setError("");

    try {
      await apiRequest(`/api/resident/${deletingRow.id}`, { method: "DELETE" });

      setDeletingRow(null);

      // Reload the previous page if its last resident was deactivated.
      if (residents.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        await loadResidents();
      }
    } catch (err) {
      setError(err.message || "Failed to deactivate resident");
    }
  };

  const handleResidentsImported = async () => {
    setError("");
    setCurrentPage(1);

    // Reload explicitly because the page may not have changed.
    if (currentPage === 1) {
      await loadResidents();
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Sorting applies to the current server-returned page.
  const sortedResidents = useMemo(() => {
    const getValue = SORT_GETTERS[sortConfig.key];

    if (!getValue) return residents;

    return [...residents].sort((a, b) => {
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
  }, [residents, sortConfig]);

  const startRow =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.pageSize + 1;
  const endRow = Math.min(
    pagination.page * pagination.pageSize,
    pagination.total,
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
              placeholder="Search by name, email, phone, nationality, company, department..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <FlexibleButton
              permission="resident.manage"
              className="btn btn-primary"
              onClick={() => setIsAddModalOpen(true)}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Add New Resident
            </FlexibleButton>

            <FlexibleButton
              permission="resident.manage"
              className="btn btn-neutral"
              onClick={() => setIsImportModalOpen(true)}
            >
              <i className="bi bi-file-earmark-excel" aria-hidden="true" />
              Bulk Import
            </FlexibleButton>
            <FlexibleButton
              permission="resident.export"
              className="btn btn-neutral"
              onClick={() => setIsExportModalOpen(true)}
            >
              <i className="bi bi-file-earmark-excel" aria-hidden="true" />
              Export Excel
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
                  <th className="table-col-no">No</th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("fullName")}
                    >
                      Full Name
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("email")}
                    >
                      Email
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("phone")}
                    >
                      Phone
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
                      onClick={() => handleSort("nationality")}
                    >
                      Nationality
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("mealType")}
                    >
                      Meal Type
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("company")}
                    >
                      Company
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
                      onClick={() => handleSort("title")}
                    >
                      Title
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="11" className="muted">
                      Loading residents...
                    </td>
                  </tr>
                ) : sortedResidents.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="muted">
                      No residents found.
                    </td>
                  </tr>
                ) : (
                  sortedResidents.map((resident, index) => (
                    <tr key={resident.id}>
                      <td className="table-col-no">{startRow + index}</td>

                      <td>{resident.fullName || "-"}</td>

                      <td>{resident.user?.email || "-"}</td>

                      <td>{resident.phone || "-"}</td>

                      <td>{GENDER_LABELS[resident.gender] || resident.gender || "-"}</td>

                      <td>{resident.nationality || "-"}</td>

                      <td>{MEAL_TYPE_LABELS[resident.mealType] || resident.mealType || "-"}</td>

                      <td>{resident.company || "-"}</td>

                      <td>{resident.department || "-"}</td>

                      <td>{resident.title || "-"}</td>

                      <td>
                        <TableRowActions
                          label="resident"
                          rowLabel={resident.fullName}
                          permission="resident.manage"
                          onEdit={() => setEditingRow(resident)}
                          onDelete={() => setDeletingRow(resident)}
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
              Showing {startRow}–{endRow} of {pagination.total} residents
            </span>

            <div className="office-page-nav">
              <button
                type="button"
                className="btn btn-neutral"
                disabled={isLoading || pagination.page <= 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
        <AddModal
          schema={addSchema}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddResident}
        />
      )}

      {isImportModalOpen && (
        <ImportModal
          title="Bulk Import Residents"
          templatePath="/excel/resident_import_template.xlsx"
          templateHint="Download the template, add your residents, then upload the completed .xlsx file."
          endpoint="/api/resident/import"
          entityLabel="Residents"
          successMessage={(result) =>
            `${result.importedResidents ?? 0} resident(s) imported successfully.`
          }
          onClose={() => setIsImportModalOpen(false)}
          onImported={handleResidentsImported}
        />
      )}

      {isExportModalOpen && (
        <ExportModal
          title="Export Residents"
          endpoint="/api/resident/export"
          filename={`residents-${new Date().toISOString().slice(0, 10)}.xlsx`}
          entityLabel="residents"
          filterFields={exportFilterFields}
          initialFilters={{ search }}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {editingRow && (
        <AddModal
          schema={editSchema}
          mode="edit"
          initialValues={toResidentFormValues(editingRow)}
          onClose={() => setEditingRow(null)}
          onSubmit={handleEditResident}
        />
      )}

      {deletingRow && (
        <ConfirmModal
          title="Deactivate Resident"
          message={`Deactivate ${deletingRow.fullName || "this resident"}? Their login account will be disabled.`}
          confirmLabel="Deactivate"
          danger
          onClose={() => setDeletingRow(null)}
          onConfirm={handleDeleteResident}
        />
      )}
    </MainLayout>
  );
}
