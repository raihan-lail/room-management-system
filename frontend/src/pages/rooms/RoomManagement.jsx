import MainLayout from "../../components/MainLayout";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TableRowActions from "../../components/TableRowActions";
import AddModal from "../../components/modals/AddModal";
import ConfirmModal from "../../components/modals/ConfirmModal";
import {
  addFormSchemas,
  buildRow,
} from "../../components/modals/addFormSchemas";
import { rooms as initialRooms } from "../../data/room";

const PAGE_SIZE = 10;

const roomSchema = addFormSchemas.room;


export default function RoomManagement() {
     const navigate = useNavigate();
     const [roomList, setRoomList] = useState(initialRooms);
     const [isAddModalOpen, setIsAddModalOpen] = useState(false);
     const [editingRow, setEditingRow] = useState(null);
     const [deletingRow, setDeletingRow] = useState(null);
     const [currentPage, setCurrentPage] = useState(1);
     const [search, setSearch] = useState("");
     const [selectedLocation, setSelectedLocation] = useState("ALL");
     const [selectedStatus, setSelectedStatus] = useState("ALL");
     const [sortConfig, setSortConfig] = useState({
  key: null,
  direction: "asc",
});

 const handleAddRoom = (values) => {
  setRoomList((prev) => [...prev, buildRow(roomSchema, values)]);
  setCurrentPage(1);
};

 const handleEditRoom = (values) => {
  setRoomList((prev) =>
    prev.map((row) =>
      row === editingRow ? buildRow(roomSchema, values, row) : row,
    ),
  );
};

 const handleDeleteRoom = () => {
  setRoomList((prev) => prev.filter((row) => row !== deletingRow));
};

 const handleSort = (key) => {
  setSortConfig((prev) => ({
    key,
    direction:
      prev.key === key && prev.direction === "asc"
        ? "desc"
        : "asc",
  }));

  setCurrentPage(1);
};

     const filteredRooms = useMemo(() => {
        const query = search.trim().toLowerCase();
        return roomList.filter((room) => {
            const locationMatch =
              selectedLocation === "ALL" || room.location === selectedLocation;
            const statusMatch =
              selectedStatus === "ALL" || room.status === selectedStatus;
            const matchesQuery = !query ||
            [
            room.name,
            room.desc,
            room.location,
            room.status,
            room.cleaning_status
        ].some((value) =>
        (value || "").toString().toLowerCase().includes(query)
    );
            return locationMatch && statusMatch && matchesQuery;
        })
     }, [roomList, search, selectedLocation, selectedStatus]);

      const locationOptions = useMemo(() => [
        "ALL",
        ...[...new Set(roomList.map((room) => room.location).filter(Boolean))],
      ], [roomList]);

      const statusOptions = useMemo(() => [
        "ALL",
        ...[...new Set(roomList.map((room) => room.status).filter(Boolean))],
      ], [roomList]);

      const sortedRoom = useMemo(() => {
  if (!sortConfig.key) return filteredRooms;

  return [...filteredRooms].sort((a, b) => {
    let aValue;
    let bValue;

    switch (sortConfig.key) {
      case "name":
        aValue = a.name;
        bValue = b.name;
        break;

      case "location":
        aValue = a.location;
        bValue = b.location;
        break;

      case "status":
        aValue = a.status;
        bValue = b.status;
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
}, [filteredRooms, sortConfig]);

     const totalPages = Math.max(1, Math.ceil(filteredRooms.length / PAGE_SIZE));
     const safePage = Math.min(currentPage, totalPages);

      const pagedRooms = useMemo(() => {
         const startIndex = (safePage - 1) * PAGE_SIZE;
         return sortedRoom.slice(startIndex, startIndex + PAGE_SIZE);
       }, [sortedRoom, safePage]);
     
       const startRow = filteredRooms.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
       const endRow = Math.min(safePage * PAGE_SIZE, filteredRooms.length);
     
       const handleSearchChange = (value) => {
         setSearch(value);
         setCurrentPage(1);
       };

    return (
        <MainLayout>
            <div className="dashboard">
                <div className="dashboard-header">
                     <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Room Management</h1>
            <p className="dashboard-header__subtitle">
              Room management will added here
            </p>
          </div>
         

                </div>
                 <div className="bookings-toolbar form-actions">
                
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search rooms"
              placeholder="Search by room number, location, status..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <select
              aria-label="Filter by location"
              className="permission-role-selector"
              value={selectedLocation}
              onChange={(event) => {
                setSelectedLocation(event.target.value);
                setCurrentPage(1);
              }}
            >
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {location === "ALL" ? "All Locations" : location}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by status"
              className="permission-role-selector"
              value={selectedStatus}
              onChange={(event) => {
                setSelectedStatus(event.target.value);
                setCurrentPage(1);
              }}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === "ALL" ? "All Statuses" : status}
                </option>
              ))}
            </select>
          </div>

          <div className="bookings-toolbar__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsAddModalOpen(true)}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Create New Room
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
                      Room Number
                      <i className="bi bi-sort-alpha-down" column="name">
                        {" "}
                      </i>
                    </button>
                  </th>
                 <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("location")}
                    >
                      Location
                      <i className="bi bi-sort-alpha-down" column="location">
                        {" "}
                      </i>
                    </button>
                  </th>
                  <th>Desc</th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("status")}
                    >
                      Status
                      <i className="bi bi-sort-alpha-down" column="status">
                        {" "}
                      </i>
                    </button>
                  </th>
                   <th>Action</th>
                  
                </tr>
              </thead>

              <tbody>
                {pagedRooms.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="muted">
                      No rooms found.
                    </td>
                  </tr>
                ) : (
                  pagedRooms.map((room, index) => (
                    <tr
                      key={`${room.name}-${index}`}
                    >
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      <td>
                        <strong>{room.name || "-"}</strong>
                      </td>

                      <td>{room.location || "-"}</td>

                      <td>{room.desc || "-"}</td>

                      <td>{room.status || "-"}</td>

                     

                      

                      <td>
                        <TableRowActions
                          label="room"
                          rowLabel={room.name}
                          onView={() =>
                            navigate(`/rooms/${room.name}/booking-details`)
                          }
                          onEdit={() => setEditingRow(room)}
                          onDelete={() => setDeletingRow(room)}
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
              Showing {startRow}–{endRow} of {filteredRooms.length} rooms
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
            schema={roomSchema}
            onClose={() => setIsAddModalOpen(false)}
            onSubmit={handleAddRoom}
          />
        )}

        {editingRow && (
          <AddModal
            schema={roomSchema}
            mode="edit"
            initialValues={editingRow}
            onClose={() => setEditingRow(null)}
            onSubmit={handleEditRoom}
          />
        )}

        {deletingRow && (
          <ConfirmModal
            title="Delete Room"
            message={`Delete room ${deletingRow.name || ""}? This cannot be undone.`}
            confirmLabel="Delete"
            danger
            onClose={() => setDeletingRow(null)}
            onConfirm={handleDeleteRoom}
          />
        )}

        </MainLayout>
    )
}