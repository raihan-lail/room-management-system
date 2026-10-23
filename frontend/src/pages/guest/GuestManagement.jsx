import { useEffect, useMemo, useState } from "react";
import MainLayout from "../../components/MainLayout";
import TableRowActions from "../../components/TableRowActions";
import AddModal from "../../components/modals/AddModal";
import ConfirmModal from "../../components/modals/ConfirmModal";
import ImportModal from "../../components/modals/ImportModal";
import apiRequest from "../../api/client";
import FlexibleButton from "../../components/FlexibleButtons";

const PAGE_SIZE = 10;
const FETCH_PAGE_SIZE = 100;

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

async function fetchAllResidents() {
  const firstPage = await apiRequest(
    `/api/resident?page=1&pageSize=${FETCH_PAGE_SIZE}`,
  );

  const residents = firstPage.residents ?? [];
  const totalPages = firstPage.pagination?.totalPages ?? 1;

  if (totalPages <= 1) return residents;

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      apiRequest(
        `/api/resident?page=${index + 2}&pageSize=${FETCH_PAGE_SIZE}`,
      ),
    ),
  );

  return remainingPages.reduce(
    (rows, page) => [...rows, ...(page.residents ?? [])],
    residents,
  );
}

export default function GuestManagement() {
  const [residents, setResidents] = useState([]);
  const [sites, setSites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  useEffect(() => {
    let isActive = true;

    Promise.all([
      fetchAllResidents(),
      apiRequest("/api/site").catch(() => ({ data: [] })),
    ])
      .then(([residentData, siteData]) => {
        if (!isActive) return;

        setResidents(
          residentData.filter((resident) => resident.user?.isActive !== false),
        );
        setSites(siteData.data ?? []);
      })
      .catch((err) => {
        if (!isActive) return;
        setError(err.message || "Failed to load residents");
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
      const data = await apiRequest("/api/resident", {
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

      setResidents((prev) => [...prev, data.resident]);
      setCurrentPage(1);
    } catch (err) {
      setError(err.message || "Failed to create resident");
    }
  };

  const handleEditResident = async (values) => {
    setError("");

    try {
      const data = await apiRequest(`/api/resident/${editingRow.id}`, {
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

      setResidents((prev) =>
        prev.map((row) => (row.id === editingRow.id ? data.resident : row)),
      );
    } catch (err) {
      setError(err.message || "Failed to update resident");
    }
  };

  const handleDeleteResident = async () => {
    setError("");

    try {
      await apiRequest(`/api/resident/${deletingRow.id}`, { method: "DELETE" });

      setResidents((prev) => prev.filter((row) => row.id !== deletingRow.id));
    } catch (err) {
      setError(err.message || "Failed to deactivate resident");
    }
  };

  const handleResidentsImported = async () => {
    setError("");

    try {
      const residentData = await fetchAllResidents();

      setResidents(
        residentData.filter((resident) => resident.user?.isActive !== false),
      );
      setSearch("");
      setCurrentPage(1);
    } catch (err) {
      setError(err.message || "Failed to reload residents");
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

    setCurrentPage(1);
  };

  const filteredResidents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return residents;

    return residents.filter((resident) =>
      [
        resident.fullName,
        resident.user?.email,
        resident.phone,
        resident.gender,
        resident.nationality,
        resident.mealType,
        resident.company,
        resident.department,
        resident.title,
      ].some((value) => (value || "").toString().toLowerCase().includes(query)),
    );
  }, [residents, search]);

  const sortedResidents = useMemo(() => {
    const getValue = SORT_GETTERS[sortConfig.key];

    if (!getValue) return filteredResidents;

    return [...filteredResidents].sort((a, b) => {
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
  }, [filteredResidents, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedResidents.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const pagedResidents = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return sortedResidents.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedResidents, safePage]);

  const startRow =
    filteredResidents.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(safePage * PAGE_SIZE, filteredResidents.length);

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
                ) : pagedResidents.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="muted">
                      No residents found.
                    </td>
                  </tr>
                ) : (
                  pagedResidents.map((resident, index) => (
                    <tr key={resident.id}>
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

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
              Showing {startRow}–{endRow} of {filteredResidents.length} residents
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
