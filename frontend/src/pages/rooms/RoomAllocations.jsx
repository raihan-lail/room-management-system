import { useCallback, useEffect, useMemo, useState } from "react";
import MainLayout from "../../components/MainLayout";
import TableRowActions from "../../components/TableRowActions";
import AddModal from "../../components/modals/AddModal";
import ConfirmModal from "../../components/modals/ConfirmModal";
import { buildRoomAllocationSchema } from "../../components/modals/addFormSchemas";
import FlexibleButton from "../../components/FlexibleButtons";
import useAuth from "../../contexts/useAuth";
import apiRequest from "../../api/client";

const PAGE_SIZE = 10;

function getAllocationList(response) {
  if (Array.isArray(response?.allocations)) return response.allocations;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

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
    totalPages: Math.max(
      1,
      Number(
        pagination.totalPages ??
          Math.ceil((pagination.total ?? 0) / PAGE_SIZE)
      )
    ),
  };
}

export default function RoomAllocation() {
  const { hasPermission } = useAuth();

  const [allocationList, setAllocationList] = useState([]);
  const [rooms, setRooms] = useState([]);
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

  const loadAllocations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
        search: search.trim(),
      });

      const response = await apiRequest(
        `/api/room-allocation?${params.toString()}`
      );

      const allocations = getAllocationList(response);
      const pageInfo = getPagination(response, currentPage);

      setAllocationList(allocations);
      setPagination(pageInfo);

      // Protect against a stale page after deletion or filtering.
      if (pageInfo.totalPages > 0 && currentPage > pageInfo.totalPages) {
        setCurrentPage(pageInfo.totalPages);
      }
    } catch (err) {
      setError(err.message || "Failed to load room allocations.");
      setAllocationList([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search]);

  const loadRooms = useCallback(async () => {
    try {
      // Allocations are only allowed for non-bookable rooms.
      const response = await apiRequest(
        "/api/rooms?isBookable=false&pageSize=100"
      );

      setRooms(
        getRoomList(response).filter((room) => room.isBookable === false)
      );
    } catch (err) {
      setError(err.message || "Failed to load rooms.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAllocations();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAllocations]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadRooms();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadRooms]);

  const allocationSchema = useMemo(() => {
    const editingRoom = editingRow?.room;

    // Keep the current room selectable even if it is no
    // longer flagged as non-bookable.
    const roomOptions =
      editingRoom && !rooms.some((room) => room.id === editingRoom.id)
        ? [editingRoom, ...rooms]
        : rooms;

    return buildRoomAllocationSchema(roomOptions);
  }, [rooms, editingRow]);

  const handleAddAllocation = async (values) => {
    setSaving(true);
    setError("");

    try {
      await apiRequest("/api/room-allocation", {
        method: "POST",
        body: JSON.stringify({
          roomId: values.roomId,
          purpose: values.purpose?.trim(),
          description: values.description?.trim() || null,
          notes: values.notes?.trim() || null,
        }),
      });

      setIsAddModalOpen(false);
      setCurrentPage(1);

      // Refresh explicitly because the page may not have changed.
      if (currentPage === 1) {
        await loadAllocations();
      }
    } catch (err) {
      setError(err.message || "Failed to create room allocation.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditAllocation = async (values) => {
    if (!editingRow?.id) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(`/api/room-allocation/${editingRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          roomId: values.roomId,
          purpose: values.purpose?.trim(),
          description: values.description?.trim() || null,
          notes: values.notes?.trim() || null,
        }),
      });

      setEditingRow(null);
      await loadAllocations();
    } catch (err) {
      setError(err.message || "Failed to update room allocation.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAllocation = async () => {
    if (!deletingRow?.id) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(`/api/room-allocation/${deletingRow.id}`, {
        method: "DELETE",
      });

      setDeletingRow(null);

      // Reload the previous page if its last row was deleted.
      if (allocationList.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        await loadAllocations();
      }
    } catch (err) {
      setError(err.message || "Failed to delete room allocation.");
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

  // Sorting applies to the current server-returned page.
  const sortedAllocations = useMemo(() => {
    if (!sortConfig.key) return allocationList;

    return [...allocationList].sort((a, b) => {
      const getValue = (allocation) => {
        switch (sortConfig.key) {
          case "name":
            return allocation.room?.name ?? "";
          case "purpose":
            return allocation.purpose ?? "";
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
  }, [allocationList, sortConfig]);

  const startRow =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.pageSize + 1;

  const endRow = Math.min(
    pagination.page * pagination.pageSize,
    pagination.total
  );

  const canManage = hasPermission("room-allocations.create");

  return (
    <MainLayout>
      <div className="dashboard">
        {/* HEADER */}
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Room Allocations</h1>

            <p className="dashboard-header__subtitle">
              View and manage room allocations
            </p>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search room allocations"
              placeholder="Search by room, purpose, description..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <FlexibleButton
              permission="room-allocations.create"
              className="btn btn-primary"
              onClick={() => setIsAddModalOpen(true)}
              disabled={saving}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Create New Allocation
            </FlexibleButton>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

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
                      Room Name
                      <i className="bi bi-sort-alpha-down" />
                    </button>
                  </th>

                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("purpose")}
                    >
                      Purpose
                      <i className="bi bi-sort-alpha-down" />
                    </button>
                  </th>

                  <th>Description</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Loading room allocations...
                    </td>
                  </tr>
                ) : sortedAllocations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      No room allocation found.
                    </td>
                  </tr>
                ) : (
                  sortedAllocations.map((allocation, index) => (
                    <tr key={allocation.id}>
                      <td className="table-col-no">{startRow + index}</td>

                      <td>
                        <strong>{allocation.room?.name || "-"}</strong>
                      </td>

                      <td>{allocation.purpose || "-"}</td>

                      <td>{allocation.description || "-"}</td>

                      <td>{allocation.notes || "-"}</td>

                      <td>
                        {canManage ? (
                          <TableRowActions
                            label="allocation"
                            rowLabel={allocation.room?.name}
                            onEdit={() => setEditingRow(allocation)}
                            onDelete={() => setDeletingRow(allocation)}
                          />
                        ) : (
                          <span className="muted">-</span>
                        )}
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
              Showing {startRow}–{endRow} of {pagination.total} room
              allocations
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
                Page {pagination.page} of {pagination.totalPages}
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
          schema={allocationSchema}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddAllocation}
        />
      )}

      {editingRow && (
        <AddModal
          schema={allocationSchema}
          mode="edit"
          initialValues={editingRow}
          onClose={() => setEditingRow(null)}
          onSubmit={handleEditAllocation}
        />
      )}

      {deletingRow && (
        <ConfirmModal
          title="Delete Allocation"
          message={`Delete the allocation for room ${deletingRow.room?.name || ""}? This cannot be undone.`}
          confirmLabel={saving ? "Deleting..." : "Delete"}
          danger
          onClose={() => !saving && setDeletingRow(null)}
          onConfirm={handleDeleteAllocation}
        />
      )}
    </MainLayout>
  );
}
