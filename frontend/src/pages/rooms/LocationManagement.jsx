
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import MainLayout from "../../components/MainLayout";
import TableRowActions from "../../components/TableRowActions";
import ConfirmModal from "../../components/modals/ConfirmModal";
import apiRequest from "../../api/client";

const PAGE_SIZE = 10;

const emptyFloor = () => ({
  name: "",
  floorNumber: "",
  description: "",
});

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d5dbe5",
  borderRadius: "6px",
  boxSizing: "border-box",
};

const fieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  marginBottom: "14px",
};

export default function LocationManagement() {
  const [locations, setLocations] = useState([]);
  const [sites, setSites] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });

  const [expandedLocations, setExpandedLocations] = useState([]);
  const [modalMode, setModalMode] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [editingFloor, setEditingFloor] = useState(null);
  const [deletingTarget, setDeletingTarget] = useState(null);

  const [locationForm, setLocationForm] = useState({
    siteId: "",
    name: "",
    description: "",
    floors: [emptyFloor()],
  });

  const [floorForm, setFloorForm] = useState(emptyFloor());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [locationResponse, siteResponse] = await Promise.all([
        apiRequest("/api/location"),
        apiRequest("/api/site"),
      ]);

      const locationData = locationResponse.data ?? [];
      const siteData = siteResponse.data ?? [];

      setLocations(locationData);
      setSites(siteData);

      setLocationForm((previous) => ({
        ...previous,
        siteId: previous.siteId || siteData[0]?.id || "",
      }));
    } catch (err) {
      setError(err.message || "Failed to load locations and sites.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  const timer = window.setTimeout(() => {
    loadData();
  }, 0);

  return () => window.clearTimeout(timer);
}, [loadData]);

  const filteredLocations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return locations.filter((location) => {
      if (!query) return true;

      const values = [
        location.name,
        location.description,
        location.site?.name,
        ...(location.floors ?? []).map((floor) => floor.name),
      ];

      return values.some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );
    });
  }, [locations, search]);

  const sortedLocations = useMemo(() => {
    if (!sortConfig.key) return filteredLocations;

    return [...filteredLocations].sort((a, b) => {
      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "site":
          aValue = a.site?.name ?? "";
          bValue = b.site?.name ?? "";
          break;
        case "floors":
          aValue = a.floors?.length ?? 0;
          bValue = b.floors?.length ?? 0;
          break;
        default:
          aValue = a.name ?? "";
          bValue = b.name ?? "";
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortConfig.direction === "asc"
          ? aValue - bValue
          : bValue - aValue;
      }

      const comparison = String(aValue).localeCompare(String(bValue));

      return sortConfig.direction === "asc"
        ? comparison
        : -comparison;
    });
  }, [filteredLocations, sortConfig]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedLocations.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const pagedLocations = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedLocations.slice(start, start + PAGE_SIZE);
  }, [sortedLocations, safePage]);

  const startRow =
    sortedLocations.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;

  const endRow = Math.min(
    safePage * PAGE_SIZE,
    sortedLocations.length
  );

  function handleSort(key) {
    setSortConfig((previous) => ({
      key,
      direction:
        previous.key === key && previous.direction === "asc"
          ? "desc"
          : "asc",
    }));

    setCurrentPage(1);
  }

  function toggleLocationExpanded(locationId) {
    setExpandedLocations((previous) =>
      previous.includes(locationId)
        ? previous.filter((id) => id !== locationId)
        : [...previous, locationId]
    );
  }

  function openCreateModal() {
    setError("");
    setSuccess("");
    setEditingLocation(null);

    setLocationForm({
      siteId: sites[0]?.id ?? "",
      name: "",
      description: "",
      floors: [emptyFloor()],
    });

    setModalMode("create-location");
  }

  function openEditLocation(location) {
    setError("");
    setSuccess("");
    setEditingLocation(location);

    setLocationForm({
      siteId: location.siteId,
      name: location.name,
      description: location.description ?? "",
      floors: [],
    });

    setModalMode("edit-location");
  }

  function openCreateFloor(location) {
    setError("");
    setSuccess("");
    setEditingLocation(location);
    setEditingFloor(null);
    setFloorForm(emptyFloor());
    setModalMode("create-floor");
  }

  function openEditFloor(location, floor) {
    setError("");
    setSuccess("");
    setEditingLocation(location);
    setEditingFloor(floor);

    setFloorForm({
      name: floor.name,
      floorNumber: String(floor.floorNumber),
      description: floor.description ?? "",
      isActive: floor.isActive,
    });

    setModalMode("edit-floor");
  }

  function closeModal() {
    if (saving) return;

    setModalMode(null);
    setEditingLocation(null);
    setEditingFloor(null);
    setError("");
  }

  function updateLocationField(field, value) {
    setLocationForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function updateFloorRow(index, field, value) {
    setLocationForm((previous) => ({
      ...previous,
      floors: previous.floors.map((floor, i) =>
        i === index ? { ...floor, [field]: value } : floor
      ),
    }));
  }

  function addFloorRow() {
    setLocationForm((previous) => ({
      ...previous,
      floors: [...previous.floors, emptyFloor()],
    }));
  }

  function removeFloorRow(index) {
    setLocationForm((previous) => ({
      ...previous,
      floors: previous.floors.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!locationForm.name.trim()) {
      setError("Location name is required.");
      return;
    }

    if (
      modalMode === "create-location" &&
      !locationForm.siteId
    ) {
      setError("Please select a site.");
      return;
    }

    const floors = locationForm.floors.map((floor) => ({
      name: floor.name.trim(),
      floorNumber: Number(floor.floorNumber),
      description: floor.description.trim() || null,
    }));

    if (modalMode === "create-location") {
      for (const floor of floors) {
        if (
          !floor.name ||
          floor.floorNumber === "" ||
          !Number.isInteger(floor.floorNumber)
        ) {
          setError("Every floor needs a name and integer floor number.");
          return;
        }
      }

      const floorNumbers = floors.map((floor) => floor.floorNumber);

      if (new Set(floorNumbers).size !== floorNumbers.length) {
        setError("Floor numbers must be unique within a location.");
        return;
      }
    }

    setSaving(true);

    try {
      if (modalMode === "create-location") {
        await apiRequest("/api/location", {
          method: "POST",
          body: JSON.stringify({
            siteId: locationForm.siteId,
            name: locationForm.name.trim(),
            description: locationForm.description.trim() || null,
            floors,
          }),
        });

        setSuccess("Location and floors created successfully.");
      } else if (modalMode === "edit-location") {
        await apiRequest(`/api/location/${editingLocation.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: locationForm.name.trim(),
            description: locationForm.description.trim() || null,
          }),
        });

        setSuccess("Location updated successfully.");
      } else if (modalMode === "create-floor") {
        if (
          !floorForm.name.trim() ||
          floorForm.floorNumber === "" ||
          !Number.isInteger(Number(floorForm.floorNumber))
        ) {
          setError("Floor name and integer floor number are required.");
          setSaving(false);
          return;
        }

        await apiRequest(
          `/api/location/${editingLocation.id}/floor`,
          {
            method: "POST",
            body: JSON.stringify({
              name: floorForm.name.trim(),
              floorNumber: Number(floorForm.floorNumber),
              description: floorForm.description.trim() || null,
            }),
          }
        );

        setSuccess("Floor created successfully.");
      } else if (modalMode === "edit-floor") {
        if (
          !floorForm.name.trim() ||
          floorForm.floorNumber === "" ||
          !Number.isInteger(Number(floorForm.floorNumber))
        ) {
          setError("Floor name and integer floor number are required.");
          setSaving(false);
          return;
        }

        await apiRequest(
          `/api/location/${editingLocation.id}/floor/${editingFloor.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              name: floorForm.name.trim(),
              floorNumber: Number(floorForm.floorNumber),
              description: floorForm.description.trim() || null,
              isActive: floorForm.isActive,
            }),
          }
        );

        setSuccess("Floor updated successfully.");
      }

      setModalMode(null);
      setEditingLocation(null);
      setEditingFloor(null);

      await loadData();
    } catch (err) {
      setError(err.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingTarget) return;

    setError("");
    setSuccess("");

    const { type, location, floor } = deletingTarget;

    try {
      if (type === "location") {
        await apiRequest(`/api/location/${location.id}`, {
          method: "DELETE",
        });

        setSuccess("Location deleted successfully.");
      } else {
        await apiRequest(
          `/api/location/${location.id}/floor/${floor.id}`,
          { method: "DELETE" }
        );

        setSuccess("Floor deleted successfully.");
      }

      setDeletingTarget(null);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to delete record.");
      setDeletingTarget(null);
    }
  }

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">
              Location & Floor Management
            </h1>
            <p className="dashboard-header__subtitle">
              Manage site locations and their floors.
            </p>
          </div>
        </div>

        {error && !modalMode && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message" role="status">
            {success}
          </div>
        )}

        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search locations"
              placeholder="Search locations, sites, or floors..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateModal}
              disabled={sites.length === 0}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Create Location
            </button>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={loadData}
              disabled={loading}
            >
              <i className="bi bi-arrow-clockwise" aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>

        <section className="table-card content">
          <div className="office-table-wrapper">
            <table className="office-table office-table--locations">
              <thead>
                <tr>
                  <th className="table-col-no">No</th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("name")}
                    >
                      Location
                      <i className="bi bi-arrow-down-up" aria-hidden="true" />
                    </button>
                  </th>
                  <th>Site</th>
                  <th>Description</th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("floors")}
                    >
                      Floors
                      <i className="bi bi-arrow-down-up" aria-hidden="true" />
                    </button>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="muted text-center">
                      Loading locations...
                    </td>
                  </tr>
                ) : pagedLocations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted text-center">
                      No locations found.
                    </td>
                  </tr>
                ) : (
                  pagedLocations.map((location, index) => {
                    const floorCount = location.floors?.length ?? 0;
                    const isExpanded = expandedLocations.includes(
                      location.id
                    );

                    return (
                      <Fragment key={location.id}>
                        <tr className={isExpanded ? "is-expanded" : ""}>
                          <td className="table-col-no">
                            {(safePage - 1) * PAGE_SIZE + index + 1}
                          </td>

                          <td>
                            <strong>{location.name}</strong>
                          </td>

                          <td>{location.site?.name ?? location.siteId}</td>

                          <td className="location-cell--wrap">
                            <span title={location.description || ""}>
                              {location.description || "—"}
                            </span>
                          </td>

                          <td>
                            <div className="location-floors-cell">
                              <span className="location-floors-count">
                                {floorCount} floor(s)
                              </span>

                              {floorCount > 0 && (
                                <button
                                  type="button"
                                  className="location-floors-toggle"
                                  aria-expanded={isExpanded}
                                  aria-label={`${isExpanded ? "Hide" : "View"} floors for ${location.name}`}
                                  onClick={() =>
                                    toggleLocationExpanded(location.id)
                                  }
                                >
                                  <i
                                    className={
                                      isExpanded
                                        ? "bi bi-chevron-up"
                                        : "bi bi-chevron-down"
                                    }
                                    aria-hidden="true"
                                  />
                                  {isExpanded ? "Hide" : "View"}
                                </button>
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="location-actions">
                              <button
                                type="button"
                                className="btn btn-neutral"
                                onClick={() => openCreateFloor(location)}
                              >
                                <i
                                  className="bi bi-plus-lg"
                                  aria-hidden="true"
                                />
                                Floor
                              </button>

                              <TableRowActions
                                label="location"
                                rowLabel={location.name}
                                onEdit={() => openEditLocation(location)}
                                onDelete={() =>
                                  setDeletingTarget({
                                    type: "location",
                                    location,
                                  })
                                }
                              />
                            </div>
                          </td>
                        </tr>

                        {isExpanded && floorCount > 0 && (
                          <tr className="location-floors-row">
                            <td colSpan={6}>
                              <div className="location-floors-panel">
                                <p className="location-floors-panel__title">
                                  Floors — {location.name}
                                </p>

                                <ul className="location-floors-list">
                                  {location.floors.map((floor) => (
                                    <li
                                      key={floor.id}
                                      className="location-floors-item"
                                    >
                                      <div className="location-floors-item__text">
                                        <strong className="location-floors-item__name">
                                          {floor.name}
                                        </strong>
                                        <span className="location-floors-item__meta">
                                          Floor {floor.floorNumber}
                                          {floor.isActive === false && (
                                            <span className="location-floors-badge">
                                              Inactive
                                            </span>
                                          )}
                                        </span>
                                      </div>

                                      <div className="location-floors-item__actions">
                                        <button
                                          type="button"
                                          className="btn btn-neutral btn-compact"
                                          aria-label={`Edit floor ${floor.name}`}
                                          title={`Edit floor ${floor.name}`}
                                          onClick={() =>
                                            openEditFloor(location, floor)
                                          }
                                        >
                                          <i
                                            className="bi bi-pencil"
                                            aria-hidden="true"
                                          />
                                        </button>

                                        <button
                                          type="button"
                                          className="btn btn-neutral btn-compact"
                                          aria-label={`Delete floor ${floor.name}`}
                                          title={`Delete floor ${floor.name}`}
                                          onClick={() =>
                                            setDeletingTarget({
                                              type: "floor",
                                              location,
                                              floor,
                                            })
                                          }
                                        >
                                          <i
                                            className="bi bi-trash"
                                            aria-hidden="true"
                                          />
                                        </button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="office-pagination">
            <span className="office-page-info">
              Showing {startRow}–{endRow} of {sortedLocations.length} locations
            </span>

            <div className="office-page-nav">
              <button
                type="button"
                className="btn btn-neutral"
                disabled={safePage <= 1}
                onClick={() =>
                  setCurrentPage((page) => Math.max(1, page - 1))
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
                  setCurrentPage((page) =>
                    Math.min(totalPages, page + 1)
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

      {modalMode && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
            overflowY: "auto",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-modal-title"
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "650px",
              maxHeight: "90vh",
              overflowY: "auto",
              color: "#172033",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2 id="location-modal-title" style={{ margin: 0 }}>
                {modalMode === "create-location"
                  ? "Create Location"
                  : modalMode === "edit-location"
                    ? "Edit Location"
                    : modalMode === "create-floor"
                      ? `Add Floor — ${editingLocation?.name}`
                      : `Edit Floor — ${editingLocation?.name}`}
              </h2>

              <button
                type="button"
                className="btn btn-neutral"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close modal"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {(modalMode === "create-location" ||
                modalMode === "edit-location") && (
                <>
                  {modalMode === "create-location" && (
                    <div style={fieldStyle}>
                      <label htmlFor="location-site">Site *</label>
                      <select
                        id="location-site"
                        style={inputStyle}
                        value={locationForm.siteId}
                        onChange={(event) =>
                          updateLocationField("siteId", event.target.value)
                        }
                        required
                      >
                        <option value="">Select site</option>
                        {sites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={fieldStyle}>
                    <label htmlFor="location-name">Location Name *</label>
                    <input
                      id="location-name"
                      style={inputStyle}
                      value={locationForm.name}
                      onChange={(event) =>
                        updateLocationField("name", event.target.value)
                      }
                      placeholder="e.g. Left Wing"
                      required
                    />
                  </div>

                  <div style={fieldStyle}>
                    <label htmlFor="location-description">Description</label>
                    <textarea
                      id="location-description"
                      style={inputStyle}
                      rows={3}
                      value={locationForm.description}
                      onChange={(event) =>
                        updateLocationField(
                          "description",
                          event.target.value
                        )
                      }
                      placeholder="Optional description"
                    />
                  </div>
                </>
              )}

              {modalMode === "create-location" && (
                <div style={{ marginTop: "24px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <h3 style={{ margin: 0 }}>Initial Floors</h3>

                    <button
                      type="button"
                      className="btn btn-neutral"
                      onClick={addFloorRow}
                    >
                      <i className="bi bi-plus-lg" aria-hidden="true" />
                      Add Floor
                    </button>
                  </div>

                  {locationForm.floors.map((floor, index) => (
                    <div
                      key={index}
                      style={{
                        border: "1px solid #e1e5ed",
                        borderRadius: "8px",
                        padding: "14px",
                        marginBottom: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "12px",
                        }}
                      >
                        <strong>Floor {index + 1}</strong>

                        {locationForm.floors.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-neutral"
                            onClick={() => removeFloorRow(index)}
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div style={fieldStyle}>
                        <label>Floor Name *</label>
                        <input
                          style={inputStyle}
                          value={floor.name}
                          onChange={(event) =>
                            updateFloorRow(index, "name", event.target.value)
                          }
                          placeholder="e.g. Ground Floor"
                          required
                        />
                      </div>

                      <div style={fieldStyle}>
                        <label>Floor Number *</label>
                        <input
                          type="number"
                          step="1"
                          style={inputStyle}
                          value={floor.floorNumber}
                          onChange={(event) =>
                            updateFloorRow(
                              index,
                              "floorNumber",
                              event.target.value
                            )
                          }
                          required
                        />
                      </div>

                      <div style={fieldStyle}>
                        <label>Description</label>
                        <input
                          style={inputStyle}
                          value={floor.description}
                          onChange={(event) =>
                            updateFloorRow(
                              index,
                              "description",
                              event.target.value
                            )
                          }
                          placeholder="Optional description"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(modalMode === "create-floor" ||
                modalMode === "edit-floor") && (
                <>
                  <div style={fieldStyle}>
                    <label htmlFor="floor-name">Floor Name *</label>
                    <input
                      id="floor-name"
                      style={inputStyle}
                      value={floorForm.name}
                      onChange={(event) =>
                        setFloorForm((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                      placeholder="e.g. Ground Floor"
                      required
                    />
                  </div>

                  <div style={fieldStyle}>
                    <label htmlFor="floor-number">Floor Number *</label>
                    <input
                      id="floor-number"
                      type="number"
                      step="1"
                      style={inputStyle}
                      value={floorForm.floorNumber}
                      onChange={(event) =>
                        setFloorForm((previous) => ({
                          ...previous,
                          floorNumber: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div style={fieldStyle}>
                    <label htmlFor="floor-description">Description</label>
                    <textarea
                      id="floor-description"
                      style={inputStyle}
                      rows={3}
                      value={floorForm.description}
                      onChange={(event) =>
                        setFloorForm((previous) => ({
                          ...previous,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>

                  {modalMode === "edit-floor" && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "20px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={floorForm.isActive}
                        onChange={(event) =>
                          setFloorForm((previous) => ({
                            ...previous,
                            isActive: event.target.checked,
                          }))
                        }
                      />
                      Floor is active
                    </label>
                  )}
                </>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "24px",
                }}
              >
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deletingTarget && (
        <ConfirmModal
          title={
            deletingTarget.type === "location"
              ? "Delete Location"
              : "Delete Floor"
          }
          message={
            deletingTarget.type === "location"
              ? `Delete "${deletingTarget.location.name}"? The location must not contain any floors.`
              : `Delete "${deletingTarget.floor.name}"? The floor must not contain any rooms.`
          }
          confirmLabel="Delete"
          danger
          onClose={() => setDeletingTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </MainLayout>
  );
}
