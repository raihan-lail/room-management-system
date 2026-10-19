
import MainLayout from "../../components/MainLayout";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiRequest from "../../api/client";
import TableRowActions from "../../components/TableRowActions";
import AddModal from "../../components/modals/AddModal";
import ConfirmModal from "../../components/modals/ConfirmModal";
import { buildRoomSchema } from "../../components/modals/addFormSchemas";
import FlexibleButton from "../../components/FlexibleButtons";


const PAGE_SIZE = 10;

function getRoomList(response) {
  if (Array.isArray(response?.rooms)) return response.rooms;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function getPagination(response, currentPage) {
  const pagination = response?.pagination ?? response?.meta ?? {};

  return {
    page: Number(pagination.page ?? currentPage),
    pageSize: Number(pagination.pageSize ?? PAGE_SIZE),
    total: Number(pagination.total ?? 0),
    totalPages: Number(
      pagination.totalPages ??
        Math.max(1, Math.ceil((pagination.total ?? 0) / PAGE_SIZE))
    ),
  };
}

function mapRoomToForm(room) {
  return {
    ...room,
    name: room.name ?? "",
    locationId: room.floor?.location?.id ?? "",
    floorId: room.floorId ?? room.floor?.id ?? "",
    description: room.description ?? "",
    row: room.row ?? "",
    isBookable: room.isBookable === false ? "No" : "Yes",
  };
}

function getRoomLocation(room) {
  return (
    room.floor?.location?.name ??
    room.location?.name ??
    room.location ??
    "-"
  );
}
function getRoomBeds(room) {
  return Array.isArray(room.beds) ? room.beds : [];
}

function getRoomBedCount(room) {
  return room._count?.beds ?? getRoomBeds(room).length;
}

export default function RoomManagement() {
  const navigate = useNavigate();

  const [roomList, setRoomList] = useState([]);
  const [locations, setLocations] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(null);
  const [expandedRooms, setExpandedRooms] = useState([]);

  const loadLocations = useCallback(async () => {
    try {
      const response = await apiRequest("/api/location");
      setLocations(response?.data ?? []);
    } catch (err) {
      setError(err.message || "Failed to load locations.");
    }
  }, []);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
        search: search.trim(),
      });

      const response = await apiRequest(
        `/api/rooms?${params.toString()}`
      );

      const rooms = getRoomList(response);
      const pageInfo = getPagination(response, currentPage);

      setRoomList(rooms);
      setPagination(pageInfo);

      // Protect against a stale page after deletion or filtering.
      if (pageInfo.totalPages > 0 && currentPage > pageInfo.totalPages) {
        setCurrentPage(pageInfo.totalPages);
      }
    } catch (err) {
      setError(err.message || "Failed to load rooms.");
      setRoomList([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search]);

  useEffect(() => {
  const timer = window.setTimeout(() => {
    loadRooms();
  }, 0);

  return () => window.clearTimeout(timer);
}, [loadRooms]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadLocations();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadLocations]);

  const addRoomSchema = useMemo(
    () => buildRoomSchema(locations, { includeBeds: true }),
    [locations]
  );

  const editRoomSchema = useMemo(
    () => buildRoomSchema(locations, { includeBeds: false }),
    [locations]
  );

  const handleAddRoom = async (values) => {
    setSaving(true);
    setError("");

    try {
      const payload = {
        floorId: values.floorId,
        name: values.name?.trim(),
        description: values.description ?? null,
        row: values.row ?? null,
        isBookable: values.isBookable === "Yes",
        numberOfBeds: Number(values.numberOfBeds ?? 1),
      };

      await apiRequest("/api/rooms", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setIsAddModalOpen(false);
      setCurrentPage(1);

      // Refresh explicitly because the page may not have changed.
      if (currentPage === 1) {
        await loadRooms();
      }
    } catch (err) {
      setError(err.message || "Failed to create room.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditRoom = async (values) => {
    if (!editingRow?.id) return;

    setSaving(true);
    setError("");

    try {
      const payload = {
        ...(values.floorId ? { floorId: values.floorId } : {}),
        name: values.name?.trim(),
        description: values.description ?? null,
        row: values.row ?? null,
        isBookable: values.isBookable === "Yes",
      };

      await apiRequest(`/api/rooms/${editingRow.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setEditingRow(null);
      await loadRooms();
    } catch (err) {
      setError(err.message || "Failed to update room.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!deletingRow?.id) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(`/api/rooms/${deletingRow.id}`, {
        method: "DELETE",
      });

      setDeletingRow(null);

      // Reload the previous page if its last room was deleted.
      if (roomList.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        await loadRooms();
      }
    } catch (err) {
      setError(err.message || "Failed to delete room.");
    } finally {
      setSaving(false);
    }
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const toggleRoomExpanded = (roomId) => {
    setExpandedRooms((prev) =>
      prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [...prev, roomId]
    );
  };

  // Sorting applies to the current server-returned page.
  const sortedRooms = useMemo(() => {
    if (!sortConfig.key) return roomList;

    return [...roomList].sort((a, b) => {
      const getValue = (room) => {
        switch (sortConfig.key) {
          case "name":
            return room.name;
          case "location":
            return getRoomLocation(room);
          case "status":
            return room.status ?? "";
          default:
            return "";
        }
      };

      const aValue = String(getValue(a) ?? "").toLowerCase();
      const bValue = String(getValue(b) ?? "").toLowerCase();

      const result = aValue.localeCompare(bValue, undefined, {
        numeric: true,
      });

      return sortConfig.direction === "asc" ? result : -result;
    });
  }, [roomList, sortConfig]);

  const startRow =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.pageSize + 1;

  const endRow = Math.min(
    pagination.page * pagination.pageSize,
    pagination.total
  );

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Room Management</h1>
            <p className="dashboard-header__subtitle">
              Manage rooms, floors, and beds.
            </p>
          </div>
        </div>

        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search rooms"
              placeholder="Search by room number, location, description..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <FlexibleButton
              permission="rooms.manage"
              className="btn btn-primary"
              onClick={() => setIsAddModalOpen(true)}
              disabled={saving}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Create New Room
            </FlexibleButton>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <section className="table-card content">
          <div className="office-table-wrapper">
            <table className="office-table office-table--expandable">
              <thead>
                <tr>
                  <th className="table-col-no">No</th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("name")}
                    >
                      Room Number
                      <i className="bi bi-sort-alpha-down" />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("location")}
                    >
                      Location
                      <i className="bi bi-sort-alpha-down" />
                    </button>
                  </th>
                  <th>Floor</th>
                  <th>Description</th>
                  <th>Beds</th>
                  
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      Loading rooms...
                    </td>
                  </tr>
                ) : sortedRooms.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      No rooms found.
                    </td>
                  </tr>
                ) : (
                  sortedRooms.map((room, index) => {
                    const beds = getRoomBeds(room);
                    const bedCount = getRoomBedCount(room);
                    const isExpanded = expandedRooms.includes(room.id);

                    return (
                      <Fragment key={room.id}>
                        <tr className={isExpanded ? "is-expanded" : ""}>
                          <td className="table-col-no">
                            {startRow + index}
                          </td>
                          <td>
                            <strong>{room.name || "-"}</strong>
                          </td>
                          <td>{getRoomLocation(room)}</td>
                          <td>{room.floor.name || "-"}</td>
                          <td>{room.description || "-"}</td>
                          <td>
                            <div className="location-floors-cell">
                              <span className="location-floors-count">
                                {bedCount} bed(s)
                              </span>

                              {bedCount > 0 && (
                                <button
                                  type="button"
                                  className="location-floors-toggle"
                                  aria-expanded={isExpanded}
                                  aria-label={`${isExpanded ? "Hide" : "View"} beds for room ${room.name}`}
                                  onClick={() => toggleRoomExpanded(room.id)}
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
                            <TableRowActions
                              label="room"
                              rowLabel={room.name}
                              onView={() =>
                                navigate(`/rooms/${room.id}/booking-details`)
                              }
                              onEdit={() => setEditingRow(mapRoomToForm(room))}
                              onDelete={() => setDeletingRow(room)}
                            />
                          </td>
                        </tr>

                        {isExpanded && bedCount > 0 && (
                          <tr className="location-floors-row">
                            <td colSpan={7}>
                              <div className="location-floors-panel">
                                <p className="location-floors-panel__title">
                                  Beds — Room {room.name}
                                </p>

                                <ul className="location-floors-list">
                                  {beds.map((bed) => (
                                    <li
                                      key={bed.id}
                                      className="location-floors-item"
                                    >
                                      <div className="location-floors-item__text">
                                        <strong className="location-floors-item__name">
                                          {bed.name}
                                        </strong>
                                        <span className="location-floors-item__meta">
                                          {bed.status ?? "UNKNOWN"}
                                          {bed.description
                                            ? ` · ${bed.description}`
                                            : ""}
                                          {bed.isActive === false && (
                                            <span className="location-floors-badge">
                                              Inactive
                                            </span>
                                          )}
                                        </span>
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
              Showing {startRow}–{endRow} of {pagination.total} rooms
            </span>

            <div className="office-page-nav">
              <button
                type="button"
                className="btn btn-neutral"
                disabled={loading || currentPage <= 1}
                onClick={() =>
                  setCurrentPage((page) => Math.max(1, page - 1))
                }
              >
                <i className="bi bi-chevron-left" aria-hidden="true" />
                Prev
              </button>

              <span className="office-page-info">
                Page {currentPage} of {pagination.totalPages}
              </span>

              <button
                type="button"
                className="btn btn-neutral"
                disabled={
                  loading || currentPage >= pagination.totalPages
                }
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(pagination.totalPages, page + 1)
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
          schema={addRoomSchema}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddRoom}
        />
      )}

      {editingRow && (
        <AddModal
          schema={editRoomSchema}
          mode="edit"
          initialValues={editingRow}
          onClose={() => setEditingRow(null)}
          onSubmit={handleEditRoom}
        />
      )}

      {deletingRow && (
        <ConfirmModal
          title="Delete Room"
          message={`Delete room ${deletingRow.name || ""}? Rooms with beds cannot be deleted until their beds are removed.`}
          confirmLabel={saving ? "Deleting..." : "Delete"}
          danger
          onClose={() => !saving && setDeletingRow(null)}
          onConfirm={handleDeleteRoom}
        />
      )}
    </MainLayout>
  );
}
