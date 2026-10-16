import MainLayout from "../../components/MainLayout";
import { useEffect, useMemo, useState } from "react";
import TableRowActions from "../../components/TableRowActions";
import AddModal from "../../components/modals/AddModal";
import ConfirmModal from "../../components/modals/ConfirmModal";
import apiRequest from "../../api/client";
import FlexibleButton from "../../components/FlexibleButtons";

const PAGE_SIZE = 10;

const siteSchema = {
  entity: "Site",
  title: "Add Site",
  submitLabel: "Add Site",
  fields: [
    {
      name: "name",
      label: "Site Name",
      type: "text",
      placeholder: "Site name",
      required: true,
    },
    {
      name: "code",
      label: "Site Code",
      type: "text",
      placeholder: "Site code",
      required: true,
    },
    {
      name: "description",
      label: "Description",
      type: "text",
      placeholder: "Description (optional)",
    },
  ],
};

export default function SiteManagement() {
  const [siteList, setSiteList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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

    apiRequest("/api/site")
      .then((data) => {
        if (!isActive) return;
        setSiteList(data.data ?? []);
      })
      .catch((err) => {
        if (!isActive) return;
        setError(err.message || "Failed to load sites");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const handleAddSite = async (values) => {
    setError("");

    try {
      const data = await apiRequest("/api/site", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          code: values.code,
          description: values.description || null,
        }),
      });

      setSiteList((prev) => [...prev, data.data]);
      setCurrentPage(1);
    } catch (err) {
      setError(err.message || "Failed to create site");
    }
  };

  const handleEditSite = async (values) => {
    setError("");

    try {
      const data = await apiRequest(`/api/site/${editingRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          code: values.code,
          description: values.description || null,
        }),
      });

      setSiteList((prev) =>
        prev.map((row) => (row.id === editingRow.id ? data.data : row)),
      );
    } catch (err) {
      setError(err.message || "Failed to update site");
    }
  };

  const handleDeleteSite = async () => {
    setError("");

    try {
      await apiRequest(`/api/site/${deletingRow.id}`, { method: "DELETE" });

      setSiteList((prev) => prev.filter((row) => row.id !== deletingRow.id));
    } catch (err) {
      setError(err.message || "Failed to delete site");
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const filteredSites = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return siteList;

    return siteList.filter((site) =>
      [site.name, site.code, site.description].some((value) =>
        (value || "").toString().toLowerCase().includes(query),
      ),
    );
  }, [siteList, search]);

  const sortedSites = useMemo(() => {
    if (!sortConfig.key) return filteredSites;

    return [...filteredSites].sort((a, b) => {
      const aValue = (a[sortConfig.key] || "").toString().toLowerCase();
      const bValue = (b[sortConfig.key] || "").toString().toLowerCase();

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredSites, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredSites.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const pagedSites = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return sortedSites.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedSites, safePage]);

  const startRow =
    filteredSites.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(safePage * PAGE_SIZE, filteredSites.length);

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Site Management</h1>
            <p className="dashboard-header__subtitle">
              Manage sites and their details
            </p>
          </div>
        </div>

        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search sites"
              placeholder="Search by site name, code, or description..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <FlexibleButton
              permission="site.manage"
              className="btn btn-primary"
              onClick={() => setIsAddModalOpen(true)}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Add New Site
            </FlexibleButton>

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
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("name")}
                    >
                      Site Name
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("code")}
                    >
                      Code
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
                  <th>Description</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="muted">
                      Loading sites...
                    </td>
                  </tr>
                ) : pagedSites.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="muted">
                      No sites found.
                    </td>
                  </tr>
                ) : (
                  pagedSites.map((site, index) => (
                    <tr key={site.id}>
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      <td>
                        <strong>{site.name || "-"}</strong>
                      </td>

                      <td>{site.code || "-"}</td>

                      <td>{site.description || "-"}</td>

                      <td>
                        <TableRowActions
                          label="site"
                          rowLabel={site.name}
                          onEdit={() => setEditingRow(site)}
                          onDelete={() => setDeletingRow(site)}
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
              Showing {startRow}–{endRow} of {filteredSites.length} sites
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
          schema={siteSchema}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddSite}
        />
      )}

      {editingRow && (
        <AddModal
          schema={siteSchema}
          mode="edit"
          initialValues={editingRow}
          onClose={() => setEditingRow(null)}
          onSubmit={handleEditSite}
        />
      )}

      {deletingRow && (
        <ConfirmModal
          title="Delete Site"
          message={`Delete ${deletingRow.name || "this site"}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onClose={() => setDeletingRow(null)}
          onConfirm={handleDeleteSite}
        />
      )}
    </MainLayout>
  );
}
